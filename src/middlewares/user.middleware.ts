/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';
import { UserType, verifyJwtToken } from '../utils/jwt';

import { validate } from './validate';

const registerSchema = z.object({
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
    address: z.string().trim().max(1024).nullable().optional(),
    password: z.string().min(8).max(255),
    profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1).max(255),
  }),
});

const updateProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      phoneNumber: z
        .string()
        .trim()
        .min(1)
        .max(30)
        .transform((val) => val.replaceAll(/[ -]/g, ''))
        .nullable()
        .optional(),
      address: z.string().trim().max(1024).nullable().optional(),
      profileImageUrl: z.string().trim().url().max(2048).nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' }),
});

const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(255) }),
});

const resetPasswordSchema = z.object({
  body: z.object({ token: z.string().trim().min(1), password: z.string().min(8).max(255) }),
});

const changePasswordSchema = z.object({
  body: z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(255) }),
});

const verifyEmailSchema = z.object({ body: z.object({ token: z.string().trim().min(1) }) });

const validateRegister = validate(registerSchema);
const validateLogin = validate(loginSchema);
const validateUpdateProfile = validate(updateProfileSchema);
const validateForgotPassword = validate(forgotPasswordSchema);
const validateResetPassword = validate(resetPasswordSchema);
const validateChangePassword = validate(changePasswordSchema);
const validateVerifyEmail = validate(verifyEmailSchema);

const authenticateUser: RequestHandler<ParamsDictionary, unknown, unknown> = (
  req,
  _res,
  next: NextFunction,
): void => {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.user?.authorizationTokenMissing ?? 'Authorization token missing',
      });
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.user?.authorizationTokenMissing ?? 'Authorization token missing',
      });
    }

    const payload = verifyJwtToken(token);

    if (payload.userType !== UserType.USER) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.user?.unauthorized ?? 'Unauthorized',
      });
    }

    (req as unknown as { id?: string }).id = payload.id;

    next();
  } catch (error: unknown) {
    next(error);
  }
};

export {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateVerifyEmail,
  authenticateUser,
};
