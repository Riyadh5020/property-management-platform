import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { adminRoles, adminStatuses } from '../models/admin.model';
import { ERROR_MESSAGES } from '../shared/error-messages';
import {
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminStatusInput,
  type UpdateAdminStatusParams,
} from '../types/admin.types';
import { createResponseError } from '../utils/app-response';
import { UserType, verifyJwtToken } from '../utils/jwt';

import { validate } from './validate';

const jsonValueSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const nullableDateInputSchema = z
  .union([z.date(), z.string().datetime({ offset: true }), z.null()])
  .optional();

const createAdminSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(255),
    phoneNumber: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .transform((val) => val.replaceAll(/[ -]/g, ''))
      .nullable()
      .optional(),
    password: z.string().min(1).max(255),
    role: z.enum(adminRoles),
    permissions: jsonValueSchema.nullable().optional(),
    profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
    status: z.enum(adminStatuses).optional(),
    isEmailVerified: z.boolean().optional(),
    lastLoginAt: nullableDateInputSchema,
    lastLoginIp: z.string().trim().min(1).max(45).nullable().optional(),
    failedLoginAttempts: z.number().int().min(0).optional(),
    lockedUntil: nullableDateInputSchema,
    twoFactorEnabled: z.boolean().optional(),
    twoFactorSecret: z.string().trim().min(1).max(255).nullable().optional(),
    passwordResetToken: z.string().trim().min(1).max(255).nullable().optional(),
    passwordResetExpiresAt: nullableDateInputSchema,
    // createdBy/updatedBy are set server-side from authenticated admin; clients should not provide them
    deletedAt: nullableDateInputSchema,
  }),
});

const loginAdminSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(255),
  }),
});

const updateAdminSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      email: z.string().trim().email().max(255).optional(),
      phoneNumber: z
        .string()
        .trim()
        .min(1)
        .max(30)
        .transform((val) => val.replaceAll(/[ -]/g, ''))
        .nullable()
        .optional(),
      role: z.enum(adminRoles).optional(),
      permissions: jsonValueSchema.nullable().optional(),
      profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
      status: z.enum(adminStatuses).optional(),
      isEmailVerified: z.boolean().optional(),
      twoFactorEnabled: z.boolean().optional(),
      // updatedBy is set server-side from authenticated admin; clients should not provide it
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const validateCreateAdmin = validate(createAdminSchema);
const validateLoginAdmin = validate(loginAdminSchema);
const validateUpdateAdmin = validate<UpdateAdminParams, UpdateAdminInput>(updateAdminSchema);

const updateAdminStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(adminStatuses),
  }),
});

const validateUpdateAdminStatus = validate<UpdateAdminStatusParams, UpdateAdminStatusInput>(
  updateAdminStatusSchema,
);

const authenticateAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
  req,
  _res,
  next: NextFunction,
): void => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.authorizationTokenMissing,
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.authorizationTokenMissing,
      });
    }

    const payload = verifyJwtToken(token);

    if (payload.userType !== UserType.ADMIN) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // attach the admin id from the token to the request for downstream handlers
    (req as unknown as { id?: string }).id = payload.id;

    next();
  } catch (error: unknown) {
    next(error);
  }
};

const authenticateSuperAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
  req,
  _res,
  next: NextFunction,
): void => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.authorizationTokenMissing,
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.authorizationTokenMissing,
      });
    }

    const payload = verifyJwtToken(token);

    if (payload.userType !== UserType.ADMIN || payload.adminType !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // attach the admin id from the token to the request for downstream handlers
    (req as unknown as { id?: string }).id = payload.id;

    next();
  } catch (error: unknown) {
    next(error);
  }
};

export {
  authenticateAdmin,
  authenticateSuperAdmin,
  validateCreateAdmin,
  validateLoginAdmin,
  validateUpdateAdmin,
  validateUpdateAdminStatus,
};
