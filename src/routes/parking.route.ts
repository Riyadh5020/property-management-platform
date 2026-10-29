import { Router } from 'express';

import {
  createParking,
  deleteParking,
  getParking,
  getParkingList,
  updateParking,
} from '../controllers/parking.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateParking,
  validateParkingId,
  validateUpdateParking,
} from '../middlewares/parking.middleware';

const parkingRouter = Router();

parkingRouter.get('/', authenticateAdmin, getParkingList);
parkingRouter.get('/:id', authenticateAdmin, validateParkingId, getParking);
parkingRouter.post('/create', authenticateAdmin, validateCreateParking, createParking);
parkingRouter.put('/:id', authenticateAdmin, validateUpdateParking, updateParking);
parkingRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateParkingId,
  deleteParking,
);

export { parkingRouter };
