import { query } from '../config/database';
import {
  ADMIN_TABLE_NAME,
  adminDefaults,
  type Admin,
  type CreateAdminInput,
} from '../models/admin.model';
import {
  type AdminLoginRecord,
  type CreateAdminConflicts,
  type UpdateAdminParams,
  type UpdateAdminRepositoryInput,
} from '../types/admin.types';

const findCreateAdminConflicts = async (
  email: string,
  phoneNumber: string | null,
): Promise<CreateAdminConflicts> => {
  const sql = `
    SELECT
      EXISTS(
        SELECT 1
        FROM ${ADMIN_TABLE_NAME}
        WHERE LOWER(email) = LOWER($1)
          AND "deletedAt" IS NULL
      ) AS "emailExists",
      EXISTS(
        SELECT 1
        FROM ${ADMIN_TABLE_NAME}
        WHERE $2::VARCHAR IS NOT NULL
          AND "phoneNumber" = $2
          AND "deletedAt" IS NULL
      ) AS "phoneNumberExists";
  `;

  const result = await query<CreateAdminConflicts>(sql, [email, phoneNumber]);
  const conflicts = result.rows[0];

  if (!conflicts) {
    return {
      emailExists: false,
      phoneNumberExists: false,
    };
  }

  return conflicts;
};

