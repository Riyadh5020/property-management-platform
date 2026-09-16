import { query } from '../config/database';
import {
  BUILDING_TABLE_NAME,
  type Building,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from '../models/building.model';

const createBuilding = async (input: CreateBuildingInput): Promise<Building> => {
  const sql = `
    INSERT INTO ${BUILDING_TABLE_NAME} (
      "propertyId",
      name,
      "buildingNumber",
      floors,
      "totalUnits",
      "totalArea",
      "areaUnit",
      description,
      status,
      amenities,
      images,
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
      $12,
      $13,
      $14
    )
    RETURNING *;
  `;

  const values = [
    input.propertyId,
    input.name,
    input.buildingNumber ?? null,
    input.floors ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.areaUnit ?? 'sqft',
    input.description ?? null,
    input.status ?? 'draft',
    input.amenities ?? null,
    input.images ?? null,
    input.createdBy ?? null,
    input.updatedBy ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<Building>(sql, values);
  const building = result.rows[0];

  if (!building) {
    throw new Error('Failed to create building');
  }

  return building;
};

const updateBuilding = async (
  buildingId: Building['id'],
  input: UpdateBuildingInput,
): Promise<Building | null> => {
  const sql = `
    UPDATE ${BUILDING_TABLE_NAME}
    SET
      "propertyId" = $2,
      name = $3,
      "buildingNumber" = $4,
      floors = $5,
      "totalUnits" = $6,
      "totalArea" = $7,
      "areaUnit" = $8,
      description = $9,
      status = $10,
      amenities = $11,
      images = $12,
      "updatedBy" = $13,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Building>(sql, [
    buildingId,
    input.propertyId ?? null,
    input.name ?? null,
    input.buildingNumber ?? null,
    input.floors ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.areaUnit ?? null,
    input.description ?? null,
    input.status ?? null,
    input.amenities ?? null,
    input.images ?? null,
    input.updatedBy ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getAllBuildings = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Building['status'];
  propertyId?: Building['propertyId'];
  ownerId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Building[]; total: number }> => {
  const where: string[] = ['b."deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER(b.name) ILIKE $${values.length} OR LOWER(b."buildingNumber") ILIKE $${values.length})`,
    );
  }

  if (options?.status) {
    values.push(options.status);
    where.push(`b.status = $${values.length}`);
  }

  if (options?.propertyId) {
    values.push(options.propertyId);
    where.push(`b."propertyId" = $${values.length}`);
  }

  if (options?.ownerId) {
    values.push(options.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }

  const allowedSortColumns = new Set([
    'name',
    'status',
    'floors',
    'totalUnits',
    'totalArea',
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
    SELECT b.*, COUNT(*) OVER() AS "totalCount"
    FROM ${BUILDING_TABLE_NAME} b
    JOIN properties p ON p.id = b."propertyId"
    WHERE ${where.join(' AND ')}
    ORDER BY b."${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<Building & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...building } = row;
    return building;
  });

  return {
    items,
    total: result.rows[0]?.totalCount ?? 0,
  };
};

const getBuildingById = async (buildingId: Building['id']): Promise<Building | null> => {
  const sql = `
    SELECT *
    FROM ${BUILDING_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<Building>(sql, [buildingId]);
  return result.rows[0] ?? null;
};

const deleteBuilding = async (buildingId: Building['id']): Promise<Building | null> => {
  const sql = `
    UPDATE ${BUILDING_TABLE_NAME}
    SET "deletedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Building>(sql, [buildingId]);
  return result.rows[0] ?? null;
};

export { createBuilding, deleteBuilding, getAllBuildings, getBuildingById, updateBuilding };
