import { StatusCodes } from 'http-status-codes';

import { type BuildingRecord, type RecordKind } from '../models/building-record.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createRecord as createRepo,
  deleteRecord as deleteRepo,
  getAllRecords,
  getRecordById,
  updateRecord as updateRepo,
} from '../repositories/building-record.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

interface Actor {
  id: string | null;
  role: string | null;
}

interface KindPolicy {
  label: string;
  titleKey: string;
  // A manager may see or write this kind only on assigned properties, and only with `permission`.
  managerRead: boolean;
  managerWrite: boolean;
  permission?: string;
  propertyRequired: boolean;
}

const POLICY: Record<RecordKind, KindPolicy> = {
  notices: {
    label: 'notice',
    titleKey: 'title',
    managerRead: true,
    managerWrite: false,
    propertyRequired: false,
  },
  visitors: {
    label: 'visitor entry',
    titleKey: 'name',
    managerRead: true,
    managerWrite: true,
    propertyRequired: true,
  },
  staff: {
    label: 'staff member',
    titleKey: 'name',
    managerRead: false,
    managerWrite: false,
    propertyRequired: true,
  },
  utilities: {
    label: 'utility bill',
    titleKey: 'unit',
    managerRead: true,
    managerWrite: true,
    permission: 'rent',
    propertyRequired: true,
  },
  amenities: {
    label: 'amenity',
    titleKey: 'name',
    managerRead: true,
    managerWrite: false,
    propertyRequired: true,
  },
  emergencyContacts: {
    label: 'emergency contact',
    titleKey: 'name',
    managerRead: true,
    managerWrite: false,
    propertyRequired: true,
  },
  tickets: {
    label: 'support ticket',
    titleKey: 'title',
    managerRead: false,
    managerWrite: false,
    propertyRequired: false,
  },
};

const err = (statusCode: number, message: string): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode, message });
const forbidden = (m = 'Unauthorized'): ReturnType<typeof createResponseError> =>
  err(StatusCodes.FORBIDDEN, m);
const notFound = (): ReturnType<typeof createResponseError> =>
  err(StatusCodes.NOT_FOUND, 'Record not found');

const hasPermission = (permissions: unknown, key: string): boolean =>
  typeof permissions === 'object' &&
  permissions !== null &&
  (permissions as Record<string, unknown>)[key] === true;

const managerAdmin = async (
  actor: Actor,
  policy: KindPolicy,
): Promise<NonNullable<Awaited<ReturnType<typeof findAdminById>>>> => {
  const admin = actor.id ? await findAdminById(actor.id) : null;
  if (!admin || !policy.managerRead) {
    throw forbidden();
  }
  if (policy.permission && !hasPermission(admin.permissions, policy.permission)) {
    throw forbidden('You do not have permission to do that');
  }
  return admin;
};

const assertPropertyWrite = async (
  actor: Actor,
  policy: KindPolicy,
  propertyId: string,
): Promise<void> => {
  if (actor.role === 'superAdmin') {
    return;
  }
  const property = await getPropertyById(propertyId as never);
  if (!property) {
    throw err(StatusCodes.NOT_FOUND, 'Property not found');
  }
  if (actor.role === 'owner') {
    if (property.ownerId !== actor.id) {
      throw forbidden();
    }
    return;
  }
  if (actor.role === 'manager' && policy.managerWrite) {
    const admin = await managerAdmin(actor, policy);
    const assigned = await listPropertyIdsForManager(admin.id);
    if (admin.ownerId === property.ownerId && assigned.includes(propertyId)) {
      return;
    }
  }
  throw forbidden();
};

// Records with no property (owner-wide notices, tickets) belong to their owner.
const assertWrite = async (
  actor: Actor,
  policy: KindPolicy,
  record: BuildingRecord,
): Promise<void> => {
  if (record.propertyId) {
    await assertPropertyWrite(actor, policy, record.propertyId);
    return;
  }
  if (actor.role !== 'superAdmin' && (actor.role !== 'owner' || record.ownerId !== actor.id)) {
    throw forbidden();
  }
};

