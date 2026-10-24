import { Router } from 'express';

import {
  approveFloorRequest,
  cancelFloorRequest,
  createFloorRequest,
  denyFloorRequest,
  editFloorRequest,
  getFloorRequests,
} from '../controllers/floor-request.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateFloorRequest,
  validateDenyFloorRequest,
  validateEditFloorRequest,
  validateReviewFloorRequest,
} from '../middlewares/floor-request.middleware';

const floorRequestRouter = Router();

floorRequestRouter.get('/', authenticateAdmin, getFloorRequests);
floorRequestRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateCreateFloorRequest,
  createFloorRequest,
);
floorRequestRouter.patch(
  '/:id/approve',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateReviewFloorRequest,
  approveFloorRequest,
);
floorRequestRouter.patch(
  '/:id/deny',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateDenyFloorRequest,
  denyFloorRequest,
);
floorRequestRouter.patch(
  '/:id/cancel',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateReviewFloorRequest,
  cancelFloorRequest,
);

floorRequestRouter.put(
  '/:id',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateEditFloorRequest,
  editFloorRequest,
);

export { floorRequestRouter };
