import { StatusCodes } from 'http-status-codes';

import { type CreateLeaseInput, type Lease, type UpdateLeaseInput } from '../models/lease.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createLease as createRepo,
  deleteLease as deleteRepo,
  findOverlappingLease,
  getAllLeases as getAllRepo,
  getLeaseById as getByIdRepo,
  updateLease as updateRepo,
} from '../repositories/lease.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { getTenantById, getUnitPropertyId } from '../repositories/tenant.repository';
import { createResponseError } from '../utils/app-response';

interface Actor {
  id: string | null;
  role: string | null;
}
const hasPermission = (permissions: unknown, key: string): boolean =>
  typeof permissions === 'object' &&
  permissions !== null &&
  (permissions as Record<string, unknown>)[key] === true;
const forbidden = (message = 'Unauthorized'): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode: StatusCodes.FORBIDDEN, message });

const notFound = (): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Lease not found' });

// Managers need the "rent" permission and an assigned property.
const assertPropertyAccess = async (actor: Actor, propertyId: string): Promise<void> => {
  if (!actor.id) {
    throw forbidden();
  }
  if (actor.role === 'superAdmin') {
    return;
  }

  const property = await getPropertyById(propertyId as never);
  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property not found',
    });
  }

  if (actor.role === 'owner') {
    if (property.ownerId !== actor.id) {
      throw forbidden();
    }
    return;
  }

  if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'rent')) {
      throw forbidden('You do not have permission to manage leases');
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

const assertDates = (start: string, end: string): void => {
  if (end < start) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'End date cannot be before start date',
    });
  }
};

const assertNoOverlap = async (
  unitId: string,
  start: string,
  end: string,
  status: string,
  excludeId?: string,
): Promise<void> => {
  if (status !== 'draft' && status !== 'active') {
    return;
  }
  const clash = await findOverlappingLease(unitId, start, end, excludeId);
  if (clash) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This unit already has a lease from ${clash.startDate} to ${clash.endDate}`,
    });
  }
};

const createLease = async (input: CreateLeaseInput, actor: Actor): Promise<Lease> => {
  await assertPropertyAccess(actor, input.propertyId);
  assertDates(input.startDate, input.endDate);

  const unitPropertyId = await getUnitPropertyId(input.unitId);
  if (unitPropertyId !== input.propertyId) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'This unit does not belong to the selected property',
    });
  }

  const tenant = await getTenantById(input.tenantId);
  if (!tenant) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Tenant not found',
    });
  }
  if (tenant.propertyId !== input.propertyId) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'This tenant does not belong to the selected property',
    });
  }
  if (tenant.status === 'moved_out') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'This tenant has already moved out',
    });
  }

  await assertNoOverlap(input.unitId, input.startDate, input.endDate, input.status ?? 'draft');

  return await createRepo({ ...input, createdBy: actor.id, updatedBy: actor.id });
};

const updateLease = async (id: string, input: UpdateLeaseInput, actor: Actor): Promise<Lease> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);

  const start = input.startDate ?? existing.startDate;
  const end = input.endDate ?? existing.endDate;
  const status = input.status ?? existing.status;
  assertDates(start, end);
  await assertNoOverlap(existing.unitId, start, end, status, id);

  const updated = await updateRepo(id, { ...input, updatedBy: actor.id });
  if (!updated) {
    throw notFound();
  }
  return updated;
};

const deleteLease = async (id: string, actor: Actor): Promise<Lease> => {
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

const getLeaseById = async (id: string, actor: Actor): Promise<Lease> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  return existing;
};

const getAllLeases = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    propertyId?: string;
    unitId?: string;
    tenantId?: string;
  },
  actor: Actor,
): Promise<{ items: Lease[]; total: number }> => {
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
    if (!hasPermission(admin?.permissions, 'rent')) {
      throw forbidden('You do not have permission to manage leases');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }

  throw forbidden();
};

export { createLease, deleteLease, getAllLeases, getLeaseById, updateLease };
