import { Router } from 'express';

import { buildingController } from '../controllers/building.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import { validateCreateBuilding, validateUpdateBuilding } from '../middlewares/building.middleware';

const buildingRouter = Router();

buildingRouter.get('/', authenticateAdmin, buildingController.getBuildings);
buildingRouter.get('/:id', authenticateAdmin, buildingController.getBuildingById);
buildingRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateCreateBuilding,
  buildingController.createBuilding,
);
buildingRouter.put(
  '/:id',
  authenticateAdmin,
  validateUpdateBuilding,
  buildingController.updateBuilding,
);

buildingRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  buildingController.deleteBuilding,
);

export { buildingRouter };
