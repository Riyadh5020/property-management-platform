import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  createSubscriptionPlan as createService,
  deleteSubscriptionPlan as deleteService,
  getAllSubscriptionPlans as getAllService,
  getSubscriptionPlanById as getByIdService,
  updateSubscriptionPlan as updateService,
} from '../services/subscription-plan.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

type CreateBody = Parameters<typeof createService>[0];
type UpdateBody = Parameters<typeof updateService>[1];

const actor = (req: Request): { id: string | null; role: string | null } => ({
  id: (req as unknown as { id?: string }).id ?? null,
  role: (req as unknown as { adminType?: string }).adminType ?? null,
});

const ok = (res: Response, status: number, data: unknown): Response =>
  res
    .status(status)
    .json(
      createSuccessResponse({ statusCode: status, message: SUCCESS_MESSAGES.common.success, data }),
    );

const createSubscriptionPlan = asyncHandler(async (req: Request, res: Response) => {
  const a = actor(req);
  ok(res, StatusCodes.CREATED, await createService(req.body as CreateBody, a.id, a.role));
});

const getSubscriptionPlans = asyncHandler(async (req: Request, res: Response) => {
  const { limit, offset, status } = req.query as Record<string, string | undefined>;
  const limitNumber = limit ? Number(limit) : 20;
  const offsetNumber = offset ? Number(offset) : 0;

  const { items, total } = await getAllService({
    limit: limitNumber,
    offset: offsetNumber,
    status: status as 'active' | 'inactive' | undefined,
  });
  ok(res, StatusCodes.OK, {
    items,
    pagination: { limit: limitNumber, offset: offsetNumber, total },
  });
});

const getSubscriptionPlanById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response) => {
    const plan = await getByIdService(req.params.id as never);
    if (!plan) {
      res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Subscription plan not found',
      });
      return;
    }
    ok(res, StatusCodes.OK, plan);
  },
);

const updateSubscriptionPlan = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  const a = actor(req);
  ok(
    res,
    StatusCodes.OK,
    await updateService(req.params.id as never, req.body as UpdateBody, a.id, a.role),
  );
});

const deleteSubscriptionPlan = asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
  ok(res, StatusCodes.OK, await deleteService(req.params.id as never, actor(req).role));
});

export {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptionPlanById,
  getSubscriptionPlans,
  updateSubscriptionPlan,
};
