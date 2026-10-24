import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  getDashboardStats as getDashboardStatsRepository,
  getReportStats as getReportStatsRepository,
} from '../repositories/dashboard.repository';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const getDashboardStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as unknown as { id?: string }).id ?? '';
  const role = ((req as unknown as { adminType?: string }).adminType ?? 'manager') as
    | 'superAdmin'
    | 'owner'
    | 'manager';

  const data = await getDashboardStatsRepository({ role, adminId });

  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data,
    }),
  );
});
const getReportStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const adminId = (req as unknown as { id?: string }).id ?? '';
  const role = ((req as unknown as { adminType?: string }).adminType ?? 'manager') as
    | 'superAdmin'
    | 'owner'
    | 'manager';

  const data = await getReportStatsRepository({ role, adminId });

  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data,
    }),
  );
});

export { getDashboardStats, getReportStats };
