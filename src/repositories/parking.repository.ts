import { query } from '../config/database';
import {
  PARKING_TABLE_NAME,
  type CreateParkingInput,
  type ParkingSlot,
  type UpdateParkingInput,
} from '../models/parking.model';

// A soft-deleted unit is not a usable relationship: read paths report it as no unit.
// The stored "unitId" is left as-is (no write happens when a unit is deleted).
// Status is re-derived with the same rule as deriveStatus() in parking.service.ts, using only
// the active unit, so a slot whose unit was deleted is not reported (or filtered) as assigned.
const EFFECTIVE_STATUS = `CASE
    WHEN s.status = 'blocked' THEN 'blocked'
    WHEN u.id IS NOT NULL OR COALESCE(s."vehicleNumber", '') <> '' THEN 'assigned'
    ELSE 'free'
  END`;
const SLOT_COLUMNS = `s.id, s."propertyId", s."slotNumber", s."slotType", u.id AS "unitId",
  s."vehicleNumber", s."monthlyFee", ${EFFECTIVE_STATUS} AS status, s."createdBy", s."updatedBy",
  s."createdAt", s."updatedAt", s."deletedAt"`;
const ACTIVE_UNIT_JOIN = `LEFT JOIN units u ON u.id = s."unitId" AND u."deletedAt" IS NULL`;

const createParking = async (i: CreateParkingInput): Promise<ParkingSlot> => {
  const r = await query<ParkingSlot>(
    `INSERT INTO ${PARKING_TABLE_NAME}
      ("propertyId","slotNumber","slotType","unitId","vehicleNumber","monthlyFee",status,"createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *;`,
    [
      i.propertyId,
      i.slotNumber,
      i.slotType ?? 'resident',
      i.unitId ?? null,
      i.vehicleNumber ?? null,
      i.monthlyFee ?? 0,
      i.status ?? 'free',
      i.createdBy ?? null,
      i.updatedBy ?? null,
    ],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create parking slot');
  }
  return row;
};

const getParkingById = async (id: string): Promise<ParkingSlot | null> => {
  const r = await query<ParkingSlot>(
    `SELECT ${SLOT_COLUMNS} FROM ${PARKING_TABLE_NAME} s ${ACTIVE_UNIT_JOIN}
      WHERE s.id = $1 AND s."deletedAt" IS NULL LIMIT 1;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const findSlotByNumber = async (
  propertyId: string,
  slotNumber: string,
  excludeId?: string,
): Promise<ParkingSlot | null> => {
  const r = await query<ParkingSlot>(
    `SELECT * FROM ${PARKING_TABLE_NAME}
      WHERE "propertyId" = $1 AND "slotNumber" = $2 AND "deletedAt" IS NULL
        AND ($3::uuid IS NULL OR id <> $3) LIMIT 1;`,
    [propertyId, slotNumber, excludeId ?? null],
  );
  return r.rows[0] ?? null;
};

const updateParking = async (id: string, i: UpdateParkingInput): Promise<ParkingSlot | null> => {
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(i, k);
  const r = await query<ParkingSlot>(
    `WITH s AS (
     UPDATE ${PARKING_TABLE_NAME} SET
       "slotNumber" = COALESCE($2, "slotNumber"),
       "slotType" = COALESCE($3, "slotType"),
       "unitId" = CASE WHEN $4::boolean THEN $5::uuid ELSE "unitId" END,
       "vehicleNumber" = CASE WHEN $6::boolean THEN $7 ELSE "vehicleNumber" END,
       "monthlyFee" = COALESCE($8, "monthlyFee"),
       status = COALESCE($9, status),
       "updatedBy" = COALESCE($10, "updatedBy"),
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL RETURNING *
     )
     SELECT ${SLOT_COLUMNS} FROM s ${ACTIVE_UNIT_JOIN};`,
    [
      id,
      i.slotNumber ?? null,
      i.slotType ?? null,
      has('unitId'),
      i.unitId ?? null,
      has('vehicleNumber'),
      i.vehicleNumber ?? null,
      i.monthlyFee ?? null,
      i.status ?? null,
      i.updatedBy ?? null,
    ],
  );
  return r.rows[0] ?? null;
};

const deleteParking = async (id: string): Promise<ParkingSlot | null> => {
  const r = await query<ParkingSlot>(
    `WITH s AS (
       UPDATE ${PARKING_TABLE_NAME} SET "deletedAt" = NOW()
        WHERE id = $1 AND "deletedAt" IS NULL RETURNING *
     )
     SELECT ${SLOT_COLUMNS} FROM s ${ACTIVE_UNIT_JOIN};`,
    [id],
  );
  return r.rows[0] ?? null;
};

const getAllParking = async (o: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  slotType?: string;
  propertyId?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: ParkingSlot[]; total: number }> => {
  const where: string[] = ['s."deletedAt" IS NULL', 'p."deletedAt" IS NULL'];
  const values: unknown[] = [];
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(
      `(LOWER(s."slotNumber") LIKE $${values.length} OR LOWER(COALESCE(s."vehicleNumber",'')) LIKE $${values.length})`,
    );
  }
  if (o.status) {
    values.push(o.status);
    where.push(`${EFFECTIVE_STATUS} = $${values.length}`);
  }
  if (o.slotType) {
    values.push(o.slotType);
    where.push(`s."slotType" = $${values.length}`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`s."propertyId" = $${values.length}`);
  }
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (o.propertyIds) {
    values.push(o.propertyIds);
    where.push(`s."propertyId" = ANY($${values.length}::uuid[])`);
  }
  values.push(o.limit ?? 20, o.offset ?? 0);
  const r = await query<ParkingSlot & { totalCount?: number }>(
    `SELECT ${SLOT_COLUMNS}, p.title AS "propertyTitle", u."unitCode" AS "unitCode", COUNT(*) OVER() AS "totalCount"
       FROM ${PARKING_TABLE_NAME} s
       JOIN properties p ON p.id = s."propertyId"
       ${ACTIVE_UNIT_JOIN}
      WHERE ${where.join(' AND ')}
      ORDER BY s."slotNumber" ASC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...slot } = row;
    return slot;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

export {
  createParking,
  deleteParking,
  findSlotByNumber,
  getAllParking,
  getParkingById,
  updateParking,
};
