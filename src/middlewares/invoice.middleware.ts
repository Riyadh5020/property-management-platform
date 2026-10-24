import { z } from 'zod';

import { paymentMethods } from '../models/invoice.model';

import { validate } from './validate';

const monthStr = z.string().regex(/^\d{4}-\d{2}-01$/, 'Use the first day of the month, YYYY-MM-01');
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const id = z.object({ id: z.string().uuid() });

const generateSchema = z.object({
  body: z.object({
    month: monthStr,
    propertyId: z.string().uuid().optional(),
    dueDay: z.number().int().min(1).max(28).optional(),
  }),
});

const updateSchema = z.object({
  params: id,
  body: z
    .object({
      utilitiesAmount: z.number().min(0).optional(),
      penaltyAmount: z.number().min(0).optional(),
      otherAmount: z.number().min(0).optional(),
      dueDate: dateStr.optional(),
      note: z.string().trim().max(1000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const paymentSchema = z.object({
  params: id,
  body: z.object({
    amount: z.number().positive(),
    method: z.enum(paymentMethods),
    reference: z.string().trim().max(100).nullable().optional(),
    paidOn: dateStr,
    note: z.string().trim().max(1000).nullable().optional(),
  }),
});

const reverseSchema = z.object({
  params: z.object({ id: z.string().uuid(), paymentId: z.string().uuid() }),
  body: z.object({ note: z.string().trim().min(3).max(1000) }),
});

const idSchema = z.object({ params: id });

export const validateGenerateInvoices = validate(generateSchema);
export const validateUpdateInvoice = validate(updateSchema);
export const validateAddPayment = validate(paymentSchema);
export const validateReversePayment = validate(reverseSchema);
export const validateInvoiceId = validate(idSchema);
