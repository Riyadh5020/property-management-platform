import { Router } from 'express';

import {
  createAdmin,
  loginAdmin,
  updateAdmin,
  updateAdminStatus,
  getAdmins,
  getAdminById,
  refreshToken,
} from '../controllers/admin.controller';
import {
  authenticateAdmin,
  authorizeRoles,
  validateCreateAdmin,
  validateLoginAdmin,
  validateRefreshToken,
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
adminRouter.get('/', authenticateAdmin, getAdmins);
adminRouter.post('/login', loginRateLimiter, validateLoginAdmin, loginAdmin);
adminRouter.get('/:id', authenticateAdmin, getAdminById);
adminRouter.put<UpdateAdminParams, unknown, UpdateAdminInput>(
  '/:id',
  authenticateAdmin,
  validateUpdateAdmin,
  updateAdmin,
);
adminRouter.post('/refresh-token', loginRateLimiter, validateRefreshToken, refreshToken);
adminRouter.patch<UpdateAdminParams, unknown, UpdateAdminStatusInput>(
  '/:id/status',
  authenticateAdmin,
  validateUpdateAdminStatus,
  updateAdminStatus,
);

export { adminRouter };
