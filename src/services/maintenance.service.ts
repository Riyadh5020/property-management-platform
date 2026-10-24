import { StatusCodes } from 'http-status-codes';

import {
  type CreateMaintenanceInput,
  type Maintenance,
  type UpdateMaintenanceInput,
} from '../models/maintenance.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createMaintenance as createRepo,
  deleteMaintenance as deleteRepo,
  getAllMaintenance as getAllRepo,
  getMaintenanceById as getByIdRepo,
  updateMaintenance as updateRepo,
} from '../repositories/maintenance.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { getUnitPropertyId } from '../repositories/tenant.repository';
import { createResponseError } from '../utils/app-response';

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

const createMaintenance = async (
  input: CreateMaintenanceInput,
  actor: Actor,
): Promise<Maintenance> => {
  await assertPropertyAccess(actor, input.propertyId);
  await assertUnit(input.propertyId, input.unitId);
  const created = await createRepo({ ...input, createdBy: actor.id, updatedBy: actor.id });
  if (created.status === 'completed') {
    return (
      (await updateRepo(created.id, { completedOn: new Date().toISOString().slice(0, 10) })) ??
      created
    );
  }
  return created;
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
  return updated;
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
  updateMaintenance,
};