const flatten = (r: BuildingRecord): Record<string, unknown> => ({
  ...r.data,
  id: r.id,
  propertyId: r.propertyId,
  propertyTitle: r.propertyTitle ?? null,
  ownerId: r.ownerId,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const withComputed = (kind: RecordKind, data: Record<string, unknown>): Record<string, unknown> => {
  // A metered bill works out its own amount unless one was typed in.
  if (kind === 'utilities' && (data.amount === undefined || data.amount === null)) {
    const units = Number(data.current ?? 0) - Number(data.previous ?? 0);
    return { ...data, amount: Math.max(0, Math.round(units * Number(data.rate ?? 0) * 100) / 100) };
  }
  return data;
};

const createRecord = async (
  kind: RecordKind,
  input: Record<string, unknown>,
  actor: Actor,
): Promise<Record<string, unknown>> => {
  const policy = POLICY[kind];
  if (!actor.id) {
    throw forbidden();
  }
  const { propertyId: rawProperty, ...fields } = input;
  const propertyId = (rawProperty as string | null | undefined) ?? null;
  if (policy.propertyRequired && !propertyId) {
    throw err(StatusCodes.BAD_REQUEST, 'Please choose a property');
  }
  if (propertyId) {
    await assertPropertyWrite(actor, policy, propertyId);
  } else if (actor.role !== 'owner' && actor.role !== 'superAdmin') {
    throw forbidden();
  }
  if (kind === 'tickets' && actor.role !== 'owner') {
    throw forbidden('Only owners can open a support ticket');
  }
  // Only the support team answers a ticket or changes its status.
  const data = withComputed(kind, fields);
  if (kind === 'tickets') {
    delete data.reply;
    data.status = 'Open';
  }
  const created = await createRepo({
    kind,
    propertyId,
    ownerId: actor.role === 'owner' ? actor.id : null,
    title: String(data[policy.titleKey]),
    status: (data.status as string | undefined) ?? null,
    data,
    createdBy: actor.id,
  });
  await recordAudit({
    actor,
    action: 'create',
    entityType: 'record',
    entityId: created.id,
    propertyId,
    summary: `Added ${policy.label} ${created.title}`,
  });
  return flatten(created);
};

const updateRecord = async (
  kind: RecordKind,
  id: string,
  input: Record<string, unknown>,
  actor: Actor,
): Promise<Record<string, unknown>> => {
  const policy = POLICY[kind];
  const existing = await getRecordById(kind, id);
  if (!existing) {
    throw notFound();
  }
  await assertWrite(actor, policy, existing);
  const { propertyId: _property, ...fields } = input;
  if (kind === 'tickets' && actor.role !== 'superAdmin') {
    delete fields.reply;
    delete fields.status;
  }
  const merged = { ...existing.data, ...fields };
  if (kind === 'utilities' && fields.amount === undefined) {
    delete merged.amount;
  }
  const data = withComputed(kind, merged);
  const updated = await updateRepo(id, {
    title: String(data[policy.titleKey]),
    status: (data.status as string | undefined) ?? null,
    data,
    updatedBy: actor.id,
  });
  if (!updated) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'record',
    entityId: updated.id,
    propertyId: updated.propertyId,
    summary: `Updated ${policy.label} ${updated.title}`,
    before: existing.data,
    after: updated.data,
  });
  return flatten({ ...updated, propertyTitle: existing.propertyTitle ?? null });
};

const deleteRecord = async (kind: RecordKind, id: string, actor: Actor): Promise<void> => {
  const policy = POLICY[kind];
  const existing = await getRecordById(kind, id);
  if (!existing) {
    throw notFound();
  }
  await assertWrite(actor, policy, existing);
  await deleteRepo(id);
  await recordAudit({
    actor,
    action: 'delete',
    entityType: 'record',
    entityId: existing.id,
    propertyId: existing.propertyId,
    summary: `Deleted ${policy.label} ${existing.title}`,
  });
};

const listRecords = async (
  kind: RecordKind,
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    propertyId?: string;
  },
  actor: Actor,
): Promise<{ items: Record<string, unknown>[]; total: number }> => {
  const policy = POLICY[kind];
  if (!actor.id) {
    throw forbidden();
  }
  const read = async (
    scope?: Parameters<typeof getAllRecords>[0]['scope'],
  ): Promise<{ items: Record<string, unknown>[]; total: number }> => {
    const { items, total } = await getAllRecords({
      ...options,
      kind,
      ...(scope ? { scope } : {}),
    });
    return { items: items.map((r) => flatten(r)), total };
  };
  const isNotice = kind === 'notices';
  if (actor.role === 'superAdmin') {
    return await read();
  }
  if (actor.role === 'owner') {
    return await read({ propertyOwnerId: actor.id, ownerIds: [actor.id], global: isNotice });
  }
  if (actor.role === 'manager') {
    const admin = await managerAdmin(actor, policy);
    return await read({
      propertyIds: await listPropertyIdsForManager(admin.id),
      ...(isNotice && admin.ownerId ? { ownerIds: [admin.ownerId] } : {}),
      global: isNotice,
    });
  }
  throw forbidden();
};

export { createRecord, deleteRecord, listRecords, updateRecord };
