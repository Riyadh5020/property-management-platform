import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { buildingStatuses } from '../models/building.model';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';
import { UserType, verifyJwtToken } from '../utils/jwt';

import { validate } from './validate';

const createBuildingSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    name: z.string().trim().min(1).max(255),
    buildingNumber: z.string().trim().min(1).max(100).nullable().optional(),
    floors: z.number().int().min(0).nullable().optional(),
    totalUnits: z.number().int().min(0).nullable().optional(),
    totalArea: z.number().min(0).nullable().optional(),
    areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    status: z.enum(buildingStatuses).optional(),
    amenities: z.any().nullable().optional(),
    images: z.array(z.string().trim().url().max(2048)).nullable().optional(),
  }),
});

const updateBuildingSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      propertyId: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(255).optional(),
      buildingNumber: z.string().trim().min(1).max(100).nullable().optional(),
      floors: z.number().int().min(0).nullable().optional(),
      totalUnits: z.number().int().min(0).nullable().optional(),
      totalArea: z.number().min(0).nullable().optional(),
      areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      status: z.enum(buildingStatuses).optional(),
      amenities: z.any().nullable().optional(),
      images: z.array(z.string().trim().url().max(2048)).nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const validateCreateBuilding = validate(createBuildingSchema);
const validateUpdateBuilding = validate(updateBuildingSchema);

const authenticateBuildingAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
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

    (req as unknown as { id?: string }).id = payload.id;
    next();
  } catch (error: unknown) {
    next(error);
  }
};

export { authenticateBuildingAdmin, validateCreateBuilding, validateUpdateBuilding };
