export const ADMIN_TABLE_NAME = 'admins';

export const adminRoles = ['superAdmin', 'admin', 'manager', 'support'] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminStatuses = ['active', 'inactive', 'suspended', 'pending'] as const;
export type AdminStatus = (typeof adminStatuses)[number];

type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type AdminPermissions = JsonValue | null;

export type Uuid = `${string}-${string}-${string}-${string}-${string}`;
export type AdminId = Uuid;

export interface Admin {
  id: AdminId;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  password: string;
  role: AdminRole;
  permissions: AdminPermissions;
  profileImageUrl: string | null;
  status: AdminStatus;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  createdBy: AdminId | null;
  updatedBy: AdminId | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateAdminInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  password: string;
  role: AdminRole;
  permissions?: AdminPermissions;
  profileImageUrl?: string | null;
  status?: AdminStatus;
  isEmailVerified?: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: Date | null;
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
  deletedAt?: Date | null;
}

export interface UpdateAdminInput extends Partial<Omit<Admin, 'id' | 'createdAt'>> {
  updatedAt?: Date;
}

export const adminDefaults = {
  isEmailVerified: false,
  failedLoginAttempts: 0,
  twoFactorEnabled: false,
  status: 'pending' as AdminStatus,
} as const;

const adminRoleCheck = adminRoles.map((role) => `'${role}'`).join(', ');
const adminStatusCheck = adminStatuses.map((status) => `'${status}'`).join(', ');

export const createAdminTableSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ${ADMIN_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  "phoneNumber" VARCHAR(30),
  password VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN (${adminRoleCheck})),
  permissions JSONB,
  "profileImageUrl" VARCHAR(2048),
  status VARCHAR(32) NOT NULL DEFAULT '${adminDefaults.status}' CHECK (status IN (${adminStatusCheck})),
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT ${adminDefaults.isEmailVerified},
  "lastLoginAt" TIMESTAMPTZ,
  "lastLoginIp" VARCHAR(45),
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT ${adminDefaults.failedLoginAttempts},
  "lockedUntil" TIMESTAMPTZ,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT ${adminDefaults.twoFactorEnabled},
  "twoFactorSecret" VARCHAR(255),
  "passwordResetToken" VARCHAR(255),
  "passwordResetExpiresAt" TIMESTAMPTZ,
  "createdBy" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createAdminIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unique_active_idx ON ${ADMIN_TABLE_NAME} (LOWER(email)) WHERE "deletedAt" IS NULL;`,
];
