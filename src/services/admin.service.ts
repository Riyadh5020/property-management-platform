import bcrypt from 'bcryptjs';
import { StatusCodes } from 'http-status-codes';

import { type Admin, type CreateAdminInput } from '../models/admin.model';
import {
  createAdmin as createAdminRepository,
  findAdminById,
  findAdminForLogin,
  findCreateAdminConflicts,
  findUpdateAdminConflicts,
  updateAdmin as updateAdminRepository,
  updateAdminLastLogin,
  updateAdminStatus as updateAdminStatusRepository,
  listAdmins as listAdminsRepository,
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
import { generateRefreshToken } from '../utils/refresh-token';

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

const createAdmin = async (input: CreateAdminInput, actorId: string | null): Promise<Admin> => {
  const conflicts = await findCreateAdminConflicts(input.email, input.phoneNumber ?? null);
  const errors: { path: string; message: string }[] = [];

  if (conflicts.emailExists) {
    errors.push({
      path: 'email',
      message: ERROR_MESSAGES.admin.emailAlreadyExists,
    });
  }

  if (
    input.phoneNumber !== null &&
    input.phoneNumber !== undefined &&
    conflicts.phoneNumberExists
  ) {
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

  const hashedPassword = await bcrypt.hash(input.password, 10);

  // override any client-provided createdBy/updatedBy and set them from the authenticated actor
  const repoInput: CreateAdminInput = {
    ...input,
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

  return updated;
};

export { createAdmin, loginAdmin, updateAdmin, updateAdminStatus, getAdminById, listAdmins };
