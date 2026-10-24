import { EXPENSE_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { EXPENSE_TABLE_NAME };

export const expenseCategories = [
  'utilities',
  'maintenance',
  'salary',
  'supplies',
  'tax',
  'other',
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expenseStatuses = ['paid', 'pending'] as const;
export type ExpenseStatus = (typeof expenseStatuses)[number];

export interface Expense {
  id: Uuid;
  propertyId: Uuid;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paidBy: string | null;
  status: ExpenseStatus;
  notes: string | null;
  createdBy: Uuid | null;
  updatedBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateExpenseInput {
  propertyId: string;
  title: string;
  category?: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paidBy?: string | null;
  status?: ExpenseStatus;
  notes?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, 'propertyId' | 'createdBy'>>;

const list = (a: readonly string[]): string => a.map((s) => `'${s}'`).join(', ');

export const createExpenseTableSql = `
CREATE TABLE IF NOT EXISTS ${EXPENSE_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'other' CHECK (category IN (${list(expenseCategories)})),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  "expenseDate" DATE NOT NULL,
  "paidBy" VARCHAR(255),
  status VARCHAR(32) NOT NULL DEFAULT 'paid' CHECK (status IN (${list(expenseStatuses)})),
  notes TEXT,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createExpenseIndexesSql = [
  `CREATE INDEX IF NOT EXISTS expenses_property_idx ON ${EXPENSE_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS expenses_date_idx ON ${EXPENSE_TABLE_NAME} ("expenseDate") WHERE "deletedAt" IS NULL;`,
];
