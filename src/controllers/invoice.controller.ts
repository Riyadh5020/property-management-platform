import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as service from '../services/invoice.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

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

export const generateInvoices = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.CREATED, await service.generateInvoices(req.body as never, actor(req)));
});

export const getInvoices = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = q.limit ? Number(q.limit) : 20;
  const offset = q.offset ? Number(q.offset) : 0;
  const { items, total } = await service.getAllInvoices(
    {
      limit,
      offset,
      ...(q.search ? { search: q.search } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.month ? { month: q.month } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, { items, pagination: { limit, offset, total } });
});

export const getInvoice = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.getInvoice(req.params.id, actor(req)));
});

export const updateInvoice = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(
    res,
    StatusCodes.OK,
    await service.updateInvoice(req.params.id, req.body as never, actor(req)),
  );
});

export const addPayment = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(
    res,
    StatusCodes.CREATED,
    await service.addPayment(req.params.id, req.body as never, actor(req)),
  );
});

export const reversePayment = asyncHandler(
  async (req: Request<{ id: string; paymentId: string }>, res: Response) => {
    const { note } = req.body as { note: string };
    ok(
      res,
      StatusCodes.CREATED,
      await service.reversePayment(req.params.id, req.params.paymentId, note, actor(req)),
    );
  },
);

export const voidInvoice = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.voidInvoice(req.params.id, actor(req)));
});
