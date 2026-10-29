import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as service from '../services/parking.service';
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

export const createParking = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.CREATED, await service.createParking(req.body as never, actor(req)));
});

export const getParkingList = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const { limit, offset } = parsePaging(q.limit, q.offset);
  const { items, total } = await service.getAllParking(
    {
      limit,
      offset,
      ...(q.search ? { search: q.search } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.slotType ? { slotType: q.slotType } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
});

export const getParking = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.getParkingById(req.params.id, actor(req)));
});

export const updateParking = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(
    res,
    StatusCodes.OK,
    await service.updateParking(req.params.id, req.body as never, actor(req)),
  );
});

export const deleteParking = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.deleteParking(req.params.id, actor(req)));
});
