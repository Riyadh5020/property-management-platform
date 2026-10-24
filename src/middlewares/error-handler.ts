import { type NextFunction, type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { createErrorResponse, isResponseError } from '../utils/app-response';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (isResponseError(err)) {
    res.status(err.statusCode).json(
      createErrorResponse({
        statusCode: err.statusCode,
        message: err.message,
        errors: err.errors,
      }),
    );
    return;
  }

  // Postgres unique violation: never surface as 500
  if ((err as Error & { code?: string }).code === '23505') {
    res.status(StatusCodes.CONFLICT).json(
      createErrorResponse({
        statusCode: StatusCodes.CONFLICT,
        message: 'This record already exists.',
      }),
    );
    return;
  }

  console.error('[error]', err);

  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(
    createErrorResponse({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    }),
  );
};
