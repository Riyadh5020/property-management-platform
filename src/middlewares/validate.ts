import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { type ParsedQs } from 'qs';
import { type AnyZodObject, ZodError } from 'zod';

import { createErrorResponse } from '../utils/app-response';

export const validate =
  <P = ParamsDictionary, ReqBody = unknown, ReqQuery = ParsedQs>(
    schema: AnyZodObject,
  ): RequestHandler<P, unknown, ReqBody, ReqQuery> =>
  (req: Request<P, unknown, ReqBody, ReqQuery>, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
      req.body = parsed.body as ReqBody;
      next();
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        res.status(StatusCodes.UNPROCESSABLE_ENTITY).json(
          createErrorResponse({
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            message: 'Validation failed',
            errors: error.errors.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          }),
        );
        return;
      }

      next(error);
    }
  };
