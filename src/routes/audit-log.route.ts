import { Router } from 'express';

import { getAuditLogList } from '../controllers/audit-log.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import { validateAuditLogQuery } from '../middlewares/audit-log.middleware';

const auditLogRouter = Router();

// The history is for oversight: owners see their own properties, superAdmin sees everything.
auditLogRouter.get(
  '/',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateAuditLogQuery,
  getAuditLogList,
);

export { auditLogRouter };
