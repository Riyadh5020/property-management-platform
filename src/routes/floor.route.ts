import { Router } from 'express';

import { floorController } from '../controllers/floor.controller';
import {
  authenticateFloorAdmin,
  validateCreateFloor,
  validateUpdateFloor,
} from '../middlewares/floor.middleware';

const floorRouter = Router();

floorRouter.get('/', authenticateFloorAdmin, floorController.getFloors);
floorRouter.get('/:id', authenticateFloorAdmin, floorController.getFloorById);
floorRouter.post(
  '/create',
  authenticateFloorAdmin,
  validateCreateFloor,
  floorController.createFloor,
);
floorRouter.put('/:id', authenticateFloorAdmin, validateUpdateFloor, floorController.updateFloor);

export { floorRouter };
