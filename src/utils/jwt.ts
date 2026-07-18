import { StatusCodes } from 'http-status-codes';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';
import { type AdminRole, type Uuid } from '../models/admin.model';
import { ERROR_MESSAGES } from '../shared/error-messages';

import { createResponseError } from './app-response';

export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
}

export interface JwtPayload {
  id: Uuid;
  userType: UserType;
  adminType?: AdminRole;
}

const getJwtSecret = (): string => {
  if (!env.JWT_SECRET) {
    throw createResponseError({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'JWT_SECRET is not configured',
    });
  }

  return env.JWT_SECRET;
};

export const generateJwtToken = (payload: JwtPayload): string =>
  jwt.sign(payload, getJwtSecret(), {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });

export const verifyJwtToken = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (typeof decoded === 'string') {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.invalidToken,
      });
    }

    const payload = decoded as Partial<JwtPayload>;

    if (typeof payload.id !== 'string' || typeof payload.userType !== 'string') {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.invalidToken,
      });
    }

    return payload as JwtPayload;
  } catch (error: unknown) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError ||
      error instanceof jwt.TokenExpiredError
    ) {
      throw createResponseError({
        statusCode: StatusCodes.UNAUTHORIZED,
        message: ERROR_MESSAGES.admin.invalidToken,
      });
    }

    throw error;
  }
};
