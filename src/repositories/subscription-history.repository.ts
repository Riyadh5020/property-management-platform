import { query } from '../config/database';
import {
  SUBSCRIPTION_HISTORY_TABLE_NAME,
  type CreateSubscriptionHistoryInput,
  type SubscriptionHistory,
} from '../models/subscription-history.model';

const createSubscriptionHistory = async (
  input: CreateSubscriptionHistoryInput,
): Promise<SubscriptionHistory> => {
  const result = await query<SubscriptionHistory>(
    `INSERT INTO ${SUBSCRIPTION_HISTORY_TABLE_NAME}
      ("propertyId", "planId", "previousPlanId", action, "previousEndsAt", "newEndsAt",
       "daysAdded", amount, "discountAmount", note, "createdBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *;`,
    [
      input.propertyId,
      input.planId,
      input.previousPlanId,
      input.action,
      input.previousEndsAt,
      input.newEndsAt,
      input.daysAdded,
      input.amount,
      input.discountAmount,
      input.note,
      input.createdBy,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create subscription history');
  }
  return row;
};

const getSubscriptionHistory = async (options: {
  propertyId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: SubscriptionHistory[]; total: number }> => {
  const where: string[] = [];
  const values: unknown[] = [];

  if (options.propertyId) {
    values.push(options.propertyId);
    where.push(`h."propertyId" = $${values.length}`);
  }

  values.push(options.limit ?? 20, options.offset ?? 0);

  const result = await query<SubscriptionHistory & { totalCount?: number }>(
    `SELECT h.*, COUNT(*) OVER() AS "totalCount"
       FROM ${SUBSCRIPTION_HISTORY_TABLE_NAME} h
      ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY h."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );

  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...item } = row;
    return item;
  });
  return { items, total: result.rows[0]?.totalCount ?? 0 };
};

export { createSubscriptionHistory, getSubscriptionHistory };
