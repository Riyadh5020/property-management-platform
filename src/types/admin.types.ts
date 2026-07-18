import { type ParamsDictionary } from 'express-serve-static-core';

import { type Admin } from '../models/admin.model';

interface LoginAdminInput {
  email: string;
  password: string;
  loginIp?: string | null;
}

interface UpdateAdminParams extends ParamsDictionary {
  id: string;
}

interface UpdateAdminInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  role?: Admin['role'];
  permissions?: Admin['permissions'];
  profileImageUrl?: string | null;
  status?: Admin['status'];
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
  updatedBy?: Admin['id'] | null;
}

interface UpdateAdminRepositoryInput {
  firstName: Admin['firstName'];
  lastName: Admin['lastName'];
  email: Admin['email'];
  phoneNumber: Admin['phoneNumber'];
  role: Admin['role'];
  permissions: Admin['permissions'];
  profileImageUrl: Admin['profileImageUrl'];
  status: Admin['status'];
  isEmailVerified: Admin['isEmailVerified'];
  twoFactorEnabled: Admin['twoFactorEnabled'];
  updatedBy: Admin['updatedBy'];
}

interface UpdateAdminStatusInput {
  status: Admin['status'];
  updatedBy?: Admin['id'] | null;
}

interface UpdateAdminStatusParams extends ParamsDictionary {
  id: string;
}

interface CreateAdminConflicts {
  emailExists: boolean;
  phoneNumberExists: boolean;
}

type AdminLoginRecord = Pick<
  Admin,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'password'
  | 'role'
  | 'permissions'
  | 'profileImageUrl'
  | 'status'
  | 'isEmailVerified'
  | 'lastLoginAt'
  | 'lastLoginIp'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'twoFactorEnabled'
>;

type SafeAdmin = Pick<
  Admin,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'role'
  | 'permissions'
  | 'profileImageUrl'
  | 'status'
  | 'isEmailVerified'
  | 'lastLoginAt'
  | 'lastLoginIp'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'twoFactorEnabled'
>;

interface LoginAdminResponse {
  accessToken: string;
  refreshToken: string;
  admin: SafeAdmin;
}

export {
  type AdminLoginRecord,
  type CreateAdminConflicts,
  type LoginAdminInput,
  type LoginAdminResponse,
  type SafeAdmin,
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminRepositoryInput,
  type UpdateAdminStatusInput,
  type UpdateAdminStatusParams,
};
