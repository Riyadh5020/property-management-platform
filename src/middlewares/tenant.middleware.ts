import { z } from 'zod';

import { idDocTypes, tenantRoles, tenantStatuses } from '../models/tenant.model';

import { validate } from './validate';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const createSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    unitId: z.string().uuid().nullable().optional(),
    fullName: z.string().trim().min(1).max(255),
    phone: z.string().trim().max(50).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    idDocType: z.enum(idDocTypes).nullable().optional(),
    idDocNumber: z.string().trim().max(100).nullable().optional(),
    role: z.enum(tenantRoles).optional(),
    moveInDate: dateStr.nullable().optional(),
    moveOutDate: dateStr.nullable().optional(),
    status: z.enum(tenantStatuses).optional(),
    occupation: z.string().trim().max(255).nullable().optional(),
    permanentAddress: z.string().trim().max(1000).nullable().optional(),
    emergencyContactName: z.string().trim().max(255).nullable().optional(),
    emergencyContactPhone: z.string().trim().max(50).nullable().optional(),
    familyMembers: z.number().int().min(0).max(100).nullable().optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      unitId: z.string().uuid().nullable().optional(),
      fullName: z.string().trim().min(1).max(255).optional(),
      phone: z.string().trim().max(50).nullable().optional(),
      email: z.string().trim().email().max(255).nullable().optional(),
      idDocType: z.enum(idDocTypes).nullable().optional(),
      idDocNumber: z.string().trim().max(100).nullable().optional(),
      role: z.enum(tenantRoles).optional(),
      moveInDate: dateStr.nullable().optional(),
      moveOutDate: dateStr.nullable().optional(),
      status: z.enum(tenantStatuses).optional(),
      occupation: z.string().trim().max(255).nullable().optional(),
      permanentAddress: z.string().trim().max(1000).nullable().optional(),
      emergencyContactName: z.string().trim().max(255).nullable().optional(),
      emergencyContactPhone: z.string().trim().max(50).nullable().optional(),
      familyMembers: z.number().int().min(0).max(100).nullable().optional(),
      notes: z.string().trim().max(5000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const validateCreateTenant = validate(createSchema);
const validateUpdateTenant = validate(updateSchema);
const validateTenantId = validate(idSchema);

export { validateCreateTenant, validateTenantId, validateUpdateTenant };
