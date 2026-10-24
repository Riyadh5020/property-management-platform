import { z } from 'zod';

import { propertyTypes } from '../enums/property.enum';

import { validate } from './validate';

const createPropertyRequestSchema = z.object({
  body: z.object({
    note: z.string().trim().max(2000).nullable().optional(),
    title: z.string().trim().min(1).max(255),
    buildingNumber: z.string().trim().max(100).nullable().optional(),
    floors: z.number().int().min(1),
    totalUnits: z.number().int().min(0).nullable().optional(),
    totalArea: z.number().min(0).nullable().optional(),
    address: z.string().trim().min(1).max(500),
    city: z.string().trim().min(1).max(255),
    state: z.string().trim().min(1).max(255),
    country: z.string().trim().min(1).max(255),
    postalCode: z.string().trim().max(50).nullable().optional(),
    type: z.enum(propertyTypes).optional(),
  }),
});

const reviewPropertyRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({ planId: z.string().uuid().optional() }).optional(),
});

const denyPropertyRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(3).max(500) }),
});

const editPropertyRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      buildingNumber: z.string().trim().max(100).optional(),
      floors: z.number().int().min(1).optional(),
      totalUnits: z.number().int().min(0).optional(),
      totalArea: z.number().min(0).optional(),
      address: z.string().trim().min(1).max(500).optional(),
      city: z.string().trim().min(1).max(255).optional(),
      state: z.string().trim().min(1).max(255).optional(),
      country: z.string().trim().min(1).max(255).optional(),
      postalCode: z.string().trim().max(50).optional(),
      note: z.string().trim().max(2000).optional(),
      type: z.enum(propertyTypes).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const validateCreatePropertyRequest = validate(createPropertyRequestSchema);
const validateReviewPropertyRequest = validate(reviewPropertyRequestSchema);
const validateDenyPropertyRequest = validate(denyPropertyRequestSchema);
const validateEditPropertyRequest = validate(editPropertyRequestSchema);

export {
  validateCreatePropertyRequest,
  validateDenyPropertyRequest,
  validateEditPropertyRequest,
  validateReviewPropertyRequest,
};
