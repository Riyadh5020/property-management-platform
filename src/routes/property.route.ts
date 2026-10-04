import { Router } from 'express';

import {
  createProperty,
  deleteProperty,
  getProperties,
  getPropertyById,
  updateProperty,
  updatePropertySubscription,
} from '../controllers/property.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateProperty,
  validateSetSubscription,
  validateUpdateProperty,
} from '../middlewares/property.middleware';

const propertyRouter = Router();
propertyRouter.get('/', authenticateAdmin, getProperties);
propertyRouter.get('/:id', authenticateAdmin, getPropertyById);
propertyRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateCreateProperty,
  createProperty,
);
propertyRouter.put('/:id', authenticateAdmin, validateUpdateProperty, updateProperty);
propertyRouter.patch(
  '/:id/subscription',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateSetSubscription,
  updatePropertySubscription,
);
propertyRouter.delete('/:id', authenticateAdmin, authorizeRoles('superAdmin'), deleteProperty);
export { propertyRouter };
