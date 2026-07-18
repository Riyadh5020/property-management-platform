import { type ParamsDictionary } from 'express-serve-static-core';

import { type User } from '../models/user.model';

interface LoginUserInput {
  email: string;
  password: string;
  loginIp?: string | null;
}

interface UpdateUserParams extends ParamsDictionary {
  id: string;
}

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string | null;
  address?: string | null;
  profileImageUrl?: string | null;
}

interface UpdateUserRepositoryInput {
  firstName: User['firstName'];
  lastName: User['lastName'];
  email: User['email'];
  phoneNumber: User['phoneNumber'];
  address: User['address'];
  profileImageUrl: User['profileImageUrl'];
}

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

interface ResetPasswordInput {
  token: string;
  password: string;
}

interface CreateUserConflicts {
  emailExists: boolean;
  phoneNumberExists: boolean;
}

type UserLoginRecord = Pick<
  User,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phoneNumber'
  | 'password'
  | 'profileImageUrl'
  | 'status'
  | 'isEmailVerified'
  | 'lastLoginAt'
  | 'lastLoginIp'
  | 'failedLoginAttempts'
  | 'lockedUntil'
  | 'twoFactorEnabled'
>;

type SafeUser = Omit<User, 'password' | 'twoFactorSecret' | 'passwordResetToken'>;

interface LoginUserResponse {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
}

export {
  type LoginUserInput,
  type LoginUserResponse,
  type UserLoginRecord,
  type CreateUserConflicts,
  type ResetPasswordInput,
  type ChangePasswordInput,
  type UpdateUserInput,
  type UpdateUserParams,
  type UpdateUserRepositoryInput,
  type SafeUser,
};
