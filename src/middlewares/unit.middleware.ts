import { z } from 'zod';

import { unitStatuses, unitTypes } from '../models/unit.model';

import { validate } from './validate';

const createUnitSchema = z.object({
  body: z.object({
    floorId: z.string().uuid(),
    unitCode: z.string().trim().min(1).max(50),
    unitType: z.enum(unitTypes).optional(),
    areaSize: z.number().positive(),
    bedrooms: z.number().int().min(0).nullable().optional(),
    bathrooms: z.number().int().min(0).nullable().optional(),
    hasKitchen: z.boolean().optional(),
    hasBalcony: z.boolean().optional(),
    rent: z.number().min(0).nullable().optional(),
    status: z.enum(unitStatuses).optional(),
  }),
});

const updateUnitSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      floorId: z.string().uuid().optional(),
      unitCode: z.string().trim().min(1).max(50).optional(),
      unitType: z.enum(unitTypes).optional(),
      areaSize: z.number().positive().optional(),
      bedrooms: z.number().int().min(0).nullable().optional(),
      bathrooms: z.number().int().min(0).nullable().optional(),
      hasKitchen: z.boolean().optional(),
      hasBalcony: z.boolean().optional(),
      rent: z.number().min(0).nullable().optional(),
      status: z.enum(unitStatuses).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});

const validateCreateUnit = validate(createUnitSchema);
const validateUpdateUnit = validate(updateUnitSchema);

export { validateCreateUnit, validateUpdateUnit };
