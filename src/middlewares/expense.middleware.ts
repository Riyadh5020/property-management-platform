import { z } from 'zod';

import { expenseCategories, expenseStatuses } from '../models/expense.model';

import { validate } from './validate';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const createSchema = z.object({
  body: z.object({
    propertyId: z.string().uuid(),
    title: z.string().trim().min(1).max(255),
    category: z.enum(expenseCategories).optional(),
    amount: z.number().positive(),
    expenseDate: dateStr,
    paidBy: z.string().trim().max(255).nullable().optional(),
    status: z.enum(expenseStatuses).optional(),
    notes: z.string().trim().max(5000).nullable().optional(),
  }),
});

const updateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      title: z.string().trim().min(1).max(255).optional(),
      category: z.enum(expenseCategories).optional(),
      amount: z.number().positive().optional(),
      expenseDate: dateStr.optional(),
      paidBy: z.string().trim().max(255).nullable().optional(),
      status: z.enum(expenseStatuses).optional(),
      notes: z.string().trim().max(5000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: 'At least one field is required' }),
});

const idSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const validateCreateExpense = validate(createSchema);
export const validateUpdateExpense = validate(updateSchema);
export const validateExpenseId = validate(idSchema);
