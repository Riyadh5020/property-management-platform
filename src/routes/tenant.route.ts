import { Router } from 'express';

import {
  createTenant,
  deleteTenant,
  getTenantById,
  getTenants,
  updateTenant,
} from '../controllers/tenant.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateTenant,
  validateTenantId,
  validateUpdateTenant,
} from '../middlewares/tenant.middleware';

const tenantRouter = Router();

tenantRouter.get('/', authenticateAdmin, getTenants);
tenantRouter.get('/:id', authenticateAdmin, validateTenantId, getTenantById);
tenantRouter.post('/create', authenticateAdmin, validateCreateTenant, createTenant);
tenantRouter.put('/:id', authenticateAdmin, validateUpdateTenant, updateTenant);
tenantRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateTenantId,
  deleteTenant,
);

export { tenantRouter };
