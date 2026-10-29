import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as service from '../services/maintenance.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

const actor = (req: Request): { id: string | null; role: string | null } => ({
  id: (req as unknown as { id?: string }).id ?? null,
  role: (req as unknown as { adminType?: string }).adminType ?? null,
});

const ok = (res: Response, status: number, data: unknown): void => {
  res
    .status(status)
    .json(
      createSuccessResponse({ statusCode: status, message: SUCCESS_MESSAGES.common.success, data }),
    );
};

export const createMaintenance = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.CREATED, await service.createMaintenance(req.body as never, actor(req)));
});

export const getMaintenanceList = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const { limit, offset } = parsePaging(q.limit, q.offset);
  const { items, total } = await service.getAllMaintenance(
    {
      limit,
      offset,
      ...(q.search ? { search: q.search } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.approvalStatus ? { approvalStatus: q.approvalStatus } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
});

export const getMaintenance = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.getMaintenanceById(req.params.id, actor(req)));
});

export const updateMaintenance = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    ok(
      res,
      StatusCodes.OK,
      await service.updateMaintenance(req.params.id, req.body as never, actor(req)),
    );
  },
);

export const reviewMaintenance = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    ok(
      res,
      StatusCodes.OK,
      await service.reviewMaintenance(req.params.id, req.body as never, actor(req)),
    );
  },
);

export const deleteMaintenance = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    ok(res, StatusCodes.OK, await service.deleteMaintenance(req.params.id, actor(req)));
  },
);
