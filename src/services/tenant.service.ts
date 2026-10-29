import { StatusCodes } from 'http-status-codes';

import {
  type CreateTenantInput,
  type Tenant,
  type UpdateTenantInput,
} from '../models/tenant.model';
import { findAdminById } from '../repositories/admin.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import {
  createTenant as createRepo,
  deleteTenant as deleteRepo,
  findActivePrimaryForUnit,
  getAllTenants as getAllRepo,
  getTenantById as getByIdRepo,
  getUnitPropertyId,
  updateTenant as updateRepo,
} from '../repositories/tenant.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

interface Actor {
  id: string | null;
  role: string | null;
}

const forbidden = (message = 'Unauthorized'): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode: StatusCodes.FORBIDDEN, message });

// Can this actor work with tenants of this property?
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
    const permissions = admin?.permissions;
    if (
      !admin ||
      typeof permissions !== 'object' ||
      permissions === null ||
      Array.isArray(permissions) ||
      permissions.tenants !== true
    ) {
      throw forbidden('You do not have permission to manage tenants');
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

const assertUnitRules = async (
  propertyId: string,
  unitId: string | null | undefined,
  role: string,
  excludeId?: string,
): Promise<void> => {
  if (!unitId) {
    return;
  }

  const unitPropertyId = await getUnitPropertyId(unitId);
  if (unitPropertyId !== propertyId) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'This unit does not belong to the selected property',
    });
  }

  if (role === 'primary') {
    const existing = await findActivePrimaryForUnit(unitId, excludeId);
    if (existing) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: 'This unit already has an active primary tenant',
      });
    }
  }
};

const assertDates = (moveIn?: string | null, moveOut?: string | null): void => {
  if (moveIn && moveOut && moveOut < moveIn) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Move-out date cannot be before move-in date',
    });
  }
};

const createTenant = async (input: CreateTenantInput, actor: Actor): Promise<Tenant> => {
  await assertPropertyAccess(actor, input.propertyId);
  assertDates(input.moveInDate, input.moveOutDate);
  await assertUnitRules(input.propertyId, input.unitId, input.role ?? 'primary');

  const created = await createRepo({ ...input, createdBy: actor.id, updatedBy: actor.id });
  await recordAudit({
    actor,
    action: 'create',
    entityType: 'tenant',
    entityId: created.id,
    propertyId: created.propertyId,
    summary: `Added tenant ${created.fullName}`,
  });
  return created;
};

const updateTenant = async (
  id: string,
  input: UpdateTenantInput,
  actor: Actor,
): Promise<Tenant> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Tenant not found' });
  }
  await assertPropertyAccess(actor, existing.propertyId);

  const moveIn = 'moveInDate' in input ? input.moveInDate : existing.moveInDate;
  const moveOut = 'moveOutDate' in input ? input.moveOutDate : existing.moveOutDate;
  assertDates(moveIn, moveOut);

  const nextUnit = 'unitId' in input ? input.unitId : existing.unitId;
  const nextRole = input.role ?? existing.role;
  const nextStatus = input.status ?? existing.status;
  if (nextStatus !== 'moved_out') {
    await assertUnitRules(existing.propertyId, nextUnit, nextRole, id);
  }

  const updated = await updateRepo(id, { ...input, updatedBy: actor.id });
  if (!updated) {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Tenant not found' });
  }
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'tenant',
    entityId: updated.id,
    propertyId: updated.propertyId,
    summary: `Updated tenant ${updated.fullName}`,
    before: existing,
    after: updated,
  });
  return updated;
};

const deleteTenant = async (id: string, actor: Actor): Promise<Tenant> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Tenant not found' });
  }
  await assertPropertyAccess(actor, existing.propertyId);
  const deleted = await deleteRepo(id);
  if (!deleted) {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Tenant not found' });
  }
  await recordAudit({
    actor,
    action: 'delete',
    entityType: 'tenant',
    entityId: deleted.id,
    propertyId: deleted.propertyId,
    summary: `Deleted tenant ${deleted.fullName}`,
  });
  return deleted;
};

const getTenantById = async (id: string, actor: Actor): Promise<Tenant> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Tenant not found' });
  }
  await assertPropertyAccess(actor, existing.propertyId);
  return existing;
};

const getAllTenants = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    propertyId?: string;
    unitId?: string;
  },
  actor: Actor,
): Promise<{ items: Tenant[]; total: number }> => {
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
    const permissions = admin?.permissions;
    if (
      !admin ||
      typeof permissions !== 'object' ||
      permissions === null ||
      Array.isArray(permissions) ||
      permissions.tenants !== true
    ) {
      throw forbidden('You do not have permission to manage tenants');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }

  throw forbidden();
};

export { createTenant, deleteTenant, getAllTenants, getTenantById, updateTenant };
