import { query } from '../config/database';
import { ADMIN_TABLE_NAME } from '../models/admin.model';
import {
  FLOOR_REQUEST_TABLE_NAME,
  type CreateFloorRequestInput,
  type FloorRequest,
  type UpdateFloorRequestInput,
} from '../models/floor-request.model';

const createFloorRequest = async (input: CreateFloorRequestInput): Promise<FloorRequest> => {
  const sql = `
    INSERT INTO ${FLOOR_REQUEST_TABLE_NAME} ("propertyId", "ownerId", "requestedFloorCount", note)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;

  const result = await query<FloorRequest>(sql, [
    input.propertyId,
    input.ownerId,
    input.requestedFloorCount,
    input.note,
  ]);
  const request = result.rows[0];

  if (!request) {
    throw new Error('Failed to create floor request');
  }

  return request;
};

const updateFloorRequest = async (
  requestId: FloorRequest['id'],
  input: UpdateFloorRequestInput,
): Promise<FloorRequest | null> => {
  const sql = `
    UPDATE ${FLOOR_REQUEST_TABLE_NAME}
    SET
      status = COALESCE($2, status),
      "reviewedBy" = COALESCE($3, "reviewedBy"),
      "reviewedAt" = COALESCE($4, "reviewedAt"),
      "consumedAt" = COALESCE($5, "consumedAt"),
      "updatedAt" = NOW()
    WHERE id = $1
    RETURNING *;
  `;

  const result = await query<FloorRequest>(sql, [
    requestId,
    input.status ?? null,
    input.reviewedBy ?? null,
    input.reviewedAt ?? null,
    input.consumedAt ?? null,
  ]);

  return result.rows[0] ?? null;
};

const getFloorRequestById = async (requestId: FloorRequest['id']): Promise<FloorRequest | null> => {
  const sql = `SELECT * FROM ${FLOOR_REQUEST_TABLE_NAME} WHERE id = $1 LIMIT 1;`;
  const result = await query<FloorRequest>(sql, [requestId]);
  return result.rows[0] ?? null;
};

const findPendingRequestForProperty = async (
  propertyId: FloorRequest['propertyId'],
): Promise<FloorRequest | null> => {
  const sql = `
    SELECT *
    FROM ${FLOOR_REQUEST_TABLE_NAME}
    WHERE "propertyId" = $1
      AND status = 'pending'
    LIMIT 1;
  `;

  const result = await query<FloorRequest>(sql, [propertyId]);
  return result.rows[0] ?? null;
};

const getAllFloorRequests = async (options?: {
  limit?: number;
  offset?: number;
  status?: FloorRequest['status'];
  ownerId?: string;
  propertyId?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: FloorRequest[]; total: number }> => {
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

  if (options?.propertyId) {
    values.push(options.propertyId);
    where.push(`r."propertyId" = $${values.length}`);
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
    FROM ${FLOOR_REQUEST_TABLE_NAME} r
    LEFT JOIN ${ADMIN_TABLE_NAME} a ON a.id = r."ownerId"
    ${whereClause}
    ORDER BY r."createdAt" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<FloorRequest & { totalCount?: number }>(sql, values);
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
  createFloorRequest,
  findPendingRequestForProperty,
  getAllFloorRequests,
  getFloorRequestById,
  updateFloorRequest,
};