const findAdminForLogin = async (email: string): Promise<AdminLoginRecord | null> => {
  const sql = `
    SELECT
      id,
      "firstName",
      "lastName",
      email,
      "phoneNumber",
      password,
      role,
      permissions,
      "profileImageUrl",
      status,
      "isEmailVerified",
      "lastLoginAt",
      "lastLoginIp",
      "failedLoginAttempts",
      "lockedUntil",
      "twoFactorEnabled"
    FROM ${ADMIN_TABLE_NAME}
    WHERE "deletedAt" IS NULL
      AND LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const result = await query<AdminLoginRecord>(sql, [email]);

  return result.rows[0] ?? null;
};

const findAdminById = async (adminId: UpdateAdminParams['id']): Promise<Admin | null> => {
  const sql = `
    SELECT *
    FROM ${ADMIN_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<Admin>(sql, [adminId]);

  return result.rows[0] ?? null;
};

const findUpdateAdminConflicts = async (
  adminId: UpdateAdminParams['id'],
  email: string,
  phoneNumber: string | null,
): Promise<CreateAdminConflicts> => {
  const sql = `
    SELECT
      EXISTS(
        SELECT 1
        FROM ${ADMIN_TABLE_NAME}
        WHERE LOWER(email) = LOWER($2)
          AND id <> $1
          AND "deletedAt" IS NULL
      ) AS "emailExists",
      EXISTS(
        SELECT 1
        FROM ${ADMIN_TABLE_NAME}
        WHERE $3::VARCHAR IS NOT NULL
          AND "phoneNumber" = $3
          AND id <> $1
          AND "deletedAt" IS NULL
      ) AS "phoneNumberExists";
  `;

  const result = await query<CreateAdminConflicts>(sql, [adminId, email, phoneNumber]);
  const conflicts = result.rows[0];

  if (!conflicts) {
    return {
      emailExists: false,
      phoneNumberExists: false,
    };
  }

  return conflicts;
};

const updateAdminLastLogin = async (
  adminId: Admin['id'],
  lastLoginAt: Date,
  lastLoginIp: string | null,
): Promise<void> => {
  const sql = `
    UPDATE ${ADMIN_TABLE_NAME}
    SET
      "lastLoginAt" = $2,
      "lastLoginIp" = $3,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL;
  `;

  await query(sql, [adminId, lastLoginAt, lastLoginIp]);
};

const updateAdmin = async (
  adminId: UpdateAdminParams['id'],
  input: UpdateAdminRepositoryInput,
): Promise<Admin | null> => {
  const sql = `
    UPDATE ${ADMIN_TABLE_NAME}
    SET
      "firstName" = $2,
      "lastName" = $3,
      email = $4,
      "phoneNumber" = $5,
      role = $6,
      permissions = $7,
      "profileImageUrl" = $8,
      status = $9,
      "isEmailVerified" = $10,
      "twoFactorEnabled" = $11,
      "updatedBy" = $12,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Admin>(sql, [
    adminId,
    input.firstName,
    input.lastName,
    input.email,
    input.phoneNumber,
    input.role,
    input.permissions,
    input.profileImageUrl,
    input.status,
    input.isEmailVerified,
    input.twoFactorEnabled,
    input.updatedBy,
  ]);

  return result.rows[0] ?? null;
};

const createAdmin = async (input: CreateAdminInput): Promise<Admin> => {
  const sql = `
    INSERT INTO ${ADMIN_TABLE_NAME} (
      "firstName",
      "lastName",
      email,
      "phoneNumber",
      password,
      role,
      permissions,
      "profileImageUrl",
      status,
      "isEmailVerified",
      "lastLoginAt",
      "lastLoginIp",
      "failedLoginAttempts",
      "lockedUntil",
      "twoFactorEnabled",
      "twoFactorSecret",
      "passwordResetToken",
      "passwordResetExpiresAt",
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
      $21
    )
    RETURNING *;
  `;

  const values = [
    input.firstName,
    input.lastName,
    input.email,
    input.phoneNumber ?? null,
    input.password,
    input.role,
    input.permissions ?? null,
    input.profileImageUrl ?? null,
    input.status ?? adminDefaults.status,
    input.isEmailVerified ?? adminDefaults.isEmailVerified,
    input.lastLoginAt ?? null,
    input.lastLoginIp ?? null,
    input.failedLoginAttempts ?? adminDefaults.failedLoginAttempts,
    input.lockedUntil ?? null,
    input.twoFactorEnabled ?? adminDefaults.twoFactorEnabled,
    input.twoFactorSecret ?? null,
    input.passwordResetToken ?? null,
    input.passwordResetExpiresAt ?? null,
    input.createdBy ?? null,
    input.updatedBy ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<Admin>(sql, values);
  const admin = result.rows[0];

  if (!admin) {
    throw new Error('Failed to create admin');
  }

  return admin;
};

const updateAdminStatus = async (
  adminId: UpdateAdminParams['id'],
  status: Admin['status'],
  updatedBy: Admin['id'] | null,
): Promise<Admin | null> => {
  const sql = `
    UPDATE ${ADMIN_TABLE_NAME}
    SET
      status = $2,
      "updatedBy" = $3,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<Admin>(sql, [adminId, status, updatedBy]);

  return result.rows[0] ?? null;
};

export {
  createAdmin,
  findAdminById,
  findAdminForLogin,
  findCreateAdminConflicts,
  findUpdateAdminConflicts,
  updateAdmin,
  updateAdminLastLogin,
  updateAdminStatus,
};

const listAdmins = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Admin[]; total: number }> => {
  const where: string[] = [`"deletedAt" IS NULL`];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER("firstName") ILIKE $${values.length} OR LOWER("lastName") ILIKE $${values.length} OR LOWER(email) ILIKE $${values.length})`,
    );
  }

  const allowedSortColumns = new Set([
    'firstName',
    'lastName',
    'email',
    'createdAt',
    'updatedAt',
    'status',
    'role',
  ]);

  const sortBy =
    options?.sortBy && allowedSortColumns.has(options.sortBy) ? options.sortBy : 'createdAt';
  const sortDir = options?.sortDir === 'asc' ? 'ASC' : 'DESC';

  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  values.push(limit);
  values.push(offset);

  const sql = `
    SELECT *, COUNT(*) OVER() AS "totalCount"
    FROM ${ADMIN_TABLE_NAME}
    WHERE ${where.join(' AND ')}
    ORDER BY "${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<Admin & { totalCount?: number }>(sql, values);
  const items = result.rows.map((r) => {
    const { totalCount: _totalCount, ...admin } = r;
    return admin;
  });

  const total = result.rows[0]?.totalCount ?? 0;

  return { items, total };
};

export { listAdmins };
