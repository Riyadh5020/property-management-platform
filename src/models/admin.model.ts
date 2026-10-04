import { ADMIN_TABLE_NAME } from '../constants/database';
import { adminRoles, adminStatuses } from '../enums/admin.enum';
import { type JsonValue, type Uuid } from '../utils/common';

export { ADMIN_TABLE_NAME };

export type AdminRole = (typeof adminRoles)[number];
export type AdminStatus = (typeof adminStatuses)[number];

export type AdminPermissions = JsonValue | null;
export type AdminId = Uuid;

export interface Admin {
  id: AdminId;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  password: string;
  role: AdminRole;
  ownerId: AdminId | null;
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
  tokenVersion: number;
  refreshTokenVersion: number;
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
  ownerId?: AdminId | null; // NEW
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
  isEmailVerified: true,
  failedLoginAttempts: 0,
  twoFactorEnabled: false,
  status: 'active' as AdminStatus,
  tokenVersion: 0,
  refreshTokenVersion: 0,
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
  "ownerId" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE CASCADE,
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
  "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "refreshTokenVersion" INTEGER NOT NULL DEFAULT 0,
  "createdBy" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createAdminIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS admins_email_unique_active_idx ON ${ADMIN_TABLE_NAME} (LOWER(email)) WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS admins_owner_id_idx ON ${ADMIN_TABLE_NAME} ("ownerId") WHERE "deletedAt" IS NULL;`, // NEW
];
