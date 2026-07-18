import { StatusCodes } from 'http-status-codes';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from '../config/env';

import { createResponseError } from './app-response';
import { type JwtPayload } from './jwt';

const getRefreshTokenSecret = (): string => {
  if (!env.REFRESH_TOKEN_SECRET) {
    throw createResponseError({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'REFRESH_TOKEN_SECRET is not configured',
    });
  }

  return env.REFRESH_TOKEN_SECRET;
};

export const generateRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, getRefreshTokenSecret(), {
    expiresIn: env.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
  });
