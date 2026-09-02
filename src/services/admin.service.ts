import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';

import {
  type Admin,
  type AdminId,
  type AdminRole,
  type CreateAdminInput,
} from '../models/admin.model';
import {
  createAdmin as createAdminRepository,
  findAdminByEmail,
  findAdminById,
  findAdminForLogin,
  findCreateAdminConflicts,
  findUpdateAdminConflicts,
  incrementAdminRefreshTokenVersion,
  incrementAdminTokenVersion,
  listAdmins as listAdminsRepository,
  resetAdminPassword as resetAdminPasswordRepository,
  setAdminPasswordResetCode,
  updateAdminLastLogin,
  updateAdmin as updateAdminRepository,
  updateAdminStatus as updateAdminStatusRepository,
} from '../repositories/admin.repository';
import { ERROR_MESSAGES } from '../shared/error-messages';
import {
  type LoginAdminInput,
  type LoginAdminResponse,
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminRepositoryInput,
} from '../types/admin.types';
import { createResponseError } from '../utils/app-response';
import { generateJwtToken, UserType } from '../utils/jwt';
import { sendPasswordResetEmail } from '../utils/mailer';
import { generateRefreshToken, verifyRefreshToken } from '../utils/refresh-token';

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

const createAdmin = async (
  input: CreateAdminInput,
  actorId: string | null,
  actorRole: AdminRole | null,
): Promise<Admin> => {
  // Enforce the creation hierarchy — server decides role & ownerId, client input for these is discarded
  let targetRole: AdminRole;
  let ownerId: AdminId | null;

  if (actorRole === 'superAdmin') {
    targetRole = 'owner';
    ownerId = null;
  } else if (actorRole === 'owner') {
    targetRole = 'manager';
    ownerId = actorId as unknown as AdminId;
  } else {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.unauthorized,
    });
  }

  const conflicts = await findCreateAdminConflicts(input.email, input.phoneNumber ?? null);
  const errors: { path: string; message: string }[] = [];

  if (conflicts.emailExists) {
    errors.push({ path: 'email', message: ERROR_MESSAGES.admin.emailAlreadyExists });
  }

  if (
    input.phoneNumber !== null &&
    input.phoneNumber !== undefined &&
    conflicts.phoneNumberExists
  ) {
    errors.push({ path: 'phoneNumber', message: ERROR_MESSAGES.admin.phoneNumberAlreadyExists });
  }

  if (errors.length > 0) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: ERROR_MESSAGES.admin.adminAlreadyExists,
      errors,
    });
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const repoInput: CreateAdminInput = {
    ...input,
    role: targetRole, // override client value
    ownerId, // override client value
    password: hashedPassword,
    createdBy: actorId as unknown as CreateAdminInput['createdBy'],
    updatedBy: actorId as unknown as CreateAdminInput['updatedBy'],
  };

  return await createAdminRepository(repoInput);
};

