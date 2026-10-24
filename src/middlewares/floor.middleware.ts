import { z } from 'zod';

import { floorStatuses, floorTypes } from '../models/floor.model';

import { validate } from './validate';

const createFloorSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    floorNumber: z.number().int().min(0),
    name: z.string().trim().min(1).max(100).nullable().optional(),
    totalUnits: z.number().int().min(0).nullable().optional(),
    totalArea: z.number().min(0).nullable().optional(),
    areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    status: z.enum(floorStatuses).optional(),
    floorType: z.enum(floorTypes).nullable().optional(),
    amenities: z.any().nullable().optional(),
  }),
});

const updateFloorSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      propertyId: z.string().uuid().optional(),
      floorNumber: z.number().int().min(0).optional(),
      name: z.string().trim().min(1).max(100).nullable().optional(),
      totalUnits: z.number().int().min(0).nullable().optional(),
      totalArea: z.number().min(0).nullable().optional(),
      areaUnit: z.string().trim().min(1).max(20).nullable().optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      status: z.enum(floorStatuses).optional(),
      floorType: z.enum(floorTypes).nullable().optional(),
      amenities: z.any().nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: 'At least one field is required',
    }),
});
const copyLayoutSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ sourceFloorId: z.string().uuid() }),
});
const validateCopyLayout = validate(copyLayoutSchema);

const validateCreateFloor = validate(createFloorSchema);
const validateUpdateFloor = validate(updateFloorSchema);

export { validateCopyLayout, validateCreateFloor, validateUpdateFloor };
