import { StatusCodes } from 'http-status-codes';

import {
  type CreateMaintenanceInput,
  type Maintenance,
  type ReviewMaintenanceInput,
  type UpdateMaintenanceInput,
} from '../models/maintenance.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  attachCompletionExpense,
  createMaintenance as createRepo,
  deleteMaintenance as deleteRepo,
  getAllMaintenance as getAllRepo,
  getMaintenanceById as getByIdRepo,
  reviewMaintenance as reviewRepo,
  updateMaintenance as updateRepo,
} from '../repositories/maintenance.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { getUnitPropertyId } from '../repositories/tenant.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

interface Actor {
  id: string | null;
  role: string | null;
}

const err = (statusCode: number, message: string): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode, message });
const forbidden = (m = 'Unauthorized'): ReturnType<typeof createResponseError> =>
  err(StatusCodes.FORBIDDEN, m);
const notFound = (m = 'Maintenance request not found'): ReturnType<typeof createResponseError> =>
  err(StatusCodes.NOT_FOUND, m);

const hasPermission = (permissions: unknown, key: string): boolean =>
  typeof permissions === 'object' &&
  permissions !== null &&
  (permissions as Record<string, unknown>)[key] === true;

const assertPropertyAccess = async (actor: Actor, propertyId: string): Promise<void> => {
  if (!actor.id) {
    throw forbidden();
  }
  if (actor.role === 'superAdmin') {
    return;
  }
  const property = await getPropertyById(propertyId as never);
  if (!property) {
    throw notFound('Property not found');
  }
  if (actor.role === 'owner') {
    if (property.ownerId !== actor.id) {
      throw forbidden();
    }
    return;
  }
  if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'maintenance')) {
      throw forbidden('You do not have permission to manage maintenance');
    }
    if (admin.ownerId !== property.ownerId) {
      throw forbidden();
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (!assigned.includes(propertyId)) {
      throw forbidden();
    }
    return;
  }
  throw forbidden();
};

const assertUnit = async (propertyId: string, unitId?: string | null): Promise<void> => {
  if (!unitId) {
    return;
  }
  if ((await getUnitPropertyId(unitId)) !== propertyId) {
    throw err(StatusCodes.BAD_REQUEST, 'This unit does not belong to the selected property');
  }
};

// Once a request is completed with a cost, its expense is recorded automatically (at most once).
const syncCompletionExpense = async (m: Maintenance, actor: Actor): Promise<Maintenance> => {
  if (m.status !== 'completed' || m.cost <= 0 || m.expenseId) {
    return m;
  }
  return (await attachCompletionExpense(m.id, actor.id)) ?? (await getByIdRepo(m.id)) ?? m;
};

const createMaintenance = async (
  input: CreateMaintenanceInput,
  actor: Actor,
): Promise<Maintenance> => {
  await assertPropertyAccess(actor, input.propertyId);
  await assertUnit(input.propertyId, input.unitId);
  // A manager's request waits for the owner; owners and superAdmins approve their own.
  const approvalStatus = actor.role === 'manager' ? 'pending' : 'approved';
  if (approvalStatus === 'pending' && input.status && input.status !== 'open') {
    throw err(StatusCodes.BAD_REQUEST, 'A new request stays open until the owner approves it');
  }
  let created = await createRepo({
    ...input,
    approvalStatus,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  if (created.status === 'completed') {
    created =
      (await updateRepo(created.id, { completedOn: new Date().toISOString().slice(0, 10) })) ??
      created;
  }
  const result = await syncCompletionExpense(created, actor);
  await recordAudit({
    actor,
    action: 'create',
    entityType: 'maintenance',
    entityId: result.id,
    propertyId: result.propertyId,
    summary: `Added maintenance request "${result.title}"`,
  });
  return result;
};

const updateMaintenance = async (
  id: string,
  input: UpdateMaintenanceInput,
  actor: Actor,
): Promise<Maintenance> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  if (actor.role === 'manager' && existing.approvalStatus === 'rejected') {
    throw err(
      StatusCodes.CONFLICT,
      'The owner rejected this request, so it can no longer be changed',
    );
  }
  if (input.status && input.status !== existing.status && existing.approvalStatus !== 'approved') {
    throw err(
      StatusCodes.CONFLICT,
      'The status can only change after the owner approves this request',
    );
  }
  if (input.unitId) {
    await assertUnit(existing.propertyId, input.unitId);
  }

  const patch: UpdateMaintenanceInput & { completedOn?: string | null } = {
    ...input,
    updatedBy: actor.id,
  };
  if (input.status && input.status !== existing.status) {
    patch.completedOn = input.status === 'completed' ? new Date().toISOString().slice(0, 10) : null;
  }
  const updated = await updateRepo(id, patch);
  if (!updated) {
    throw notFound();
  }
  const result = await syncCompletionExpense(updated, actor);
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'maintenance',
    entityId: result.id,
    propertyId: result.propertyId,
    summary: `Updated maintenance request "${result.title}"`,
    before: existing,
    after: result,
  });
  return result;
};

// Owner (or superAdmin) approves or rejects a pending request, optionally adjusting it, with a note.
const reviewMaintenance = async (
  id: string,
  input: ReviewMaintenanceInput,
  actor: Actor,
): Promise<Maintenance> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  if (existing.approvalStatus !== 'pending') {
    throw err(StatusCodes.CONFLICT, 'This request has already been reviewed');
  }
  const reviewed = await reviewRepo(id, { ...input, reviewedBy: actor.id });
  if (!reviewed) {
    throw err(StatusCodes.CONFLICT, 'This request has already been reviewed');
  }
  await recordAudit({
    actor,
    action: 'review',
    entityType: 'maintenance',
    entityId: reviewed.id,
    propertyId: reviewed.propertyId,
    summary: `${reviewed.approvalStatus === 'approved' ? 'Approved' : 'Rejected'} maintenance request "${reviewed.title}"`,
    before: existing,
    after: reviewed,
  });
  return reviewed;
};

const deleteMaintenance = async (id: string, actor: Actor): Promise<Maintenance> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  const deleted = await deleteRepo(id);
  if (!deleted) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'delete',
    entityType: 'maintenance',
    entityId: deleted.id,
    propertyId: deleted.propertyId,
    summary: `Deleted maintenance request "${deleted.title}"`,
  });
  return deleted;
};

const getMaintenanceById = async (id: string, actor: Actor): Promise<Maintenance> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  return existing;
};

const getAllMaintenance = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    priority?: string;
    approvalStatus?: string;
    propertyId?: string;
  },
  actor: Actor,
): Promise<{ items: Maintenance[]; total: number }> => {
  if (!actor.id) {
    throw forbidden();
  }
  if (actor.role === 'superAdmin') {
    return await getAllRepo(options);
  }
  if (actor.role === 'owner') {
    return await getAllRepo({ ...options, ownerId: actor.id });
  }
  if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'maintenance')) {
      throw forbidden('You do not have permission to manage maintenance');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }
  throw forbidden();
};

export {
  createMaintenance,
  deleteMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  reviewMaintenance,
  updateMaintenance,
};
