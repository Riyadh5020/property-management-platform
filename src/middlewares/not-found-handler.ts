import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { createErrorResponse } from '../utils/app-response';

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(StatusCodes.NOT_FOUND).json(
    createErrorResponse({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Route not found',
    }),
  );
};
