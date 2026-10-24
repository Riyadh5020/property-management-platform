import { z } from 'zod';

import { validate } from './validate';

const createFloorRequestSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    requestedFloorCount: z.number().int().positive(),
    note: z.string().trim().min(1).max(2000),
  }),
});

const reviewFloorRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
const denyFloorRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().min(3).max(500) }),
});
const editFloorRequestSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      requestedFloorCount: z.number().int().positive().optional(),
      note: z.string().trim().min(1).max(2000).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});
const validateEditFloorRequest = validate(editFloorRequestSchema);
const validateCreateFloorRequest = validate(createFloorRequestSchema);
const validateReviewFloorRequest = validate(reviewFloorRequestSchema);
const validateDenyFloorRequest = validate(denyFloorRequestSchema);

export {
  validateCreateFloorRequest,
  validateDenyFloorRequest,
  validateEditFloorRequest,
  validateReviewFloorRequest,
};
