import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import * as service from '../services/expense.service';
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

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  ok(res, StatusCodes.CREATED, await service.createExpense(req.body as never, actor(req)));
});

export const getExpenses = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = q.limit ? Number(q.limit) : 20;
  const offset = q.offset ? Number(q.offset) : 0;
  const { items, total, sum } = await service.getAllExpenses(
    {
      limit,
      offset,
      ...(q.search ? { search: q.search } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.propertyId ? { propertyId: q.propertyId } : {}),
      ...(q.from ? { from: q.from } : {}),
      ...(q.to ? { to: q.to } : {}),
    },
    actor(req),
  );
  ok(res, StatusCodes.OK, {
    items,
    pagination: { limit, offset, total },
    summary: { totalAmount: sum },
  });
});

export const getExpense = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.getExpenseById(req.params.id, actor(req)));
});

export const updateExpense = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(
    res,
    StatusCodes.OK,
    await service.updateExpense(req.params.id, req.body as never, actor(req)),
  );
});

export const deleteExpense = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await service.deleteExpense(req.params.id, actor(req)));
});
