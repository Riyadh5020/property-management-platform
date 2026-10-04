import { Router } from 'express';

import {
  approvePropertyRequest,
  createPropertyRequest,
  denyPropertyRequest,
  getPropertyRequests,
} from '../controllers/property-request.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreatePropertyRequest,
  validateReviewPropertyRequest,
} from '../middlewares/property-request.middleware';

const propertyRequestRouter = Router();

propertyRequestRouter.get('/', authenticateAdmin, getPropertyRequests);
propertyRequestRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateCreatePropertyRequest,
  createPropertyRequest,
);
propertyRequestRouter.patch(
  '/:id/approve',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateReviewPropertyRequest,
  approvePropertyRequest,
);
propertyRequestRouter.patch(
  '/:id/deny',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateReviewPropertyRequest,
  denyPropertyRequest,
);

export { propertyRequestRouter };
