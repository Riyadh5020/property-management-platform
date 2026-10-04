import { Router } from 'express';

import {
  approveFloorRequest,
  createFloorRequest,
  denyFloorRequest,
  getFloorRequests,
} from '../controllers/floor-request.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateFloorRequest,
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
  validateReviewFloorRequest,
  denyFloorRequest,
);

export { floorRequestRouter };
