import { Router } from 'express';

import {
  applyCoupon,
  createCoupon,
  exportData,
  getBusinessStats,
  getCoupons,
  getInvoices,
  payInvoice,
  setCouponStatus,
  voidInvoice,
} from '../controllers/subscription-billing.controller';
import { authenticateAdmin, authorizeRoles } from '../middlewares/admin.middleware';
import {
  validateApplyCoupon,
  validateCouponStatus,
  validateCreateCoupon,
  validateExportType,
  validateInvoiceAction,
  validatePayInvoice,
} from '../middlewares/subscription-billing.middleware';

const billingRouter = Router();
const superAdmin = authorizeRoles('superAdmin');
const ownerOrAbove = authorizeRoles('superAdmin', 'owner');

billingRouter.use(authenticateAdmin);
billingRouter.get('/invoices', ownerOrAbove, getInvoices);
billingRouter.patch('/invoices/:id/pay', superAdmin, validatePayInvoice, payInvoice);
billingRouter.patch('/invoices/:id/void', superAdmin, validateInvoiceAction, voidInvoice);
billingRouter.post('/invoices/:id/coupon', ownerOrAbove, validateApplyCoupon, applyCoupon);
billingRouter.get('/coupons', superAdmin, getCoupons);
billingRouter.post('/coupons', superAdmin, validateCreateCoupon, createCoupon);
billingRouter.patch('/coupons/:id', superAdmin, validateCouponStatus, setCouponStatus);
billingRouter.get('/business', superAdmin, getBusinessStats);
billingRouter.get('/export/:type', ownerOrAbove, validateExportType, exportData);

export { billingRouter };
