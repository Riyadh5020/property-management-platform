import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { auditLogQuerySchema } from '../middlewares/audit-log.middleware';
import { getAuditLogs } from '../services/audit-log.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

export const getAuditLogList = asyncHandler(async (req: Request, res: Response) => {
  // Already validated by validateAuditLogQuery; parsing again applies the coercion and defaults.
  const q = auditLogQuerySchema.parse(req.query);
  const actor = {
    id: (req as unknown as { id?: string }).id ?? null,
    role: (req as unknown as { adminType?: string }).adminType ?? null,
  };
  const { items, total } = await getAuditLogs(q, actor);
  res.status(StatusCodes.OK).json(
    createSuccessResponse({
      statusCode: StatusCodes.OK,
      message: SUCCESS_MESSAGES.common.success,
      data: { items, pagination: { limit: q.limit, offset: q.offset, total } },
    }),
  );
});
