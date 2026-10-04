import { Router } from 'express';

import { floorController } from '../controllers/floor.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import { validateCreateFloor, validateUpdateFloor } from '../middlewares/floor.middleware';

const floorRouter = Router();

floorRouter.get('/', authenticateAdmin, floorController.getFloors);
floorRouter.get('/:id', authenticateAdmin, floorController.getFloorById);
floorRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateCreateFloor,
  floorController.createFloor,
);
floorRouter.put('/:id', authenticateAdmin, validateUpdateFloor, floorController.updateFloor);
floorRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  floorController.deleteFloor,
);

export { floorRouter };