const updateAdmin = async (
  adminId: UpdateAdminParams['id'],
  input: UpdateAdminInput,
): Promise<Admin> => {
  const existingAdmin = await findAdminById(adminId);

  if (!existingAdmin) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.admin.adminNotFound,
    });
  }

  // If an acting admin id is provided, validate it and enforce privilege rules
  if (Object.prototype.hasOwnProperty.call(input, 'updatedBy') && input.updatedBy) {
    const actingAdmin = await getAdminById(input.updatedBy);

    if (!actingAdmin) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // Only a superAdmin can update any admin; otherwise the acting admin must be updating themselves
    if (actingAdmin.role !== 'superAdmin' && actingAdmin.id !== adminId) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // Only a superAdmin may assign the 'superAdmin' role to another admin
    if (input.role === 'superAdmin' && actingAdmin.role !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }
  }

  const updatePayload: UpdateAdminRepositoryInput = {
    firstName: input.firstName ?? existingAdmin.firstName,
    lastName: input.lastName ?? existingAdmin.lastName,
    email: input.email ?? existingAdmin.email,
    phoneNumber: Object.prototype.hasOwnProperty.call(input, 'phoneNumber')
      ? (input.phoneNumber ?? null)
      : existingAdmin.phoneNumber,
    role: input.role ?? existingAdmin.role,
    permissions: Object.prototype.hasOwnProperty.call(input, 'permissions')
      ? (input.permissions ?? null)
      : existingAdmin.permissions,
    profileImageUrl: Object.prototype.hasOwnProperty.call(input, 'profileImageUrl')
      ? (input.profileImageUrl ?? null)
      : existingAdmin.profileImageUrl,
    status: input.status ?? existingAdmin.status,
    isEmailVerified: input.isEmailVerified ?? existingAdmin.isEmailVerified,
    twoFactorEnabled: input.twoFactorEnabled ?? existingAdmin.twoFactorEnabled,
    updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
      ? (input.updatedBy ?? null)
      : existingAdmin.updatedBy,
  };

  const conflicts = await findUpdateAdminConflicts(
    adminId,
    updatePayload.email,
    updatePayload.phoneNumber,
  );
  const errors: { path: string; message: string }[] = [];

  if (conflicts.emailExists) {
    errors.push({
      path: 'email',
      message: ERROR_MESSAGES.admin.emailAlreadyExists,
    });
  }

  if (updatePayload.phoneNumber !== null && conflicts.phoneNumberExists) {
    errors.push({
      path: 'phoneNumber',
      message: ERROR_MESSAGES.admin.phoneNumberAlreadyExists,
    });
  }

  if (errors.length > 0) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: ERROR_MESSAGES.admin.adminAlreadyExists,
      errors,
    });
  }

  const admin = await updateAdminRepository(adminId, updatePayload);

  if (!admin) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.admin.adminNotFound,
    });
  }

  return admin;
};

const getAdminById = async (adminId: UpdateAdminParams['id']): Promise<Admin | null> => {
  return await findAdminById(adminId);
};

const listAdmins = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{
  items: Omit<Admin, 'password' | 'twoFactorSecret' | 'passwordResetToken'>[];
  total: number;
}> => {
  const { items, total } = await listAdminsRepository(options);

  const safeItems = items.map((a) => {
    // remove sensitive fields (prefix removed fields with _ to satisfy unused-var rules)
    const {
      password: _password,
      twoFactorSecret: _twoFactorSecret,
      passwordResetToken: _passwordResetToken,
      ...safeAdmin
    } = a;
    return safeAdmin;
  });

  return { items: safeItems, total };
};

const loginAdmin = async (input: LoginAdminInput): Promise<LoginAdminResponse> => {
  const admin = await findAdminForLogin(input.email);

  if (!admin) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.admin.invalidCredentials,
      errors: [{ path: 'email', message: ERROR_MESSAGES.admin.invalidCredentials }],
    });
  }

  if (admin.status === 'inactive') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.accountInactive,
    });
  }

  if (admin.status === 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.accountPending,
    });
  }

  if (admin.status === 'suspended') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.accountSuspended,
    });
  }

  if (admin.lockedUntil instanceof Date && admin.lockedUntil.getTime() > Date.now()) {
    throw createResponseError({
      statusCode: StatusCodes.LOCKED,
      message: ERROR_MESSAGES.admin.accountLocked,
    });
  }

  const isPasswordValid = await bcrypt.compare(input.password, admin.password);

  if (!isPasswordValid) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: ERROR_MESSAGES.admin.invalidCredentials,
    });
  }

  const lastLoginAt = new Date();
  const lastLoginIp = normalizeLoginIp(input.loginIp);

  await updateAdminLastLogin(admin.id, lastLoginAt, lastLoginIp);

  const { password: _password, ...safeAdmin } = admin;
  const payload = {
    id: admin.id,
    userType: UserType.ADMIN,
    adminType: admin.role,
    ownerId: admin.ownerId,
    tokenVersion: admin.tokenVersion,
    refreshTokenVersion: admin.refreshTokenVersion,
  };
  const accessToken = generateJwtToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    admin: {
      ...safeAdmin,
      lastLoginAt,
      lastLoginIp,
    },
  };
};

