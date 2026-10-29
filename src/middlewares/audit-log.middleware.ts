import { z } from 'zod';

import { auditEntityTypes } from '../models/audit-log.model';

import { validate } from './validate';

export const auditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  propertyId: z.string().uuid().optional(),
  entityType: z.enum(auditEntityTypes).optional(),
  actorId: z.string().uuid().optional(),
});

export const validateAuditLogQuery = validate(z.object({ query: auditLogQuerySchema }));
