import { z } from 'zod';

import {
  couponStatuses,
  couponTypes,
  subscriptionPaymentMethods,
} from '../models/subscription-billing.model';
import { exportTypes } from '../repositories/subscription-billing.repository';

import { validate } from './validate';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const id = z.object({ id: z.string().uuid() });

export const validateInvoiceAction = validate(z.object({ params: id }));
export const validatePayInvoice = validate(
  z.object({
    params: id,
    body: z.object({
      paidOn: dateStr,
      method: z.enum(subscriptionPaymentMethods),
      reference: z.string().trim().max(255).nullable().optional(),
      note: z.string().trim().max(2000).nullable().optional(),
    }),
  }),
);
export const validateApplyCoupon = validate(
  z.object({ params: id, body: z.object({ code: z.string().trim().min(1).max(50) }) }),
);
export const validateCreateCoupon = validate(
  z.object({
    body: z.object({
      code: z
        .string()
        .trim()
        .min(2)
        .max(50)
        .regex(/^[\w-]+$/, 'Use letters, numbers, dashes and underscores only'),
      discountType: z.enum(couponTypes),
      value: z.number().positive(),
      maxUses: z.number().int().positive().nullable().optional(),
      expiresOn: dateStr.nullable().optional(),
    }),
  }),
);
export const validateCouponStatus = validate(
  z.object({ params: id, body: z.object({ status: z.enum(couponStatuses) }) }),
);
export const validateExportType = validate(
  z.object({ params: z.object({ type: z.enum(exportTypes) }) }),
);
