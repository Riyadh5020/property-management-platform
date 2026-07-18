export const USER_TABLE_NAME = 'users';

export const userStatuses = ['active', 'inactive', 'suspended', 'pending'] as const;
export type UserStatus = (typeof userStatuses)[number];

export type Uuid = `${string}-${string}-${string}-${string}-${string}`;
export type UserId = Uuid;

export interface User {
  id: UserId;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string | null;
  address: string | null;
  password: string;
  profileImageUrl: string | null;
  status: UserStatus;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string | null;
  address?: string | null;
  password: string;
  profileImageUrl?: string | null;
  status?: UserStatus;
  isEmailVerified?: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpiresAt?: Date | null;
  deletedAt?: Date | null;
}

export interface UpdateUserInput extends Partial<Omit<User, 'id' | 'createdAt'>> {
  updatedAt?: Date;
}

export const userDefaults = {
  isEmailVerified: false,
  failedLoginAttempts: 0,
  twoFactorEnabled: false,
  status: 'pending' as UserStatus,
} as const;

const userStatusCheck = userStatuses.map((s) => `'${s}'`).join(', ');

export const createUserTableSql = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ${USER_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  "phoneNumber" VARCHAR(30),
  address VARCHAR(1024),
  password VARCHAR(255) NOT NULL,
  "profileImageUrl" VARCHAR(2048),
  status VARCHAR(32) NOT NULL DEFAULT '${userDefaults.status}' CHECK (status IN (${userStatusCheck})),
  "isEmailVerified" BOOLEAN NOT NULL DEFAULT ${userDefaults.isEmailVerified},
  "lastLoginAt" TIMESTAMPTZ,
  "lastLoginIp" VARCHAR(45),
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT ${userDefaults.failedLoginAttempts},
  "lockedUntil" TIMESTAMPTZ,
  "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT ${userDefaults.twoFactorEnabled},
  "twoFactorSecret" VARCHAR(255),
  "passwordResetToken" VARCHAR(255),
  "passwordResetExpiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createUserIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active_idx ON ${USER_TABLE_NAME} (LOWER(email)) WHERE "deletedAt" IS NULL;`,
];
