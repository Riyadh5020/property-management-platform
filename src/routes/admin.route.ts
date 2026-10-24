import { Router } from 'express';

import {
  adminResetPassword,
  createAdmin,
  forgotPassword,
  getAdminById,
  getAdmins,
  loginAdmin,
  logoutAdmin,
  refreshToken,
  resetPassword,
  updateAdmin,
  updateAdminStatus,
} from '../controllers/admin.controller';
import {
  getManagerProperties,
  setManagerProperties,
} from '../controllers/manager-property.controller';
import {
  authenticateAdmin,
  authorizeRoles,
  validateAdminResetPassword,
  validateCreateAdmin,
  validateForgotPassword,
  validateLoginAdmin,
  validateRefreshToken,
  validateResetPassword,
  validateSetManagerProperties,
  validateUpdateAdmin,
  validateUpdateAdminStatus,
} from '../middlewares/admin.middleware';
import {
  type UpdateAdminInput,
  type UpdateAdminParams,
  type UpdateAdminStatusInput,
} from '../types/admin.types';

import { loginRateLimiter } from '@/middlewares/rate-limit.middleware';

const adminRouter = Router();

adminRouter.post(
  '/create',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateCreateAdmin,
  createAdmin,
);
adminRouter.get('/', authenticateAdmin, authorizeRoles('superAdmin', 'owner'), getAdmins);
adminRouter.post('/login', loginRateLimiter, validateLoginAdmin, loginAdmin);
adminRouter.get('/:id', authenticateAdmin, getAdminById);
adminRouter.put<UpdateAdminParams, unknown, UpdateAdminInput>(
  '/:id',
  authenticateAdmin,
  validateUpdateAdmin,
  updateAdmin,
);
adminRouter.post('/refresh-token', loginRateLimiter, validateRefreshToken, refreshToken);
adminRouter.post('/logout', authenticateAdmin, logoutAdmin);
adminRouter.post('/forgot-password', loginRateLimiter, validateForgotPassword, forgotPassword);
adminRouter.post('/reset-password', loginRateLimiter, validateResetPassword, resetPassword);

adminRouter.patch<UpdateAdminParams, unknown, UpdateAdminStatusInput>(
  '/:id/status',
  authenticateAdmin,
  validateUpdateAdminStatus,
  updateAdminStatus,
);
adminRouter.get(
  '/:id/properties',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  getManagerProperties,
);
adminRouter.put(
  '/:id/properties',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateSetManagerProperties,
  setManagerProperties,
);
adminRouter.post(
  '/:id/reset-password',
  authenticateAdmin,
  authorizeRoles('superAdmin', 'owner'),
  validateAdminResetPassword,
  adminResetPassword,
);

export { adminRouter };
