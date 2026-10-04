import { SUBSCRIPTION_PLAN_TABLE_NAME } from '../constants/database';
import { billingCycles, subscriptionPlanStatuses } from '../enums/subscription-plan.enum';
import { type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';

export { SUBSCRIPTION_PLAN_TABLE_NAME };

export type BillingCycle = (typeof billingCycles)[number];
export type SubscriptionPlanStatus = (typeof subscriptionPlanStatuses)[number];
export type SubscriptionPlanId = Uuid;

export const BILLING_CYCLE_DAYS: Record<BillingCycle, number> = {
  trial: 5,
  monthly: 30,
  quarterly: 90,
  yearly: 365,
};

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;
  billingCycle: BillingCycle;
  amount: number;
  durationDays: number;
  status: SubscriptionPlanStatus;
  createdBy: AdminId | null;
  updatedBy: AdminId | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateSubscriptionPlanInput {
  name: string;
  billingCycle: BillingCycle;
  amount: number;
  durationDays: number;
  status?: SubscriptionPlanStatus;
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
}

export interface UpdateSubscriptionPlanInput {
  name?: string;
  billingCycle?: BillingCycle;
  amount?: number;
  durationDays?: number;
  status?: SubscriptionPlanStatus;
  updatedBy?: AdminId | null;
}

const cycleCheck = billingCycles.map((c) => `'${c}'`).join(', ');
const statusCheck = subscriptionPlanStatuses.map((s) => `'${s}'`).join(', ');

export const createSubscriptionPlanTableSql = `
CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_PLAN_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  "billingCycle" VARCHAR(32) NOT NULL CHECK ("billingCycle" IN (${cycleCheck})),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  "durationDays" INTEGER NOT NULL CHECK ("durationDays" > 0),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN (${statusCheck})),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createSubscriptionPlanIndexesSql = [
  `CREATE INDEX IF NOT EXISTS subscription_plans_status_idx ON ${SUBSCRIPTION_PLAN_TABLE_NAME} (status) WHERE "deletedAt" IS NULL;`,
];
