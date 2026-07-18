import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';

import { type CreateUserInput, type User, userDefaults } from '../models/user.model';
import {
  createUser as createUserRepository,
  findCreateUserConflicts,
  findUserForLogin,
  findUserById,
  findUpdateUserConflicts,
  updateUserLastLogin,
  updateUser,
  updatePasswordResetToken,
  findByPasswordResetToken,
  updatePassword,
  updateUserStatus as updateUserStatusRepository,
  softDeleteUser,
  listUsers as listUsersRepository,
} from '../repositories/user.repository';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';
import { generateJwtToken, UserType, type JwtPayload } from '../utils/jwt';
import { generateRefreshToken } from '../utils/refresh-token';

import type {
  LoginUserInput,
  LoginUserResponse,
  UpdateUserInput,
  SafeUser,
} from '../types/user.types';

const normalizeLoginIp = (ip: string | null | undefined): string | null => {
  if (!ip) {
    return null;
  }

  if (ip === '::1') {
    return '127.0.0.1';
  }

  if (ip.startsWith('::ffff:')) {
    return ip.slice('::ffff:'.length);
  }

  return ip;
};

const registerUser = async (input: CreateUserInput): Promise<User> => {
  const conflicts = await findCreateUserConflicts(input.email, input.phoneNumber ?? null);
  const errors: { path: string; message: string }[] = [];

  if (conflicts.emailExists) {
    errors.push({ path: 'email', message: ERROR_MESSAGES.user.emailAlreadyExists });
  }

  if (input.phoneNumber !== null && conflicts.phoneNumberExists) {
    errors.push({ path: 'phoneNumber', message: ERROR_MESSAGES.user.phoneNumberAlreadyExists });
  }

  if (errors.length > 0) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: ERROR_MESSAGES.user.userAlreadyExists,
      errors,
    });
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const repoInput: CreateUserInput = {
    ...input,
    password: hashedPassword,
    status: input.status ?? userDefaults.status,
    isEmailVerified: input.isEmailVerified ?? userDefaults.isEmailVerified,
  };

  const user = await createUserRepository(repoInput);
  // NOTE: generate email verification token & send email via email service (left to integrator)
  return user;
};

const loginUser = async (input: LoginUserInput): Promise<LoginUserResponse> => {
  const user = await findUserForLogin(input.email);

  if (!user) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.invalidCredentials,
      errors: [{ path: 'email', message: ERROR_MESSAGES.user.invalidCredentials }],
    });
  }

  if (user.status === 'inactive') {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.accountInactive,
    });
  }

  if (user.status === 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.emailNotVerified,
    });
  }

  if (user.status === 'suspended') {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.accountSuspended,
    });
  }

  if (user.lockedUntil instanceof Date && user.lockedUntil.getTime() > Date.now()) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.accountLocked,
    });
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    // NOTE: increment failed attempts logic omitted here; repository could implement increment
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.invalidCredentials,
      errors: [{ path: 'email', message: ERROR_MESSAGES.user.invalidCredentials }],
    });
  }

  const lastLoginAt = new Date();
  const lastLoginIp = normalizeLoginIp(input.loginIp);

  await updateUserLastLogin(user.id, lastLoginAt, lastLoginIp);

  const {
    password: _password,
    twoFactorSecret: _twoFactorSecret,
    passwordResetToken: _passwordResetToken,
    ...safeUser
  } = user as User;

  const payload: JwtPayload = { id: user.id, userType: UserType.USER };
  const accessToken = generateJwtToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      ...safeUser,
      lastLoginAt,
      lastLoginIp,
    },
  };
};

const forgotPassword = async (email: string): Promise<void> => {
  const user = await findUserForLogin(email);

  if (!user) {
    // Do not reveal whether user exists
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

  await updatePasswordResetToken(user.id, hashed, expiresAt);

  // send email with raw token via email service (left to integrator)
};

const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  const user = await findByPasswordResetToken(hashed);

  if (!user) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: ERROR_MESSAGES.user.invalidOrExpiredResetToken,
    });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await updatePassword(user.id, hashedPassword);
};

const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const user = await findUserById(userId);

  if (!user) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);

  if (!isValid) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.user.invalidCredentials,
    });
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await updatePassword(userId, hashed);
};

const getUserById = async (userId: string): Promise<User | null> => {
  return await findUserById(userId);
};

const updateProfile = async (userId: string, input: UpdateUserInput): Promise<User> => {
  const existing = await findUserById(userId);

  if (!existing) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  const updatePayload = {
    firstName: input.firstName ?? existing.firstName,
    lastName: input.lastName ?? existing.lastName,
    email: input.email ?? existing.email,
    phoneNumber: Object.prototype.hasOwnProperty.call(input, 'phoneNumber')
      ? (input.phoneNumber ?? null)
      : existing.phoneNumber,
    address: Object.prototype.hasOwnProperty.call(input, 'address')
      ? (input.address ?? null)
      : existing.address,
    profileImageUrl: Object.prototype.hasOwnProperty.call(input, 'profileImageUrl')
      ? (input.profileImageUrl ?? null)
      : existing.profileImageUrl,
  };

  const conflicts = await findUpdateUserConflicts(
    userId,
    updatePayload.email,
    updatePayload.phoneNumber,
  );
  const errors: { path: string; message: string }[] = [];

  if (conflicts.emailExists) {
    errors.push({ path: 'email', message: ERROR_MESSAGES.user.emailAlreadyExists });
  }

  if (updatePayload.phoneNumber !== null && conflicts.phoneNumberExists) {
    errors.push({ path: 'phoneNumber', message: ERROR_MESSAGES.user.phoneNumberAlreadyExists });
  }

  if (errors.length > 0) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: ERROR_MESSAGES.user.userAlreadyExists,
      errors,
    });
  }

  const updated = await updateUser(userId, updatePayload);

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  return updated;
};

const deleteMe = async (userId: string): Promise<User> => {
  const deleted = await softDeleteUser(userId);

  if (!deleted) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  return deleted;
};

const listUsers = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: SafeUser[]; total: number }> => {
  const { items, total } = await listUsersRepository(options);

  const safeItems = items.map((u) => {
    const {
      password: _password,
      twoFactorSecret: _twoFactorSecret,
      passwordResetToken: _passwordResetToken,
      ...safe
    } = u;
    return safe;
  });

  return { items: safeItems, total };
};

const updateUserStatus = async (userId: string, status: User['status']): Promise<User> => {
  const existing = await findUserById(userId);

  if (!existing) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  const updated = await updateUserStatusRepository(userId, status);

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.user.userNotFound,
    });
  }

  return updated;
};

export {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
  getUserById,
  updateProfile,
  deleteMe,
  listUsers,
  updateUserStatus,
};
