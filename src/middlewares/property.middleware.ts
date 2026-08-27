import { z } from 'zod';

import { listingTypes, propertyStatuses, propertyTypes } from '../enums/property.enum';

import { validate } from './validate';

const createPropertySchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(255),
    buildingNumber: z.string().trim().min(1).max(100).nullable().optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    type: z.enum(propertyTypes),
    listingType: z.enum(listingTypes).optional(),
    price: z.number().positive(),
    currency: z.string().trim().min(3).max(10).optional(),
    floors: z.number().int().min(0).nullable().optional(),
    totalUnits: z.number().int().min(0).nullable().optional(),
    totalArea: z.number().min(0).nullable().optional(),
    address: z.string().trim().min(1),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100).nullable().optional(),
    country: z.string().trim().min(1).max(100),
    postalCode: z.string().trim().min(1).max(30).nullable().optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    amenities: z.any().nullable().optional(),
    images: z.array(z.string().trim().url().max(2048)).nullable().optional(),
    status: z.enum(propertyStatuses).optional(),
    ownerId: z.string().uuid(),
  }),
});

const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      buildingNumber: z.string().trim().min(1).max(100).nullable().optional(),
      description: z.string().trim().max(10000).nullable().optional(),
      type: z.enum(propertyTypes).optional(),
      listingType: z.enum(listingTypes).optional(),
      price: z.number().positive().optional(),
      currency: z.string().trim().min(3).max(10).optional(),
      floors: z.number().int().min(0).nullable().optional(),
      totalUnits: z.number().int().min(0).nullable().optional(),
      totalArea: z.number().min(0).nullable().optional(),
      address: z.string().trim().min(1).optional(),
      city: z.string().trim().min(1).max(100).optional(),
      state: z.string().trim().min(1).max(100).nullable().optional(),
      country: z.string().trim().min(1).max(100).optional(),
      postalCode: z.string().trim().min(1).max(30).nullable().optional(),
      latitude: z.number().min(-90).max(90).nullable().optional(),
      longitude: z.number().min(-180).max(180).nullable().optional(),
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

export { validateCreateProperty, validateUpdateProperty };
