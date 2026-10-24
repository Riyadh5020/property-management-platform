import { type Uuid } from '../utils/common';

export const SUBSCRIPTION_HISTORY_TABLE_NAME = 'subscription_history';

export const subscriptionHistoryActions = [
  'create',
  'renew',
  'change_plan',
  'extend',
  'discount',
  'trial',
] as const;

export type SubscriptionHistoryAction = (typeof subscriptionHistoryActions)[number];

export interface SubscriptionHistory {
  id: Uuid;
  propertyId: Uuid;
  planId: Uuid | null;
  previousPlanId: Uuid | null;
  action: SubscriptionHistoryAction;
  previousEndsAt: Date | null;
  newEndsAt: Date | null;
  daysAdded: number | null;
  amount: number | null;
  discountAmount: number | null;
  note: string | null;
  createdBy: Uuid | null;
  createdAt: Date;
}

export type CreateSubscriptionHistoryInput = Omit<SubscriptionHistory, 'id' | 'createdAt'>;

const actionCheck = subscriptionHistoryActions.map((a) => `'${a}'`).join(', ');

export const createSubscriptionHistoryTableSql = `
CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_HISTORY_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "planId" UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  "previousPlanId" UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  action VARCHAR(32) NOT NULL CHECK (action IN (${actionCheck})),
  "previousEndsAt" TIMESTAMPTZ,
  "newEndsAt" TIMESTAMPTZ,
  "daysAdded" INTEGER,
  amount NUMERIC(12,2),
  "discountAmount" NUMERIC(12,2),
  note TEXT,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createSubscriptionHistoryIndexesSql = [
  `CREATE INDEX IF NOT EXISTS subscription_history_property_idx ON ${SUBSCRIPTION_HISTORY_TABLE_NAME} ("propertyId", "createdAt" DESC);`,
];
