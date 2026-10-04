import { query } from '../config/database';
import {
  SUBSCRIPTION_PLAN_TABLE_NAME,
  type CreateSubscriptionPlanInput,
  type SubscriptionPlan,
  type UpdateSubscriptionPlanInput,
} from '../models/subscription-plan.model';

const createSubscriptionPlan = async (
  input: CreateSubscriptionPlanInput,
): Promise<SubscriptionPlan> => {
  const sql = `
    INSERT INTO ${SUBSCRIPTION_PLAN_TABLE_NAME}
      (name, "billingCycle", amount, "durationDays", status, "createdBy", "updatedBy")
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const result = await query<SubscriptionPlan>(sql, [
    input.name,
    input.billingCycle,
    input.amount,
    input.durationDays,
    input.status ?? 'active',
    input.createdBy ?? null,
    input.updatedBy ?? null,
  ]);
  const plan = result.rows[0];
  if (!plan) {
    throw new Error('Failed to create subscription plan');
  }
  return plan;
};

const updateSubscriptionPlan = async (
  id: SubscriptionPlan['id'],
  input: UpdateSubscriptionPlanInput,
): Promise<SubscriptionPlan | null> => {
  const sql = `
    UPDATE ${SUBSCRIPTION_PLAN_TABLE_NAME}
    SET
      name = COALESCE($2, name),
      "billingCycle" = COALESCE($3, "billingCycle"),
      amount = COALESCE($4, amount),
      "durationDays" = COALESCE($5, "durationDays"),
      status = COALESCE($6, status),
      "updatedBy" = COALESCE($7, "updatedBy"),
      "updatedAt" = NOW()
    WHERE id = $1 AND "deletedAt" IS NULL
    RETURNING *;
  `;
  const result = await query<SubscriptionPlan>(sql, [
    id,
    input.name ?? null,
    input.billingCycle ?? null,
    input.amount ?? null,
    input.durationDays ?? null,
    input.status ?? null,
    input.updatedBy ?? null,
  ]);
  return result.rows[0] ?? null;
};

const deleteSubscriptionPlan = async (
  id: SubscriptionPlan['id'],
): Promise<SubscriptionPlan | null> => {
  const sql = `
    UPDATE ${SUBSCRIPTION_PLAN_TABLE_NAME}
    SET "deletedAt" = NOW()
    WHERE id = $1 AND "deletedAt" IS NULL
    RETURNING *;
  `;
  const result = await query<SubscriptionPlan>(sql, [id]);
  return result.rows[0] ?? null;
};

const getSubscriptionPlanById = async (
  id: SubscriptionPlan['id'],
): Promise<SubscriptionPlan | null> => {
  const sql = `SELECT * FROM ${SUBSCRIPTION_PLAN_TABLE_NAME} WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1;`;
  const result = await query<SubscriptionPlan>(sql, [id]);
  return result.rows[0] ?? null;
};

const getAllSubscriptionPlans = async (options?: {
  limit?: number;
  offset?: number;
  status?: SubscriptionPlan['status'];
}): Promise<{ items: SubscriptionPlan[]; total: number }> => {
  const where: string[] = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options?.status) {
    values.push(options.status);
    where.push(`status = $${values.length}`);
  }

  values.push(options?.limit ?? 20, options?.offset ?? 0);

  const sql = `
    SELECT *, COUNT(*) OVER() AS "totalCount"
    FROM ${SUBSCRIPTION_PLAN_TABLE_NAME}
    WHERE ${where.join(' AND ')}
    ORDER BY amount ASC, "createdAt" DESC
    LIMIT $${values.length - 1} OFFSET $${values.length};
  `;

  const result = await query<SubscriptionPlan & { totalCount?: number }>(sql, values);
  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...plan } = row;
    return plan;
  });
  return { items, total: result.rows[0]?.totalCount ?? 0 };
};

export {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getAllSubscriptionPlans,
  getSubscriptionPlanById,
  updateSubscriptionPlan,
};
