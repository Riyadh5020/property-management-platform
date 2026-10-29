import { StatusCodes } from 'http-status-codes';

import { type AuditChanges, type AuditEntityType } from '../models/audit-log.model';
import { insertAuditLog, listAuditLogs } from '../repositories/audit-log.repository';
import { createResponseError } from '../utils/app-response';

interface Actor {
  id: string | null;
  role: string | null;
}

// Bookkeeping columns that change on every write (or repeat the entry's own who/when) and would
// only add noise to the history.
const IGNORED_FIELDS = new Set([
  'updatedAt',
  'updatedBy',
  'reviewedAt',
  'reviewedBy',
  'createdAt',
  'createdBy',
  'propertyTitle',
  'unitCode',
  'totalCount',
]);

const comparable = (v: unknown): string =>
  JSON.stringify(v instanceof Date ? v.toISOString() : (v ?? null));

// Returns only the fields whose value actually changed, or null when nothing did.
const diffChanges = (before: object, after: object): AuditChanges | null => {
  const changes: AuditChanges = {};
  const prev = before as Record<string, unknown>;
  for (const [key, to] of Object.entries(after)) {
    if (IGNORED_FIELDS.has(key)) {
      continue;
    }
    const from = prev[key];
    if (comparable(from) !== comparable(to)) {
      changes[key] = { from: from ?? null, to: to ?? null };
    }
  }
  return Object.keys(changes).length > 0 ? changes : null;
};

// Records one history entry. Best effort: a logging problem must never undo or block the change
// itself, so failures are only logged.
const recordAudit = async (input: {
  actor: Actor;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  propertyId: string | null;
  summary: string;
  before?: object;
  after?: object;
}): Promise<void> => {
  try {
    await insertAuditLog({
      actorId: input.actor.id,
      actorRole: input.actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      propertyId: input.propertyId,
      summary: input.summary,
      changes: input.before && input.after ? diffChanges(input.before, input.after) : null,
    });
  } catch (error) {
    console.warn('[audit] could not record history entry:', (error as Error).message);
  }
};

// superAdmin sees everything; an owner sees the history of their own properties only.
const getAuditLogs = async (
  options: {
    limit: number;
    offset: number;
    propertyId?: string;
    entityType?: string;
    actorId?: string;
  },
  actor: Actor,
): ReturnType<typeof listAuditLogs> => {
  if (actor.role === 'superAdmin') {
    return await listAuditLogs(options);
  }
  if (actor.role === 'owner' && actor.id) {
    return await listAuditLogs({ ...options, ownerId: actor.id });
  }
  throw createResponseError({ statusCode: StatusCodes.FORBIDDEN, message: 'Unauthorized' });
};

export { diffChanges, getAuditLogs, recordAudit };
