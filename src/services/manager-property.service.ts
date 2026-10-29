import { StatusCodes } from 'http-status-codes';

import { findAdminById } from '../repositories/admin.repository';
import {
  listPropertyIdsForManager,
  setManagerProperties,
} from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

const assertCanManage = async (
  managerId: string,
  actorId: string | null,
  actorRole: string | null,
): Promise<NonNullable<Awaited<ReturnType<typeof findAdminById>>>> => {
  const manager = await findAdminById(managerId);

  if (manager?.role !== 'manager') {
    throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Manager not found' });
  }
  if (actorRole === 'superAdmin') {
    return manager;
  }
  if (actorRole === 'owner' && manager.ownerId === actorId) {
    return manager;
  }

  throw createResponseError({ statusCode: StatusCodes.FORBIDDEN, message: 'Unauthorized' });
};

const getManagerProperties = async (
  managerId: string,
  actorId: string | null,
  actorRole: string | null,
): Promise<string[]> => {
  await assertCanManage(managerId, actorId, actorRole);
  return await listPropertyIdsForManager(managerId);
};

const setManagerPropertiesFor = async (
  managerId: string,
  propertyIds: string[],
  actorId: string | null,
  actorRole: string | null,
): Promise<string[]> => {
  const manager = await assertCanManage(managerId, actorId, actorRole);
  const unique = [...new Set(propertyIds)];

  for (const id of unique) {
    const property = await getPropertyById(id as never);
    if (property?.ownerId !== manager.ownerId) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: "Every property must belong to this manager's owner",
      });
    }
  }

  const previous = await listPropertyIdsForManager(managerId);
  await setManagerProperties(managerId, unique, actorId);
  await recordAudit({
    actor: { id: actorId, role: actorRole },
    action: 'assign',
    entityType: 'admin',
    entityId: manager.id,
    propertyId: null,
    summary: `Updated property assignments for ${manager.email}`,
    before: { propertyIds: [...previous].sort() },
    after: { propertyIds: [...unique].sort() },
  });
  return unique;
};

export { getManagerProperties, setManagerPropertiesFor };
