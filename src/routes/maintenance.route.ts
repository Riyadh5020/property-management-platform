import { Router } from 'express';

import {
  createMaintenance,
  deleteMaintenance,
  getMaintenance,
  getMaintenanceList,
  updateMaintenance,
} from '../controllers/maintenance.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';
import {
  validateCreateMaintenance,
  validateMaintenanceId,
  validateUpdateMaintenance,
} from '../middlewares/maintenance.middleware';

const maintenanceRouter = Router();

maintenanceRouter.get('/', authenticateAdmin, getMaintenanceList);
maintenanceRouter.get('/:id', authenticateAdmin, validateMaintenanceId, getMaintenance);
maintenanceRouter.post('/create', authenticateAdmin, validateCreateMaintenance, createMaintenance);
maintenanceRouter.put('/:id', authenticateAdmin, validateUpdateMaintenance, updateMaintenance);
maintenanceRouter.delete('/:id', authenticateAdmin, validateMaintenanceId, deleteMaintenance);

export { maintenanceRouter };
