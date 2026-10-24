import { Router } from 'express';

import {
  approvePropertyRequest,
  cancelPropertyRequest,
  createPropertyRequest,
  denyPropertyRequest,
  editPropertyRequest,
  getPropertyRequests,
} from '../controllers/property-request.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreatePropertyRequest,
  validateDenyPropertyRequest,
  validateEditPropertyRequest,
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
  validateDenyPropertyRequest,
  denyPropertyRequest,
);
propertyRequestRouter.patch(
  '/:id/cancel',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateReviewPropertyRequest,
  cancelPropertyRequest,
);
propertyRequestRouter.put(
  '/:id',
  authenticateAdmin,
  authorizeRoles('owner'),
  validateEditPropertyRequest,
  editPropertyRequest,
);
export { propertyRequestRouter };
