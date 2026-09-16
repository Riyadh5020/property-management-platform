import { query } from '../config/database';
import {
  PROPERTY_TABLE_NAME,
  type CreatePropertyInput,
  type Property,
  type UpdatePropertyInput,
} from '../models/properties.model';

const createProperty = async (input: CreatePropertyInput): Promise<Property> => {
  const sql = `
    INSERT INTO ${PROPERTY_TABLE_NAME} (
      title,
      "buildingNumber",
      description,
      type,
      "listingType",
      price,
      currency,
      floors,
      "totalUnits",
      "totalArea",
      address,
      city,
      state,
      country,
      "postalCode",
      latitude,
      longitude,
      amenities,
      images,
      status,
      "ownerId",
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
      $14,
      $15,
      $16,
      $17,
      $18,
      $19,
      $20,
      $21,
      $22,
      $23,
      $24
    )
    RETURNING *;
  `;

  const values = [
    input.title,
    input.buildingNumber ?? null,
    input.description ?? null,
    input.type,
    input.listingType ?? 'rent',
    input.price,
    input.currency ?? 'USD',
    input.floors ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.address,
    input.city,
    input.state ?? null,
    input.country,
    input.postalCode ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.amenities ?? null,
    input.images ?? null,
    input.status ?? 'draft',
    input.ownerId ?? null,
    input.createdBy ?? null,
    input.updatedBy ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<Property>(sql, values);
  const property = result.rows[0];

  if (!property) {
    throw new Error('Failed to create property');
  }

  return property;
};

const updateProperty = async (
  propertyId: Property['id'],
  input: UpdatePropertyInput,
): Promise<Property | null> => {
  const sql = `
    UPDATE ${PROPERTY_TABLE_NAME}
    SET
      title = $2,
      "buildingNumber" = $3,
      description = $4,
      type = $5,
      "listingType" = $6,
      price = $7,
      currency = $8,
      floors = $9,
      "totalUnits" = $10,
      "totalArea" = $11,
      address = $12,
      city = $13,
      state = $14,
      country = $15,
      "postalCode" = $16,
      latitude = $17,
      longitude = $18,
      amenities = $19,
      images = $20,
      status = $21,
      "ownerId" = $22,
      "updatedBy" = $23,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Property>(sql, [
    propertyId,
    input.title ?? null,
    input.buildingNumber ?? null,
    input.description ?? null,
    input.type ?? null,
    input.listingType ?? null,
    input.price ?? null,
    input.currency ?? null,
    input.floors ?? null,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.address ?? null,
    input.city ?? null,
    input.state ?? null,
    input.country ?? null,
    input.postalCode ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.amenities ?? null,
    input.images ?? null,
    input.status ?? null,
    input.ownerId ?? null,
    input.updatedBy ?? null,
  ]);

  return result.rows[0] ?? null;
};

const deleteProperty = async (propertyId: Property['id']): Promise<Property | null> => {
  const sql = `
    UPDATE ${PROPERTY_TABLE_NAME}
    SET "deletedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Property>(sql, [propertyId]);
  return result.rows[0] ?? null;
};

const getAllProperties = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Property['status'];
  type?: Property['type'];
  listingType?: Property['listingType'];
  ownerId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Property[]; total: number }> => {
  const where: string[] = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(`(LOWER(title) ILIKE $${values.length} OR LOWER(city) ILIKE $${values.length})`);
  }

  if (options?.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }

  if (options?.type) {
    values.push(options.type);
    where.push(`type = $${values.length}`);
  }

  if (options?.listingType) {
    values.push(options.listingType);
    where.push(`"listingType" = $${values.length}`);
  }

  if (options?.ownerId) {
    values.push(options.ownerId);
    where.push(`"ownerId" = $${values.length}`);
  }

  const allowedSortColumns = new Set([
    'title',
    'price',
    'city',
    'status',
    'type',
    'listingType',
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
    FROM ${PROPERTY_TABLE_NAME}
    WHERE ${where.join(' AND ')}
    ORDER BY "${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<Property & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...property } = row;
    return property;
  });

  return {
    items,
    total: result.rows[0]?.totalCount ?? 0,
  };
};

const getPropertyById = async (propertyId: Property['id']): Promise<Property | null> => {
  const sql = `
    SELECT *
    FROM ${PROPERTY_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<Property>(sql, [propertyId]);
  return result.rows[0] ?? null;
};

export { createProperty, deleteProperty, getAllProperties, getPropertyById, updateProperty };
