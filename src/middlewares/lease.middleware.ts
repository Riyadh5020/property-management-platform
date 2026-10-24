import { z } from 'zod';

import { leaseStatuses } from '../models/lease.model';

import { validate } from './validate';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const createSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    unitId: z.string().uuid(),
    tenantId: z.string().uuid(),
    agreementNo: z.string().trim().max(100).nullable().optional(),
    startDate: dateStr,
    endDate: dateStr,
    monthlyRent: z.number().min(0),
    securityDeposit: z.number().min(0).optional(),
    escalationPercent: z.number().min(0).max(100).optional(),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    status: z.enum(leaseStatuses).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      agreementNo: z.string().trim().max(100).nullable().optional(),
      startDate: dateStr.optional(),
      endDate: dateStr.optional(),
      monthlyRent: z.number().min(0).optional(),
      securityDeposit: z.number().min(0).optional(),
      escalationPercent: z.number().min(0).max(100).optional(),
      noticePeriodDays: z.number().int().min(0).max(365).optional(),
      status: z.enum(leaseStatuses).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const validateCreateLease = validate(createSchema);
const validateUpdateLease = validate(updateSchema);
const validateLeaseId = validate(idSchema);

export { validateCreateLease, validateLeaseId, validateUpdateLease };
