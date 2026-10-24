import { query } from '../config/database';
import {
  EXPENSE_TABLE_NAME,
  type CreateExpenseInput,
  type Expense,
  type UpdateExpenseInput,
} from '../models/expense.model';

const createExpense = async (i: CreateExpenseInput): Promise<Expense> => {
  const r = await query<Expense>(
    `INSERT INTO ${EXPENSE_TABLE_NAME}
      ("propertyId",title,category,amount,"expenseDate","paidBy",status,notes,"createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *;`,
    [
      i.propertyId,
      i.title,
      i.category ?? 'other',
      i.amount,
      i.expenseDate,
      i.paidBy ?? null,
      i.status ?? 'paid',
      i.notes ?? null,
      i.createdBy ?? null,
      i.updatedBy ?? null,
    ],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create expense');
  }
  return row;
};

const getExpenseById = async (id: string): Promise<Expense | null> => {
  const r = await query<Expense>(
    `SELECT * FROM ${EXPENSE_TABLE_NAME} WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const updateExpense = async (id: string, i: UpdateExpenseInput): Promise<Expense | null> => {
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(i, k);
  const r = await query<Expense>(
    `UPDATE ${EXPENSE_TABLE_NAME} SET
       title = COALESCE($2, title),
       category = COALESCE($3, category),
       amount = COALESCE($4, amount),
       "expenseDate" = COALESCE($5::date, "expenseDate"),
       "paidBy" = CASE WHEN $6::boolean THEN $7 ELSE "paidBy" END,
       status = COALESCE($8, status),
       notes = CASE WHEN $9::boolean THEN $10 ELSE notes END,
       "updatedBy" = COALESCE($11, "updatedBy"),
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [
      id,
      i.title ?? null,
      i.category ?? null,
      i.amount ?? null,
      i.expenseDate ?? null,
      has('paidBy'),
      i.paidBy ?? null,
      i.status ?? null,
      has('notes'),
      i.notes ?? null,
      i.updatedBy ?? null,
    ],
  );
  return r.rows[0] ?? null;
};

const deleteExpense = async (id: string): Promise<Expense | null> => {
  const r = await query<Expense>(
    `UPDATE ${EXPENSE_TABLE_NAME} SET "deletedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const getAllExpenses = async (o: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  category?: string;
  propertyId?: string;
  from?: string;
  to?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: Expense[]; total: number; sum: number }> => {
  const where: string[] = ['e."deletedAt" IS NULL', 'p."deletedAt" IS NULL'];
  const values: unknown[] = [];
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(
      `(LOWER(e.title) LIKE $${values.length} OR LOWER(COALESCE(e."paidBy",'')) LIKE $${values.length})`,
    );
  }
  if (o.status) {
    values.push(o.status);
    where.push(`e.status = $${values.length}`);
  }
  if (o.category) {
    values.push(o.category);
    where.push(`e.category = $${values.length}`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`e."propertyId" = $${values.length}`);
  }
  if (o.from) {
    values.push(o.from);
    where.push(`e."expenseDate" >= $${values.length}::date`);
  }
  if (o.to) {
    values.push(o.to);
    where.push(`e."expenseDate" <= $${values.length}::date`);
  }
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (o.propertyIds) {
    values.push(o.propertyIds);
    where.push(`e."propertyId" = ANY($${values.length}::uuid[])`);
  }
  values.push(o.limit ?? 20, o.offset ?? 0);
  const r = await query<Expense & { totalCount?: number; sumAmount?: number }>(
    `SELECT e.*, p.title AS "propertyTitle",
            COUNT(*) OVER() AS "totalCount", SUM(e.amount) OVER() AS "sumAmount"
       FROM ${EXPENSE_TABLE_NAME} e
       JOIN properties p ON p.id = e."propertyId"
      WHERE ${where.join(' AND ')}
      ORDER BY e."expenseDate" DESC, e."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, sumAmount: _s, ...e } = row;
    return e;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0, sum: r.rows[0]?.sumAmount ?? 0 };
};

export { createExpense, deleteExpense, getAllExpenses, getExpenseById, updateExpense };
