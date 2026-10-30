import { type Request, type Response, Router } from 'express';
import { StatusCodes } from 'http-status-codes';

import { env } from '../config/env';
import { runDailyJobs } from '../services/scheduled-job.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createErrorResponse, createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const jobRouter = Router();

// Called once a day by Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
jobRouter.get(
  '/daily',
  asyncHandler(async (req: Request, res: Response) => {
    if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) {
      res.status(StatusCodes.UNAUTHORIZED).json(
        createErrorResponse({
          statusCode: StatusCodes.UNAUTHORIZED,
          message: 'Unauthorized',
        }),
      );
      return;
    }
    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: await runDailyJobs(),
      }),
    );
  }),
);

export { jobRouter };
