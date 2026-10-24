import { Router } from 'express';

import { getDashboardStats, getReportStats } from '../controllers/dashboard.controller';
import { authenticateAdmin } from '../middlewares/admin.middleware';

const dashboardRouter = Router();

dashboardRouter.get('/stats', authenticateAdmin, getDashboardStats);
dashboardRouter.get('/reports', authenticateAdmin, getReportStats);
export { dashboardRouter };
