import { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { type ParsedQs } from 'qs';

/**
 * Wraps an async route handler so thrown errors are forwarded to Express error middleware.
 */
export const asyncHandler =
  <
    P = ParamsDictionary,
    ResBody = unknown,
    ReqBody = unknown,
    ReqQuery = ParsedQs,
    Locals extends Record<string, unknown> = Record<string, unknown>,
  >(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
      res: Response<ResBody, Locals>,
      next: NextFunction,
    ) => Promise<void>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
