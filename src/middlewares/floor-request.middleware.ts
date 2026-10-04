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

const validateCreateFloorRequest = validate(createFloorRequestSchema);
const validateReviewFloorRequest = validate(reviewFloorRequestSchema);

export { validateCreateFloorRequest, validateReviewFloorRequest };
