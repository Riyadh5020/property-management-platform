import { query } from '../config/database';
import { USER_TABLE_NAME, userDefaults } from '../models/user.model';
import { type User, type CreateUserInput } from '../models/user.model';

import type { CreateUserConflicts, UpdateUserInput, UserLoginRecord } from '../types/user.types';

const findCreateUserConflicts = async (
  email: string,
  phoneNumber: string | null,
): Promise<CreateUserConflicts> => {
  const sql = `
    SELECT
      EXISTS(
        SELECT 1
        FROM ${USER_TABLE_NAME}
        WHERE LOWER(email) = LOWER($1)
          AND "deletedAt" IS NULL
      ) AS "emailExists",
      EXISTS(
        SELECT 1
        FROM ${USER_TABLE_NAME}
        WHERE $2::VARCHAR IS NOT NULL
          AND "phoneNumber" = $2
          AND "deletedAt" IS NULL
      ) AS "phoneNumberExists";
  `;

  const result = await query<CreateUserConflicts>(sql, [email, phoneNumber]);
  const conflicts = result.rows[0];

  if (!conflicts) {
    return { emailExists: false, phoneNumberExists: false };
  }

  return conflicts;
};

const findUserForLogin = async (email: string): Promise<UserLoginRecord | null> => {
  const sql = `
    SELECT
      id,
      "firstName",
      "lastName",
      email,
      "phoneNumber",
      password,
      "profileImageUrl",
      status,
      "isEmailVerified",
      "lastLoginAt",
      "lastLoginIp",
      "failedLoginAttempts",
      "lockedUntil",
      "twoFactorEnabled"
    FROM ${USER_TABLE_NAME}
    WHERE "deletedAt" IS NULL
      AND LOWER(email) = LOWER($1)
    LIMIT 1;
  `;

  const result = await query<UserLoginRecord>(sql, [email]);

  return result.rows[0] ?? null;
};

const findUserById = async (userId: string): Promise<User | null> => {
  const sql = `
    SELECT *
    FROM ${USER_TABLE_NAME}
    WHERE id = $1
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<User>(sql, [userId]);

  return result.rows[0] ?? null;
};

const findUpdateUserConflicts = async (
  userId: string,
  email: string,
  phoneNumber: string | null,
): Promise<CreateUserConflicts> => {
  const sql = `
    SELECT
      EXISTS(
        SELECT 1
        FROM ${USER_TABLE_NAME}
        WHERE LOWER(email) = LOWER($2)
          AND id <> $1
          AND "deletedAt" IS NULL
      ) AS "emailExists",
      EXISTS(
        SELECT 1
        FROM ${USER_TABLE_NAME}
        WHERE $3::VARCHAR IS NOT NULL
          AND "phoneNumber" = $3
          AND id <> $1
          AND "deletedAt" IS NULL
      ) AS "phoneNumberExists";
  `;

  const result = await query<CreateUserConflicts>(sql, [userId, email, phoneNumber]);
  const conflicts = result.rows[0];

  if (!conflicts) {
    return { emailExists: false, phoneNumberExists: false };
  }

  return conflicts;
};

const updateUserLastLogin = async (
  userId: User['id'],
  lastLoginAt: Date,
  lastLoginIp: string | null,
): Promise<void> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET
      "lastLoginAt" = $2,
      "lastLoginIp" = $3,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL;
  `;

  await query(sql, [userId, lastLoginAt, lastLoginIp]);
};

const updateUser = async (userId: string, input: UpdateUserInput): Promise<User | null> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET
      "firstName" = $2,
      "lastName" = $3,
      email = $4,
      "phoneNumber" = $5,
      address = $6,
      "profileImageUrl" = $7,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<User>(sql, [
    userId,
    input.firstName ?? null,
    input.lastName ?? null,
    input.email ?? null,
    input.phoneNumber ?? null,
    input.address ?? null,
    input.profileImageUrl ?? null,
  ]);

  return result.rows[0] ?? null;
};

