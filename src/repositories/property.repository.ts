import { query } from '../config/database';
import { PROPERTY_TABLE_NAME } from '../models/properties.model';
import {
  type CreatePropertyInput,
  type Property,
  type UpdatePropertyInput,
} from '../models/properties.model';

const createProperty = async (input: CreatePropertyInput): Promise<Property> => {
  const sql = `
    INSERT INTO ${PROPERTY_TABLE_NAME} (
      title,
      description,
      type,
      "listingType",
      price,
      currency,
      address,
      city,
      state,
      country,
      "postalCode",
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      "areaSize",
      "areaUnit",
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
    input.description ?? null,
    input.type,
    input.listingType,
    input.price,
    input.currency ?? 'USD',
    input.address,
    input.city,
    input.state ?? null,
    input.country,
    input.postalCode ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.bedrooms ?? null,
    input.bathrooms ?? null,
    input.areaSize ?? null,
    input.areaUnit ?? null,
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
      description = $3,
      type = $4,
      "listingType" = $5,
      price = $6,
      currency = $7,
      address = $8,
      city = $9,
      state = $10,
      country = $11,
      "postalCode" = $12,
      latitude = $13,
      longitude = $14,
      bedrooms = $15,
      bathrooms = $16,
      "areaSize" = $17,
      "areaUnit" = $18,
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
    input.description ?? null,
    input.type ?? null,
    input.listingType ?? null,
    input.price ?? null,
    input.currency ?? null,
    input.address ?? null,
    input.city ?? null,
    input.state ?? null,
    input.country ?? null,
    input.postalCode ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.bedrooms ?? null,
    input.bathrooms ?? null,
    input.areaSize ?? null,
    input.areaUnit ?? null,
    input.amenities ?? null,
    input.images ?? null,
    input.status ?? null,
    input.ownerId ?? null,
    input.updatedBy ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getAllProperties = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Property['status'];
  type?: Property['type'];
  listingType?: Property['listingType'];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Property[]; total: number }> => {
  const where: string[] = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER(title) ILIKE $${values.length} OR LOWER(city) ILIKE $${values.length} OR LOWER(address) ILIKE $${values.length})`,
    );
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

  const allowedSortColumns = new Set([
    'title',
    'city',
    'price',
    'createdAt',
    'updatedAt',
    'status',
    'type',
    'listingType',
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

export { createProperty, getAllProperties, getPropertyById, updateProperty };
