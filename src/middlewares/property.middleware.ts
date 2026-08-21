import { type NextFunction, type RequestHandler } from 'express';
import { type ParamsDictionary } from 'express-serve-static-core';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

import { listingTypes, propertyStatuses, propertyTypes } from '../enums/property.enum';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';
import { UserType, verifyJwtToken } from '../utils/jwt';

import { validate } from './validate';

const createPropertySchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(10000).nullable().optional(),
    type: z.enum(propertyTypes),
    listingType: z.enum(listingTypes),
    price: z.number().positive(),
    currency: z.string().trim().min(3).max(10).optional(),
    address: z.string().trim().min(1),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100).nullable().optional(),
    country: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(30).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    bedrooms: z.number().int().min(0).nullable().optional(),
    bathrooms: z.number().int().min(0).nullable().optional(),
    areaSize: z.number().min(0).nullable().optional(),
    areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
    amenities: z.any().nullable().optional(),
    images: z.array(z.string().trim().url().max(2048)).nullable().optional(),
    status: z.enum(propertyStatuses).optional(),
    ownerId: z.string().uuid().nullable().optional(),
  }),
});

const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      type: z.enum(propertyTypes).optional(),
      listingType: z.enum(listingTypes).optional(),
      price: z.number().positive().optional(),
      currency: z.string().trim().min(3).max(10).optional(),
      address: z.string().trim().min(1).optional(),
      city: z.string().trim().min(1).max(100).optional(),
      state: z.string().trim().min(1).max(100).nullable().optional(),
      country: z.string().trim().min(1).max(100).optional(),
      postalCode: z.string().trim().min(1).max(30).nullable().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
      bedrooms: z.number().int().min(0).nullable().optional(),
      bathrooms: z.number().int().min(0).nullable().optional(),
      areaSize: z.number().min(0).nullable().optional(),
      areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
      amenities: z.any().nullable().optional(),
      images: z.array(z.string().trim().url().max(2048)).nullable().optional(),
      status: z.enum(propertyStatuses).optional(),
      ownerId: z.string().uuid().nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const validateCreateProperty = validate(createPropertySchema);
const validateUpdateProperty = validate(updatePropertySchema);

const authenticatePropertyAdmin: RequestHandler<ParamsDictionary, unknown, unknown> = (
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

export { authenticatePropertyAdmin, validateCreateProperty, validateUpdateProperty };
