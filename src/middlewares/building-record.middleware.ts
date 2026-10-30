import { type RequestHandler } from 'express';
import { z } from 'zod';

import { recordKinds, type RecordKind } from '../models/building-record.model';

import { validate } from './validate';

const name = z.string().trim().min(1).max(255);
const text = z.string().trim().max(255).nullable().optional();
const longText = z.string().trim().max(5000).nullable().optional();
const count = z.number().min(0).nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const fields: Record<RecordKind, z.ZodRawShape> = {
  notices: {
    title: name,
    audience: z.enum(['All', 'Owners', 'Managers']).optional(),
    postedDate: dateStr.nullable().optional(),
    priority: z.enum(['Normal', 'Important', 'Urgent']).optional(),
    body: longText,
  },
  visitors: {
    name,
    unit: text,
    purpose: z.enum(['Guest', 'Delivery', 'Contractor', 'Incident']).nullable().optional(),
    entryTime: text,
    exitTime: text,
    guard: text,
    status: z.enum(['Inside', 'Checked out', 'Denied']).optional(),
    notes: longText,
  },
  staff: {
    name,
    role: z
      .enum(['Guard', 'Cleaner', 'Electrician', 'Plumber', 'Caretaker', 'Other'])
      .nullable()
      .optional(),
    shift: z.enum(['Morning', 'Evening', 'Night', 'General']).nullable().optional(),
    phone: text,
    salary: count,
    attendance: count,
    status: z.enum(['On duty', 'Off duty', 'On leave']).optional(),
  },
  utilities: {
    unit: name,
    utility: z.enum(['Electricity', 'Gas', 'Water', 'Service charge']).nullable().optional(),
    vendor: text,
    period: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM')
      .nullable()
      .optional(),
    previous: count,
    current: count,
    rate: count,
    amount: count,
    status: z.enum(['Billed', 'Pending', 'Paid']).optional(),
  },
  amenities: {
    name,
    capacity: count,
    chargeable: count,
    status: z.enum(['Available', 'Closed', 'Under maintenance']).optional(),
  },
  emergencyContacts: {
    name,
    category: z
      .enum(['Fire service', 'Police', 'Ambulance', 'Electrician', 'Plumber', 'Other'])
      .nullable()
      .optional(),
    phone: text,
    notes: longText,
  },
  tickets: {
    title: name,
    message: longText,
    reply: longText,
    status: z.enum(['Open', 'In progress', 'Closed']).optional(),
  },
};

const kind = z.enum(recordKinds);
const propertyId = z.string().uuid().nullable().optional();

const createSchemas = Object.fromEntries(
  recordKinds.map((k) => [
    k,
    z.object({ params: z.object({ kind }), body: z.object({ ...fields[k], propertyId }) }),
  ]),
) as unknown as Record<RecordKind, z.AnyZodObject>;

const updateSchemas = Object.fromEntries(
  recordKinds.map((k) => [
    k,
    z.object({
      params: z.object({ kind, id: z.string().uuid() }),
      body: z.object({ ...fields[k], propertyId }).partial(),
    }),
  ]),
) as unknown as Record<RecordKind, z.AnyZodObject>;

const byKind =
  (schemas: Record<RecordKind, z.AnyZodObject>): RequestHandler =>
  (req, res, next) => {
    const chosen =
      (schemas[req.params.kind as RecordKind] as z.AnyZodObject | undefined) ??
      z.object({ params: z.object({ kind }) });
    void validate(chosen)(req, res, next);
  };

export const validateCreateRecord = byKind(createSchemas);
export const validateUpdateRecord = byKind(updateSchemas);
export const validateRecordKind = validate(z.object({ params: z.object({ kind }) }));
export const validateRecordId = validate(
  z.object({ params: z.object({ kind, id: z.string().uuid() }) }),
);
