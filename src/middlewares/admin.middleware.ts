import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { adminRoles, adminStatuses, type AdminRole } from '../enums/admin.enum';
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

import { findAdminById } from '@/repositories/admin.repository';

// const jsonValueSchema: z.ZodType = z.lazy(() =>
//   z.union([
//     z.boolean(),
//     z.number(),
//     z.string(),
//     z.null(),
//     z.array(jsonValueSchema),
//     z.record(z.string(), jsonValueSchema),
//   ]),
// );

// const nullableDateInputSchema = z
//   .union([z.date(), z.string().datetime({ offset: true }), z.null()])
//   .optional();

// const createAdminSchema = z.object({
//   body: z.object({
//     firstName: z.string().trim().min(1).max(100),
//     lastName: z.string().trim().min(1).max(100),
//     email: z.string().trim().email().max(255),
//     phoneNumber: z
//       .string()
//       .trim()
//       .min(1)
//       .max(30)
//       .transform((val) => val.replaceAll(/[ -]/g, ''))
//       .nullable()
//       .optional(),
//     password: z.string().min(1).max(255),
//     // role is accepted for backward compatibility but is ALWAYS overridden server-side
//     // in admin.service.ts based on the acting admin's role — clients cannot choose it.
//     role: z.enum(adminRoles).optional(),
//     permissions: jsonValueSchema.nullable().optional(),
//     profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
//     status: z.enum(adminStatuses).optional(),
//     isEmailVerified: z.boolean().optional(),
//     lastLoginAt: nullableDateInputSchema,
//     lastLoginIp: z.string().trim().min(1).max(45).nullable().optional(),
//     failedLoginAttempts: z.number().int().min(0).optional(),
//     lockedUntil: nullableDateInputSchema,
//     twoFactorEnabled: z.boolean().optional(),
//     twoFactorSecret: z.string().trim().min(1).max(255).nullable().optional(),
//     passwordResetToken: z.string().trim().min(1).max(255).nullable().optional(),
//     passwordResetExpiresAt: nullableDateInputSchema,
//     // createdBy/updatedBy/ownerId are set server-side from the authenticated admin; clients should not provide them
//     deletedAt: nullableDateInputSchema,
//   }),
// });

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
    profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
    // role, ownerId, status, isEmailVerified, twoFactorEnabled/Secret,
    // failedLoginAttempts, lockedUntil, passwordResetToken*, createdBy,
    // updatedBy are ALL server-controlled — never accepted from the client.
  }),
});
const loginAdminSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(255),
  }),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    code: z
      .string()
      .trim()
      .length(6)
      .regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: z.string().min(8).max(255),
  }),
});

const validateForgotPassword = validate(forgotPasswordSchema);
const validateResetPassword = validate(resetPasswordSchema);

// const updateAdminSchema = z.object({
//   params: z.object({
//     id: z.string().uuid(),
//   }),
//   body: z
//     .object({
//       firstName: z.string().trim().min(1).max(100).optional(),
//       lastName: z.string().trim().min(1).max(100).optional(),
//       email: z.string().trim().email().max(255).optional(),
//       phoneNumber: z
//         .string()
//         .trim()
//         .min(1)
//         .max(30)
//         .transform((val) => val.replaceAll(/[ -]/g, ''))
//         .nullable()
//         .optional(),
//       role: z.enum(adminRoles).optional(),
//       permissions: jsonValueSchema.nullable().optional(),
//       profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
//       status: z.enum(adminStatuses).optional(),
//       isEmailVerified: z.boolean().optional(),
//       twoFactorEnabled: z.boolean().optional(),
//       // updatedBy is set server-side from authenticated admin; clients should not provide it
//     })
//     .refine((body) => Object.keys(body).length > 0, {
//       message: 'At least one field is required',
//     }),
// });

const updateAdminSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
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
      profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
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

// shared helper — pulls the Bearer token out of the Authorization header
const extractBearerToken = (req: { headers: { authorization?: string } }): string => {
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

  return token;
};

// Verifies the token belongs to ANY authenticated admin (superAdmin, owner, or manager).
// Attaches id / adminType / ownerId to the request for downstream handlers and for authorizeRoles.
const authenticateAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
  req,
  _res,
  next: NextFunction,
): void => {
  (async (): Promise<void> => {
    const token = extractBearerToken(req);
    const payload = verifyJwtToken(token);

    // payload.userType comes from a decoded JWT (untrusted external input) — the
    // comparison is a real runtime safety check even though TS's literal-type
    // narrowing makes it look impossible at compile time.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (payload.userType !== UserType.ADMIN) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    // Look up the admin's current tokenVersion — if it doesn't match the
    // token's, the token was issued before a suspend/status-change/logout
    // and must be rejected, even though the signature is still valid.
    const admin = await findAdminById(payload.id);

    if (!admin) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    if ((payload.tokenVersion ?? 0) !== admin.tokenVersion) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.invalidToken,
      });
    }

    if (admin.status !== 'active') {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: ERROR_MESSAGES.admin.accountSuspended,
      });
    }

    (req as unknown as { id?: string }).id = payload.id;
    (req as unknown as { adminType?: string }).adminType = payload.adminType;
    (req as unknown as { ownerId?: string | null }).ownerId = payload.ownerId ?? null;
    next();
  })().catch(next);
};

// Generic role gate. Must run AFTER authenticateAdmin, since it reads req.adminType.
// Usage: router.post('/x', authenticateAdmin, authorizeRoles('superAdmin', 'owner'), handler)
const authorizeRoles = (
  ...roles: AdminRole[]
): RequestHandler<ParamsDictionary, unknown, unknown> => {
  return (req, _res, next: NextFunction): void => {
    try {
      const adminType = (req as unknown as { adminType?: AdminRole }).adminType;

      if (!adminType || !roles.includes(adminType)) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: ERROR_MESSAGES.admin.unauthorized,
        });
      }

      next();
    } catch (error: unknown) {
      next(error);
    }
  };
};

const refreshTokenSchema = z.object({
  body: z.object({ refreshToken: z.string().trim().min(1) }),
});
const validateRefreshToken = validate(refreshTokenSchema);

export {
  authenticateAdmin,
  authorizeRoles,
  validateCreateAdmin,
  validateForgotPassword,
  validateLoginAdmin,
  validateRefreshToken,
  validateResetPassword,
  validateUpdateAdmin,
  validateUpdateAdminStatus,
};