const createUser = async (input: CreateUserInput): Promise<User> => {
  const sql = `
    INSERT INTO ${USER_TABLE_NAME} (
      "firstName",
      "lastName",
      email,
      "phoneNumber",
      address,
      password,
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
      "deletedAt"
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    RETURNING *;
  `;

  const values = [
    input.firstName,
    input.lastName,
    input.email,
    input.phoneNumber ?? null,
    input.address ?? null,
    input.password,
    input.profileImageUrl ?? null,
    input.status ?? userDefaults.status,
    input.isEmailVerified ?? userDefaults.isEmailVerified,
    input.lastLoginAt ?? null,
    input.lastLoginIp ?? null,
    input.failedLoginAttempts ?? userDefaults.failedLoginAttempts,
    input.lockedUntil ?? null,
    input.twoFactorEnabled ?? userDefaults.twoFactorEnabled,
    input.twoFactorSecret ?? null,
    input.passwordResetToken ?? null,
    input.passwordResetExpiresAt ?? null,
    input.deletedAt ?? null,
  ];

  const result = await query<User>(sql, values);
  const user = result.rows[0];

  if (!user) {
    throw new Error('Failed to create user');
  }

  return user;
};

const updatePasswordResetToken = async (
  userId: string,
  hashedToken: string | null,
  expiresAt: Date | null,
): Promise<void> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET
      "passwordResetToken" = $2,
      "passwordResetExpiresAt" = $3,
      "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL;
  `;

  await query(sql, [userId, hashedToken, expiresAt]);
};

const findByPasswordResetToken = async (hashedToken: string): Promise<User | null> => {
  const sql = `
    SELECT * FROM ${USER_TABLE_NAME}
    WHERE "passwordResetToken" = $1
      AND "passwordResetExpiresAt" > NOW()
      AND "deletedAt" IS NULL
    LIMIT 1;
  `;

  const result = await query<User>(sql, [hashedToken]);
  return result.rows[0] ?? null;
};

const updatePassword = async (userId: string, hashedPassword: string): Promise<User | null> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET password = $2,
        "passwordResetToken" = NULL,
        "passwordResetExpiresAt" = NULL,
        "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<User>(sql, [userId, hashedPassword]);
  return result.rows[0] ?? null;
};

const updateUserStatus = async (userId: string, status: User['status']): Promise<User | null> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET status = $2,
        "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<User>(sql, [userId, status]);
  return result.rows[0] ?? null;
};

const softDeleteUser = async (userId: string): Promise<User | null> => {
  const sql = `
    UPDATE ${USER_TABLE_NAME}
    SET "deletedAt" = NOW(), "updatedAt" = NOW()
    WHERE id = $1
      AND "deletedAt" IS NULL
    RETURNING *;
  `;

  const result = await query<User>(sql, [userId]);
  return result.rows[0] ?? null;
};

const listUsers = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: User[]; total: number }> => {
  const where: string[] = [`"deletedAt" IS NULL`];
  const values: unknown[] = [];

  if (options?.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER("firstName") LIKE $${values.length} OR LOWER("lastName") LIKE $${values.length} OR LOWER(email) LIKE $${values.length})`,
    );
  }

  const allowedSortColumns = new Set([
    'firstName',
    'lastName',
    'email',
    'createdAt',
    'updatedAt',
    'status',
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
    FROM ${USER_TABLE_NAME}
    WHERE ${where.join(' AND ')}
    ORDER BY "${sortBy}" ${sortDir}
    LIMIT $${values.length - 1}
    OFFSET $${values.length};
  `;

  const result = await query<User & { totalCount?: number }>(sql, values);
  const items = result.rows.map((r) => r as User);

  const total = result.rows[0]?.totalCount ?? 0;

  return { items, total };
};

export {
  createUser,
  findCreateUserConflicts,
  findUserForLogin,
  findUserById,
  findUpdateUserConflicts,
  updateUserLastLogin,
  updateUser,
  updatePasswordResetToken,
  findByPasswordResetToken,
  updatePassword,
  updateUserStatus,
  softDeleteUser,
  listUsers,
};
