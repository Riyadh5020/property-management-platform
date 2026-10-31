import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type ExportType } from '../repositories/subscription-billing.repository';
import * as service from '../services/subscription-billing.service';
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

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const { limit, offset } = parsePaging(q.limit, q.offset);
  const { items, total } = await service.listInvoices(
    {
      limit,
      offset,
      ...(q.status ? { status: q.status } : {}),
      ...(q.search ? { search: q.search } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
});

export const payInvoice = asyncHandler(async (req: Request, res: Response) => {
  ok(
    res,
    StatusCodes.OK,
    await service.recordPayment(String(req.params.id), req.body as never, actor(req)),
  );
});

export const voidInvoice = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.OK, await service.voidInvoice(String(req.params.id), actor(req)));
});

export const applyCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body as { code: string };
  ok(res, StatusCodes.OK, await service.applyCoupon(String(req.params.id), code, actor(req)));
});

export const getCoupons = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.OK, await service.listCoupons(actor(req)));
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.CREATED, await service.createCoupon(req.body as never, actor(req)));
});

export const setCouponStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.body as { status: string };
  ok(res, StatusCodes.OK, await service.setCouponStatus(String(req.params.id), status, actor(req)));
});

export const getBusinessStats = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.OK, await service.getBusinessStats(actor(req)));
});

export const exportData = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.OK, await service.exportCsv(req.params.type as ExportType, actor(req)));
});
