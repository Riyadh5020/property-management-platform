import { query } from '../config/database';
import {
  AUDIT_LOG_TABLE_NAME,
  type AuditLog,
  type CreateAuditLogInput,
} from '../models/audit-log.model';

const insertAuditLog = async (i: CreateAuditLogInput): Promise<void> => {
  await query(
    `INSERT INTO ${AUDIT_LOG_TABLE_NAME}
      ("actorId","actorRole",action,"entityType","entityId","propertyId",summary,changes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8);`,
    [
      i.actorId,
      i.actorRole,
      i.action,
      i.entityType,
      i.entityId,
      i.propertyId,
      i.summary.slice(0, 500),
      i.changes === null ? null : JSON.stringify(i.changes),
    ],
  );
};

type AuditLogRow = AuditLog & {
  actorName: string | null;
  actorEmail: string | null;
  propertyTitle: string | null;
};

const listAuditLogs = async (o: {
  limit: number;
  offset: number;
  ownerId?: string;
  propertyId?: string;
  entityType?: string;
  actorId?: string;
}): Promise<{ items: AuditLogRow[]; total: number }> => {
  const where: string[] = ['TRUE'];
  const values: unknown[] = [];
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`a."propertyId" = $${values.length}`);
  }
  if (o.entityType) {
    values.push(o.entityType);
    where.push(`a."entityType" = $${values.length}`);
  }
  if (o.actorId) {
    values.push(o.actorId);
    where.push(`a."actorId" = $${values.length}`);
  }
  values.push(o.limit, o.offset);
  const r = await query<AuditLogRow & { totalCount?: number }>(
    `SELECT a.*, NULLIF(TRIM(CONCAT(ad."firstName", ' ', ad."lastName")), '') AS "actorName",
            ad.email AS "actorEmail", p.title AS "propertyTitle", COUNT(*) OVER() AS "totalCount"
       FROM ${AUDIT_LOG_TABLE_NAME} a
       LEFT JOIN admins ad ON ad.id = a."actorId"
       LEFT JOIN properties p ON p.id = a."propertyId"
      WHERE ${where.join(' AND ')}
      ORDER BY a."createdAt" DESC, a.id
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...log } = row;
    return log;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

export { insertAuditLog, listAuditLogs };
