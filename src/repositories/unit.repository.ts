import { query } from '../config/database';
import {
  UNIT_TABLE_NAME,
  type CreateUnitInput,
  type Unit,
  type UpdateUnitInput,
} from '../models/unit.model';

const createUnit = async (input: CreateUnitInput): Promise<Unit> => {
  const sql = `
    INSERT INTO ${UNIT_TABLE_NAME} (
      "floorId",
      "unitCode",
      "unitType",
      "areaSize",
      bedrooms,
      bathrooms,
      "hasKitchen",
      "hasBalcony",
      rent,
      status,
      "createdBy",
      "updatedBy",
      "deletedAt"
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    RETURNING *;
  `;

  const values = [
    input.floorId,
    input.unitCode,
    input.unitType,
    input.areaSize,
    input.bedrooms ?? null,
    input.bathrooms ?? null,
    input.hasKitchen ?? false,
    input.hasBalcony ?? false,
    input.rent ?? null,
    input.status ?? 'vacant',
    input.createdBy ?? null,
    input.updatedBy ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<Unit>(sql, values);
  const unit = result.rows[0];

  if (!unit) {
    throw new Error('Failed to create unit');
  }

  return unit;
};

const updateUnit = async (unitId: Unit['id'], input: UpdateUnitInput): Promise<Unit | null> => {
  const sql = `
    UPDATE ${UNIT_TABLE_NAME}
    SET
      "floorId" = $2,
      "unitCode" = $3,
      "unitType" = $4,
      "areaSize" = $5,
      bedrooms = $6,
      bathrooms = $7,
      "hasKitchen" = $8,
      "hasBalcony" = $9,
      rent = $10,
      status = $11,
      "updatedBy" = $12,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Unit>(sql, [
    unitId,
    input.floorId ?? null,
    input.unitCode ?? null,
    input.unitType ?? null,
    input.areaSize ?? null,
    input.bedrooms ?? null,
    input.bathrooms ?? null,
    input.hasKitchen ?? false,
    input.hasBalcony ?? false,
    input.rent ?? null,
    input.status ?? null,
    input.updatedBy ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getAllUnits = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Unit['status'];
  unitType?: Unit['unitType'];
  floorId?: Unit['floorId'];
  ownerId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Unit[]; total: number }> => {
  const where: string[] = ['u."deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(`LOWER(u."unitCode") ILIKE $${values.length}`);
  }

  if (options?.status) {
    values.push(options.status);
    where.push(`u.status = $${values.length}`);
  }

  if (options?.unitType) {
    values.push(options.unitType);
    where.push(`u."unitType" = $${values.length}`);
  }

  if (options?.floorId) {
    values.push(options.floorId);
    where.push(`u."floorId" = $${values.length}`);
  }

  if (options?.ownerId) {
    values.push(options.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }

  const allowedSortColumns = new Set([
    'unitCode',
    'unitType',
    'areaSize',
    'status',
    'createdAt',
    'updatedAt',
  ]);

  const sortBy =
    options?.sortBy && allowedSortColumns.has(options.sortBy) ? options.sortBy : 'createdAt';
  const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  values.push(limit, offset);

  // Only two hops now: Unit -> Floor -> Property directly (no more Building hop)
  const sql = `
    SELECT u.*, COUNT(*) OVER() AS "totalCount"
    FROM ${UNIT_TABLE_NAME} u
    JOIN floors f ON f.id = u."floorId"
    JOIN properties p ON p.id = f."propertyId"
    WHERE ${where.join(' AND ')}
    ORDER BY u."${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<Unit & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...unit } = row;
    return unit;
  });

  return {
    items,
    total: result.rows[0]?.totalCount ?? 0,
  };
};

const getUnitById = async (unitId: Unit['id']): Promise<Unit | null> => {
  const sql = `
    SELECT *
    FROM ${UNIT_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<Unit>(sql, [unitId]);
  return result.rows[0] ?? null;
};

/** Sum of areaSize for all active units on a floor, optionally excluding one unit (for update checks). */
const getFloorUnitsAreaSum = async (
  floorId: Unit['floorId'],
  excludeUnitId?: Unit['id'],
): Promise<number> => {
  const values: unknown[] = [floorId];
  let excludeClause = '';

  if (excludeUnitId) {
    values.push(excludeUnitId);
    excludeClause = `AND id <> $${values.length}`;
  }

  const sql = `
    SELECT COALESCE(SUM("areaSize"), 0) AS "sum"
    FROM ${UNIT_TABLE_NAME}
    WHERE "floorId" = $1
      AND "deletedAt" IS NULL
      ${excludeClause};
  `;

  const result = await query<{ sum: string }>(sql, values);
  return Number(result.rows[0]?.sum ?? 0);
};

const deleteUnit = async (unitId: Unit['id']): Promise<Unit | null> => {
  const sql = `
    UPDATE ${UNIT_TABLE_NAME}
    SET "deletedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Unit>(sql, [unitId]);
  return result.rows[0] ?? null;
};

export { createUnit, deleteUnit, getAllUnits, getFloorUnitsAreaSum, getUnitById, updateUnit };
