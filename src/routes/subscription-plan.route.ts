import { Router } from 'express';

import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptionPlanById,
  getSubscriptionPlans,
  updateSubscriptionPlan,
} from '../controllers/subscription-plan.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateCreateSubscriptionPlan,
  validateUpdateSubscriptionPlan,
} from '../middlewares/subscription-plan.middleware';

const subscriptionPlanRouter = Router();

subscriptionPlanRouter.get('/', authenticateAdmin, getSubscriptionPlans);
subscriptionPlanRouter.get('/:id', authenticateAdmin, getSubscriptionPlanById);
subscriptionPlanRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateCreateSubscriptionPlan,
  createSubscriptionPlan,
);
subscriptionPlanRouter.put(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  validateUpdateSubscriptionPlan,
  updateSubscriptionPlan,
);
subscriptionPlanRouter.delete(
  '/:id',
  authenticateAdmin,
  authorizeRoles('superAdmin'),
  deleteSubscriptionPlan,
);

export { subscriptionPlanRouter };