const updateAdminStatus = async (
  adminId: UpdateAdminParams['id'],
  status: Admin['status'],
  actingAdminId: Admin['id'] | null,
): Promise<Admin> => {
  const existingAdmin = await findAdminById(adminId);

  if (!existingAdmin) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.admin.adminNotFound,
    });
  }

  // If an acting admin id is provided, validate it and enforce privilege rules
  if (actingAdminId) {
    const actingAdmin = await getAdminById(actingAdminId);

    if (!actingAdmin) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // Only a superAdmin can update any admin; otherwise the acting admin must be updating themselves
    if (actingAdmin.role !== 'superAdmin' && actingAdmin.id !== adminId) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // Prevent an admin from deactivating/suspending themselves (require superAdmin)
    if (actingAdmin.id === adminId && status !== 'active' && actingAdmin.role !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }
  }

  const updated = await updateAdminStatusRepository(adminId, status, actingAdminId ?? null);

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.admin.adminNotFound,
    });
  }

  // Any status change (active/suspended/inactive) invalidates existing tokens —
  // forces re-login and closes the "suspended admin keeps working until token expiry" gap.
  if (status !== 'active') {
    await incrementAdminTokenVersion(adminId as unknown as AdminId);
  }

  return updated;
};

const logoutAdmin = async (adminId: AdminId): Promise<void> => {
  await incrementAdminTokenVersion(adminId);
  await incrementAdminRefreshTokenVersion(adminId);
};

const RESET_CODE_LENGTH = 6;
const RESET_CODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour — matches the email copy in mailer.ts

const generateResetCode = (): string => {
  const min = 10 ** (RESET_CODE_LENGTH - 1);
  const max = 10 ** RESET_CODE_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
};

const forgotAdminPassword = async (email: string): Promise<void> => {
  const admin = await findAdminByEmail(email);

  // Always behave identically whether the email exists or not — don't leak who's registered
  if (admin?.status !== 'active') {
    return;
  }

  const code = generateResetCode();
  const hashedCode = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MS);

  await setAdminPasswordResetCode(admin.id, hashedCode, expiresAt);
  await sendPasswordResetEmail(admin.email, code);
};

const resetAdminPassword = async (
  email: string,
  code: string,
  newPassword: string,
): Promise<void> => {
  const admin = await findAdminByEmail(email);
  const invalidCodeError = createResponseError({
    statusCode: StatusCodes.BAD_REQUEST,
    message: 'Invalid or expired reset code',
  });

  if (!admin?.passwordResetToken || !admin.passwordResetExpiresAt) {
    throw invalidCodeError;
  }

  if (admin.passwordResetExpiresAt.getTime() < Date.now()) {
    throw invalidCodeError;
  }

  const isCodeValid = await bcrypt.compare(code, admin.passwordResetToken);

  if (!isCodeValid) {
    throw invalidCodeError;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await resetAdminPasswordRepository(admin.id, hashedPassword);
};

const refreshAdminAccessToken = async (
  refreshTokenValue: string,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const payload = verifyRefreshToken(refreshTokenValue);

  // payload.userType comes from a decoded JWT (untrusted external input) — the
  // comparison is a real runtime safety check even though TS's literal-type
  // narrowing makes it look impossible at compile time.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (payload.userType !== UserType.ADMIN) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'Invalid refresh token',
    });
  }

  const admin = await findAdminById(payload.id);

  if (!admin) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'Invalid refresh token',
    });
  }

  // Reject if this refresh token was already used/rotated, or the admin
  // was suspended/logged-out since it was issued.
  if ((payload.refreshTokenVersion ?? 0) !== admin.refreshTokenVersion) {
    throw createResponseError({
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'Invalid refresh token',
    });
  }

  if (admin.status !== 'active') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.accountSuspended,
    });
  }

  // Rotate: bump refreshTokenVersion so this exact refresh token can never be used again
  await incrementAdminRefreshTokenVersion(admin.id);

  const newPayload = {
    id: admin.id,
    userType: UserType.ADMIN,
    adminType: admin.role,
    ownerId: admin.ownerId,
    tokenVersion: admin.tokenVersion,
    refreshTokenVersion: admin.refreshTokenVersion + 1,
  };

  const accessToken = generateJwtToken(newPayload);
  const newRefreshToken = generateRefreshToken(newPayload);

  return { accessToken, refreshToken: newRefreshToken };
};

export {
  createAdmin,
  forgotAdminPassword,
  getAdminById,
  listAdmins,
  loginAdmin,
  logoutAdmin,
  refreshAdminAccessToken,
  resetAdminPassword,
  updateAdmin,
  updateAdminStatus,
};
