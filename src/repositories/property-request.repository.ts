import { query } from '../config/database';
import { ADMIN_TABLE_NAME } from '../models/admin.model';
import {
  PROPERTY_REQUEST_TABLE_NAME,
  type CreatePropertyRequestInput,
  type PropertyRequest,
  type UpdatePropertyRequestInput,
} from '../models/property-request.model';

const createPropertyRequest = async (
  input: CreatePropertyRequestInput,
): Promise<PropertyRequest> => {
  const sql = `
    INSERT INTO ${PROPERTY_REQUEST_TABLE_NAME}
      ("ownerId", note, title, "buildingNumber", floors, "totalUnits", "totalArea",
       address, city, state, country, "postalCode")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *;
  `;
  const result = await query<PropertyRequest>(sql, [
    input.ownerId,
    input.note ?? null,
    input.title,
    input.buildingNumber ?? null,
    input.floors,
    input.totalUnits ?? null,
    input.totalArea ?? null,
    input.address,
    input.city,
    input.state,
    input.country,
    input.postalCode ?? null,
  ]);
  const request = result.rows[0];

  if (!request) {
    throw new Error('Failed to create property request');
  }

  return request;
};

const updatePropertyRequest = async (
  requestId: PropertyRequest['id'],
  input: UpdatePropertyRequestInput,
): Promise<PropertyRequest | null> => {
  const sql = `
    UPDATE ${PROPERTY_REQUEST_TABLE_NAME}
    SET
      status = COALESCE($2, status),
      "reviewedBy" = COALESCE($3, "reviewedBy"),
      "reviewedAt" = COALESCE($4, "reviewedAt"),
      "consumedAt" = COALESCE($5, "consumedAt"),
      "updatedAt" = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query<PropertyRequest>(sql, [
    requestId,
    input.status ?? null,
    input.reviewedBy ?? null,
    input.reviewedAt ?? null,
    input.consumedAt ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getPropertyRequestById = async (
  requestId: PropertyRequest['id'],
): Promise<PropertyRequest | null> => {
  const sql = `SELECT * FROM ${PROPERTY_REQUEST_TABLE_NAME} WHERE id = $1 LIMIT 1;`;
  const result = await query<PropertyRequest>(sql, [requestId]);
  return result.rows[0] ?? null;
};

/** The one thing that matters for the create-property gate: does this owner
 * have an approved request that hasn't been used yet? */
const findApprovedUnconsumedRequest = async (
  ownerId: PropertyRequest['ownerId'],
): Promise<PropertyRequest | null> => {
  const sql = `
    SELECT *
    FROM ${PROPERTY_REQUEST_TABLE_NAME}
    WHERE "ownerId" = $1
      AND status = 'approved'
      AND "consumedAt" IS NULL
    ORDER BY "reviewedAt" ASC
    LIMIT 1;
  `;

  const result = await query<PropertyRequest>(sql, [ownerId]);
  return result.rows[0] ?? null;
};

const findPendingRequestForOwner = async (
  ownerId: PropertyRequest['ownerId'],
): Promise<PropertyRequest | null> => {
  const sql = `
    SELECT *
    FROM ${PROPERTY_REQUEST_TABLE_NAME}
    WHERE "ownerId" = $1
      AND status = 'pending'
    LIMIT 1;
  `;

  const result = await query<PropertyRequest>(sql, [ownerId]);
  return result.rows[0] ?? null;
};

const getAllPropertyRequests = async (options?: {
  limit?: number;
  offset?: number;
  status?: PropertyRequest['status'];
  ownerId?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: PropertyRequest[]; total: number }> => {
  const where: string[] = [];
  const values: unknown[] = [];

  if (options?.status) {
    values.push(options.status);
    where.push(`r.status = $${values.length}`);
  }

  if (options?.ownerId) {
    values.push(options.ownerId);
    where.push(`r."ownerId" = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  values.push(limit, offset);

  const sql = `
    SELECT r.*,
      CONCAT_WS(' ', a."firstName", a."lastName") AS "ownerName",
      a.email AS "ownerEmail",
      COUNT(*) OVER() AS "totalCount"
    FROM ${PROPERTY_REQUEST_TABLE_NAME} r
    LEFT JOIN ${ADMIN_TABLE_NAME} a ON a.id = r."ownerId"
    ${whereClause}
    ORDER BY r."createdAt" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<PropertyRequest & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...request } = row;
    return request;
  });

  return {
    items,
    total: result.rows[0]?.totalCount ?? 0,
  };
};

export {
  createPropertyRequest,
  findApprovedUnconsumedRequest,
  findPendingRequestForOwner,
  getAllPropertyRequests,
  getPropertyRequestById,
  updatePropertyRequest,
};
