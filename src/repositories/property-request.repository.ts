import { query } from '../config/database';
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
    INSERT INTO ${PROPERTY_REQUEST_TABLE_NAME} ("ownerId", note)
    VALUES ($1, $2)
    RETURNING *;
  `;

  const result = await query<PropertyRequest>(sql, [input.ownerId, input.note]);
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
    where.push(`status = $${values.length}`);
  }

  if (options?.ownerId) {
    values.push(options.ownerId);
    where.push(`"ownerId" = $${values.length}`);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  values.push(limit, offset);

  const sql = `
    SELECT *, COUNT(*) OVER() AS "totalCount"
    FROM ${PROPERTY_REQUEST_TABLE_NAME}
    ${whereClause}
    ORDER BY "createdAt" ${sortDir}
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
