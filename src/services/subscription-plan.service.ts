import { StatusCodes } from 'http-status-codes';

import {
  BILLING_CYCLE_DAYS,
  type BillingCycle,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from '../models/subscription-plan.model';
import {
  createSubscriptionPlan as createRepo,
  deleteSubscriptionPlan as deleteRepo,
  getAllSubscriptionPlans as getAllRepo,
  getSubscriptionPlanById as getByIdRepo,
  updateSubscriptionPlan as updateRepo,
} from '../repositories/subscription-plan.repository';
import { createResponseError } from '../utils/app-response';

const assertSuperAdmin = (role: string | null): void => {
  if (role !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only superAdmin can manage subscription plans',
    });
  }
};

const assertPriceRule = (cycle: BillingCycle, amount: number): void => {
  if (cycle === 'trial' && amount !== 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'A free demo (trial) plan must have amount 0',
    });
  }
  if (cycle !== 'trial' && amount <= 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Paid plans must have an amount greater than 0',
    });
  }
};

const createSubscriptionPlan = async (
  input: {
    name: string;
    billingCycle: BillingCycle;
    amount: number;
    status?: 'active' | 'inactive';
  },
  actorId: string | null,
  actorRole: string | null,
): Promise<SubscriptionPlan> => {
  assertSuperAdmin(actorRole);
  assertPriceRule(input.billingCycle, input.amount);

  return await createRepo({
    ...input,
    durationDays: BILLING_CYCLE_DAYS[input.billingCycle],
    createdBy: actorId as never,
    updatedBy: actorId as never,
  });
};

const updateSubscriptionPlan = async (
  id: SubscriptionPlanId,
  input: {
    name?: string;
    billingCycle?: BillingCycle;
    amount?: number;
    status?: 'active' | 'inactive';
  },
  actorId: string | null,
  actorRole: string | null,
): Promise<SubscriptionPlan> => {
  assertSuperAdmin(actorRole);

  const existing = await getByIdRepo(id);
  if (!existing) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Subscription plan not found',
    });
  }

  const cycle = input.billingCycle ?? existing.billingCycle;
  const amount = input.amount ?? existing.amount;
  assertPriceRule(cycle, amount);

  const updated = await updateRepo(id, {
    ...input,
    amount,
    billingCycle: cycle,
    durationDays: BILLING_CYCLE_DAYS[cycle],
    updatedBy: actorId as never,
  });
  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Subscription plan not found',
    });
  }
  return updated;
};

const deleteSubscriptionPlan = async (
  id: SubscriptionPlanId,
  actorRole: string | null,
): Promise<SubscriptionPlan> => {
  assertSuperAdmin(actorRole);
  const deleted = await deleteRepo(id);
  if (!deleted) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Subscription plan not found',
    });
  }
  return deleted;
};

const getSubscriptionPlanById = async (id: SubscriptionPlanId): Promise<SubscriptionPlan | null> =>
  await getByIdRepo(id);

const getAllSubscriptionPlans = async (options?: {
  limit?: number;
  offset?: number;
  status?: SubscriptionPlan['status'];
}): Promise<{ items: SubscriptionPlan[]; total: number }> => await getAllRepo(options);

export {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
};
