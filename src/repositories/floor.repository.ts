import { query } from '../config/database';
import { FLOOR_TABLE_NAME } from '../models/floor.model';
import { type CreateFloorInput, type Floor, type UpdateFloorInput } from '../models/floor.model';

const createFloor = async (input: CreateFloorInput): Promise<Floor> => {
  const sql = `
    INSERT INTO ${FLOOR_TABLE_NAME} (
      "buildingId",
      "floorNumber",
      name,
      "totalUnits",
      "totalArea",
      "areaUnit",
      description,
      amenities,
      status,
      "createdBy",
      "updatedBy",
      "deletedAt"
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12
    )
    RETURNING *;
  `;

  const values = [
    input.buildingId,
    input.floorNumber,
    input.name ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.areaUnit ?? 'sqft',
    input.description ?? null,
    input.amenities ?? null,
    input.status ?? 'draft',
    input.createdBy ?? null,
    input.updatedBy ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<Floor>(sql, values);
  const floor = result.rows[0];

  if (!floor) {
    throw new Error('Failed to create floor');
  }

  return floor;
};

const updateFloor = async (
  floorId: Floor['id'],
  input: UpdateFloorInput,
): Promise<Floor | null> => {
  const sql = `
    UPDATE ${FLOOR_TABLE_NAME}
    SET
      "buildingId" = $2,
      "floorNumber" = $3,
      name = $4,
      "totalUnits" = $5,
      "totalArea" = $6,
      "areaUnit" = $7,
      description = $8,
      amenities = $9,
      status = $10,
      "updatedBy" = $11,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Floor>(sql, [
    floorId,
    input.buildingId ?? null,
    input.floorNumber ?? null,
    input.name ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.areaUnit ?? null,
    input.description ?? null,
    input.amenities ?? null,
    input.status ?? null,
    input.updatedBy ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getAllFloors = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Floor['status'];
  buildingId?: Floor['buildingId'];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Floor[]; total: number }> => {
  const where: string[] = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.search) {
    const searchTerm = `%${options.search.toLowerCase()}%`;
    values.push(searchTerm);
    where.push(
      `(LOWER(name) ILIKE $${values.length} OR CAST("floorNumber" AS TEXT) ILIKE $${values.length})`,
    );
  }

  if (options?.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }

  if (options?.buildingId) {
    values.push(options.buildingId);
    where.push(`"buildingId" = $${values.length}`);
  }

  const allowedSortColumns = new Set([
    'buildingId',
    'floorNumber',
    'name',
    'totalUnits',
    'totalArea',
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

  const sql = `
    SELECT *, COUNT(*) OVER() AS "totalCount"
    FROM ${FLOOR_TABLE_NAME}
    WHERE ${where.join(' AND ')}
    ORDER BY "${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<Floor & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...floor } = row;
    return floor;
  });

  return {
    items,
    total: result.rows[0]?.totalCount ?? 0,
  };
};

const getFloorById = async (floorId: Floor['id']): Promise<Floor | null> => {
  const sql = `
    SELECT *
    FROM ${FLOOR_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<Floor>(sql, [floorId]);
  return result.rows[0] ?? null;
};

export { createFloor, getAllFloors, getFloorById, updateFloor };
