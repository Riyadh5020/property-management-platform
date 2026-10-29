import { z } from 'zod';

import { parkingStatuses, parkingTypes } from '../models/parking.model';

import { validate } from './validate';

const createSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    slotNumber: z.string().trim().min(1).max(50),
    slotType: z.enum(parkingTypes).optional(),
    unitId: z.string().uuid().nullable().optional(),
    vehicleNumber: z.string().trim().max(50).nullable().optional(),
    monthlyFee: z.number().min(0).optional(),
    status: z.enum(parkingStatuses).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      slotNumber: z.string().trim().min(1).max(50).optional(),
      slotType: z.enum(parkingTypes).optional(),
      unitId: z.string().uuid().nullable().optional(),
      vehicleNumber: z.string().trim().max(50).nullable().optional(),
      monthlyFee: z.number().min(0).optional(),
      status: z.enum(parkingStatuses).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const validateCreateParking = validate(createSchema);
export const validateUpdateParking = validate(updateSchema);
export const validateParkingId = validate(idSchema);
