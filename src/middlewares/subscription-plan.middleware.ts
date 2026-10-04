import { z } from 'zod';

import { billingCycles, subscriptionPlanStatuses } from '../enums/subscription-plan.enum';

import { validate } from './validate';

const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(150),
    billingCycle: z.enum(billingCycles),
    amount: z.number().min(0),
    status: z.enum(subscriptionPlanStatuses).optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      name: z.string().trim().min(1).max(150).optional(),
      billingCycle: z.enum(billingCycles).optional(),
      amount: z.number().min(0).optional(),
      status: z.enum(subscriptionPlanStatuses).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const validateCreateSubscriptionPlan = validate(createSchema);
const validateUpdateSubscriptionPlan = validate(updateSchema);

export { validateCreateSubscriptionPlan, validateUpdateSubscriptionPlan };
