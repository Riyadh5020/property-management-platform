import { Router } from 'express';

import { buildingController } from '../controllers/building.controller';
import {
  authenticateBuildingAdmin,
  validateCreateBuilding,
  validateUpdateBuilding,
} from '../middlewares/building.middleware';

const buildingRouter = Router();

buildingRouter.get('/', authenticateBuildingAdmin, buildingController.getBuildings);
buildingRouter.get('/:id', authenticateBuildingAdmin, buildingController.getBuildingById);
buildingRouter.post(
  '/create',
  authenticateBuildingAdmin,
  validateCreateBuilding,
  buildingController.createBuilding,
);
buildingRouter.put(
  '/:id',
  authenticateBuildingAdmin,
  validateUpdateBuilding,
  buildingController.updateBuilding,
);

export { buildingRouter };
