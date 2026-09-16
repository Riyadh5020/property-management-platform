import { z } from 'zod';

import { buildingStatuses } from '../models/building.model';

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

export { validateCreateBuilding, validateUpdateBuilding };
