import { z } from 'zod';

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
  }),
});

const reviewPropertyRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({ planId: z.string().uuid().optional() }).optional(),
});

const validateCreatePropertyRequest = validate(createPropertyRequestSchema);
const validateReviewPropertyRequest = validate(reviewPropertyRequestSchema);

export { validateCreatePropertyRequest, validateReviewPropertyRequest };
