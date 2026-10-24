import { Router } from 'express';

import {
  adjustPropertySubscription,
  createProperty,
  deleteProperty,
  getProperties,
  getPropertyById,
  getPropertySubscriptionHistory,
  updateProperty,
  updatePropertySubscription,
} from '../controllers/property.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateAdjustSubscription,
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
propertyRouter.get('/:id/subscription-history', authenticateAdmin, getPropertySubscriptionHistory);
propertyRouter.patch(
  '/:id/subscription/adjust',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateAdjustSubscription,
  adjustPropertySubscription,
);
export { propertyRouter };
