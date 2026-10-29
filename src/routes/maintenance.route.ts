import { Router } from 'express';

import {
  createMaintenance,
  deleteMaintenance,
  getMaintenance,
  getMaintenanceList,
  reviewMaintenance,
  updateMaintenance,
} from '../controllers/maintenance.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateMaintenance,
  validateMaintenanceId,
  validateReviewMaintenance,
  validateUpdateMaintenance,
} from '../middlewares/maintenance.middleware';

const maintenanceRouter = Router();

maintenanceRouter.get('/', authenticateAdmin, getMaintenanceList);
maintenanceRouter.get('/:id', authenticateAdmin, validateMaintenanceId, getMaintenance);
maintenanceRouter.post('/create', authenticateAdmin, validateCreateMaintenance, createMaintenance);
maintenanceRouter.put('/:id', authenticateAdmin, validateUpdateMaintenance, updateMaintenance);
// Only the owner (or superAdmin) can approve or reject a manager's request.
maintenanceRouter.patch(
  '/:id/review',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateReviewMaintenance,
  reviewMaintenance,
);
maintenanceRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateMaintenanceId,
  deleteMaintenance,
);

export { maintenanceRouter };
