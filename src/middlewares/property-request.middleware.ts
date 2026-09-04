import { z } from 'zod';

import { validate } from './validate';

const createPropertyRequestSchema = z.object({
  body: z.object({
    note: z.string().trim().min(1).max(2000),
  }),
});

const reviewPropertyRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const validateCreatePropertyRequest = validate(createPropertyRequestSchema);
const validateReviewPropertyRequest = validate(reviewPropertyRequestSchema);

export { validateCreatePropertyRequest, validateReviewPropertyRequest };
