import { query } from '../config/database';
import {
  LEASE_TABLE_NAME,
  type CreateLeaseInput,
  type Lease,
  type UpdateLeaseInput,
} from '../models/lease.model';

const createLease = async (input: CreateLeaseInput): Promise<Lease> => {
  const result = await query<Lease>(
    `INSERT INTO ${LEASE_TABLE_NAME}
      ("propertyId", "unitId", "tenantId", "agreementNo", "startDate", "endDate",
       "monthlyRent", "securityDeposit", "escalationPercent", "noticePeriodDays",
       status, "createdBy", "updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *;`,
    [
      input.propertyId,
      input.unitId,
      input.tenantId,
      input.agreementNo ?? null,
      input.startDate,
      input.endDate,
      input.monthlyRent,
      input.securityDeposit ?? 0,
      input.escalationPercent ?? 0,
      input.noticePeriodDays ?? 30,
      input.status ?? 'draft',
      input.createdBy ?? null,
      input.updatedBy ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create lease');
  }
  return row;
};

const getLeaseById = async (id: string): Promise<Lease | null> => {
  const result = await query<Lease>(
    `SELECT * FROM ${LEASE_TABLE_NAME} WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1;`,
    [id],
  );
  return result.rows[0] ?? null;
};

const updateLease = async (id: string, input: UpdateLeaseInput): Promise<Lease | null> => {
  const has = (k: keyof UpdateLeaseInput): boolean =>
    Object.prototype.hasOwnProperty.call(input, k);
  const result = await query<Lease>(
    `UPDATE ${LEASE_TABLE_NAME} SET
       "agreementNo" = CASE WHEN $2::boolean THEN $3 ELSE "agreementNo" END,
       "startDate" = COALESCE($4::date, "startDate"),
       "endDate" = COALESCE($5::date, "endDate"),
       "monthlyRent" = COALESCE($6, "monthlyRent"),
       "securityDeposit" = COALESCE($7, "securityDeposit"),
       "escalationPercent" = COALESCE($8, "escalationPercent"),
       "noticePeriodDays" = COALESCE($9, "noticePeriodDays"),
       status = COALESCE($10, status),
       "updatedBy" = COALESCE($11, "updatedBy"),
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL
     RETURNING *;`,
    [
      id,
      has('agreementNo'),
      input.agreementNo ?? null,
      input.startDate ?? null,
      input.endDate ?? null,
      input.monthlyRent ?? null,
      input.securityDeposit ?? null,
      input.escalationPercent ?? null,
      input.noticePeriodDays ?? null,
      input.status ?? null,
      input.updatedBy ?? null,
    ],
  );
  return result.rows[0] ?? null;
};

const deleteLease = async (id: string): Promise<Lease | null> => {
  const result = await query<Lease>(
    `UPDATE ${LEASE_TABLE_NAME} SET "deletedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id],
  );
  return result.rows[0] ?? null;
};

// Another live lease on this unit whose period overlaps [start, end]?
// Only draft/active leases count; expired and terminated ones free the unit.
const findOverlappingLease = async (
  unitId: string,
  startDate: string,
  endDate: string,
  excludeId?: string,
): Promise<Lease | null> => {
  const result = await query<Lease>(
    `SELECT * FROM ${LEASE_TABLE_NAME}
      WHERE "unitId" = $1 AND "deletedAt" IS NULL
        AND status IN ('draft','active')
        AND "startDate" <= $3::date AND "endDate" >= $2::date
        AND ($4::uuid IS NULL OR id <> $4)
      LIMIT 1;`,
    [unitId, startDate, endDate, excludeId ?? null],
  );
  return result.rows[0] ?? null;
};

const getAllLeases = async (options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: Lease[]; total: number }> => {
  const where: string[] = ['l."deletedAt" IS NULL', 'p."deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER(t."fullName") LIKE $${values.length} OR LOWER(COALESCE(l."agreementNo",'')) LIKE $${values.length})`,
    );
  }
  if (options.status) {
    values.push(options.status);
    where.push(`l.status = $${values.length}`);
  }
  if (options.propertyId) {
    values.push(options.propertyId);
    where.push(`l."propertyId" = $${values.length}`);
  }
  if (options.unitId) {
    values.push(options.unitId);
    where.push(`l."unitId" = $${values.length}`);
  }
  if (options.tenantId) {
    values.push(options.tenantId);
    where.push(`l."tenantId" = $${values.length}`);
  }
  if (options.ownerId) {
    values.push(options.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (options.propertyIds) {
    values.push(options.propertyIds);
    where.push(`l."propertyId" = ANY($${values.length}::uuid[])`);
  }

  values.push(options.limit ?? 20, options.offset ?? 0);

  const result = await query<Lease & { totalCount?: number }>(
    `SELECT l.*, p.title AS "propertyTitle", u."unitCode" AS "unitCode",
            t."fullName" AS "tenantName", COUNT(*) OVER() AS "totalCount"
       FROM ${LEASE_TABLE_NAME} l
       JOIN properties p ON p.id = l."propertyId"
       JOIN units u ON u.id = l."unitId"
       JOIN tenants t ON t.id = l."tenantId"
      WHERE ${where.join(' AND ')}
      ORDER BY l."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );

  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...lease } = row;
    return lease;
  });
  return { items, total: result.rows[0]?.totalCount ?? 0 };
};

// A lease counts from its start date to its end date while it is active.
const CURRENT_LEASE = `EXISTS (
  SELECT 1 FROM ${LEASE_TABLE_NAME} l
   WHERE l."unitId" = u.id AND l."deletedAt" IS NULL AND l.status = 'active'
     AND l."startDate" <= CURRENT_DATE AND l."endDate" >= CURRENT_DATE)`;

// Marks vacant or reserved units with a current lease as occupied. A unit under maintenance keeps
// its status. Without `unitId` it covers every unit.
const markLeasedUnitsOccupied = async (unitId?: string): Promise<number> => {
  const r = await query(
    `UPDATE units u SET status = 'occupied', "updatedAt" = NOW()
      WHERE u."deletedAt" IS NULL AND u.status IN ('vacant', 'reserved') AND ${CURRENT_LEASE}
        AND ($1::uuid IS NULL OR u.id = $1::uuid);`,
    [unitId ?? null],
  );
  return r.rowCount ?? 0;
};

// Called when a unit's active lease ended or was removed.
const releaseUnitIfNoCurrentLease = async (unitId: string): Promise<void> => {
  await query(
    `UPDATE units u SET status = 'vacant', "updatedAt" = NOW()
      WHERE u.id = $1 AND u."deletedAt" IS NULL AND u.status = 'occupied' AND NOT ${CURRENT_LEASE};`,
    [unitId],
  );
};

// Frees units whose active lease has run out. Units with no lease at all are left alone, because
// an owner can mark a flat they use themselves as occupied.
const releaseUnitsWithExpiredLeases = async (): Promise<number> => {
  const r = await query(
    `UPDATE units u SET status = 'vacant', "updatedAt" = NOW()
      WHERE u."deletedAt" IS NULL AND u.status = 'occupied' AND NOT ${CURRENT_LEASE}
        AND EXISTS (
          SELECT 1 FROM ${LEASE_TABLE_NAME} l
           WHERE l."unitId" = u.id AND l."deletedAt" IS NULL AND l.status = 'active'
             AND l."endDate" < CURRENT_DATE);`,
  );
  return r.rowCount ?? 0;
};

export {
  markLeasedUnitsOccupied,
  releaseUnitIfNoCurrentLease,
  releaseUnitsWithExpiredLeases,
  createLease,
  deleteLease,
  findOverlappingLease,
  getAllLeases,
  getLeaseById,
  updateLease,
};
