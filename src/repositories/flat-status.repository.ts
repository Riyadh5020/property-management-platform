import { query } from '../config/database';
import {
  FLOOR_TABLE_NAME,
  INVOICE_TABLE_NAME,
  LEASE_TABLE_NAME,
  MAINTENANCE_TABLE_NAME,
  PROPERTY_TABLE_NAME,
  TENANT_TABLE_NAME,
  UNIT_TABLE_NAME,
} from '../constants/database';

interface FlatStatusRow {
  unitId: string;
  unitCode: string;
  floorNumber: number;
  propertyId: string;
  propertyTitle: string;
  occupancy: 'occupied' | 'reserved' | 'maintenance' | 'vacant';
  tenantName: string | null;
  leaseEnd: string | null;
  openMaintenance: number;
  overdueInvoices: number;
}

interface FlatStatusOptions {
  limit?: number;
  offset?: number;
  search?: string;
  occupancy?: string;
  propertyId?: string;
  ownerId?: string;
  propertyIds?: string[];
}

const getFlatStatus = async (
  options: FlatStatusOptions,
): Promise<{ items: FlatStatusRow[]; total: number }> => {
  const where: string[] = [
    'u."deletedAt" IS NULL',
    'f."deletedAt" IS NULL',
    'p."deletedAt" IS NULL',
  ];
  const values: unknown[] = [];

  if (options.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER(u."unitCode") LIKE $${values.length} OR LOWER(p.title) LIKE $${values.length})`,
    );
  }

  if (options.occupancy) {
    values.push(options.occupancy);
    where.push(`u.status = $${values.length}`);
  }

  if (options.propertyId) {
    values.push(options.propertyId);
    where.push(`p.id = $${values.length}`);
  }

  if (options.ownerId) {
    values.push(options.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }

  if (options.propertyIds) {
    values.push(options.propertyIds);
    where.push(`p.id = ANY($${values.length}::uuid[])`);
  }

  const joins = `
    FROM ${UNIT_TABLE_NAME} u
    JOIN ${FLOOR_TABLE_NAME} f ON f.id = u."floorId"
    JOIN ${PROPERTY_TABLE_NAME} p ON p.id = f."propertyId"
  `;
  const countResult = await query<{ total: number }>(
    `SELECT COUNT(*)::int AS total ${joins} WHERE ${where.join(' AND ')}`,
    values,
  );

  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;
  const result = await query<FlatStatusRow>(
    `SELECT
       u.id AS "unitId",
       u."unitCode",
       f."floorNumber",
       p.id AS "propertyId",
       p.title AS "propertyTitle",
       u.status AS occupancy,
       current_tenant."fullName" AS "tenantName",
       current_lease."endDate"::text AS "leaseEnd",
       COALESCE(open_work.count, 0)::int AS "openMaintenance",
       COALESCE(overdue.count, 0)::int AS "overdueInvoices"
     ${joins}
     LEFT JOIN LATERAL (
       SELECT l."tenantId", l."endDate"
       FROM ${LEASE_TABLE_NAME} l
       WHERE l."unitId" = u.id
         AND l."deletedAt" IS NULL
         AND l.status = 'active'
       ORDER BY l."endDate" DESC
       LIMIT 1
     ) current_lease ON TRUE
     LEFT JOIN ${TENANT_TABLE_NAME} current_tenant
       ON current_tenant.id = current_lease."tenantId"
       AND current_tenant."deletedAt" IS NULL
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count
       FROM ${MAINTENANCE_TABLE_NAME} m
       WHERE m."unitId" = u.id
         AND m."deletedAt" IS NULL
         AND m.status IN ('open', 'in_progress')
     ) open_work ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS count
       FROM ${INVOICE_TABLE_NAME} i
       WHERE i."unitId" = u.id
         AND i.status IN ('unpaid', 'partial')
         AND i."dueDate" < CURRENT_DATE
     ) overdue ON TRUE
     WHERE ${where.join(' AND ')}
     ORDER BY p.title, f."floorNumber", u."unitCode"
     LIMIT $${values.length + 1}
     OFFSET $${values.length + 2};`,
    [...values, limit, offset],
  );

  return {
    items: result.rows,
    total: countResult.rows[0]?.total ?? 0,
  };
};

export { getFlatStatus };
export type { FlatStatusRow };
