import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { floorStatuses } from '../models/floor.model';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';
import { UserType, verifyJwtToken } from '../utils/jwt';

import { validate } from './validate';

const createFloorSchema = z.object({
  body: z.object({
    buildingId: z.string().uuid(),
    floorNumber: z.number().int().min(0),
    name: z.string().trim().min(1).max(100).nullable().optional(),
    totalUnits: z.number().int().min(0).nullable().optional(),
    totalArea: z.number().min(0).nullable().optional(),
    areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    status: z.enum(floorStatuses).optional(),
    amenities: z.any().nullable().optional(),
  }),
});

const updateFloorSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      buildingId: z.string().uuid().optional(),
      floorNumber: z.number().int().min(0).optional(),
      name: z.string().trim().min(1).max(100).nullable().optional(),
      totalUnits: z.number().int().min(0).nullable().optional(),
      totalArea: z.number().min(0).nullable().optional(),
      areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      status: z.enum(floorStatuses).optional(),
      amenities: z.any().nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const validateCreateFloor = validate(createFloorSchema);
const validateUpdateFloor = validate(updateFloorSchema);

const authenticateFloorAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
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

    (req as unknown as { id?: string }).id = payload.id;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export { authenticateFloorAdmin, validateCreateFloor, validateUpdateFloor };
