import { z } from 'zod';

import {
  maintenanceCategories,
  maintenancePriorities,
  maintenanceStatuses,
} from '../models/maintenance.model';

import { validate } from './validate';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const createSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    unitId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(255),
    description: z.string().trim().max(5000).nullable().optional(),
    category: z.enum(maintenanceCategories).optional(),
    priority: z.enum(maintenancePriorities).optional(),
    status: z.enum(maintenanceStatuses).optional(),
    assignee: z.string().trim().max(255).nullable().optional(),
    scheduledFor: dateStr.nullable().optional(),
    cost: z.number().min(0).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      unitId: z.string().uuid().nullable().optional(),
      title: z.string().trim().min(1).max(255).optional(),
      description: z.string().trim().max(5000).nullable().optional(),
      category: z.enum(maintenanceCategories).optional(),
      priority: z.enum(maintenancePriorities).optional(),
      status: z.enum(maintenanceStatuses).optional(),
      assignee: z.string().trim().max(255).nullable().optional(),
      scheduledFor: dateStr.nullable().optional(),
      cost: z.number().min(0).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const validateCreateMaintenance = validate(createSchema);
export const validateUpdateMaintenance = validate(updateSchema);
export const validateMaintenanceId = validate(idSchema);
