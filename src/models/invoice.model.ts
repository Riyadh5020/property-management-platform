import { INVOICE_TABLE_NAME, PAYMENT_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { INVOICE_TABLE_NAME, PAYMENT_TABLE_NAME };

export const invoiceStatuses = ['unpaid', 'partial', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const paymentMethods = ['cash', 'bank', 'bkash', 'nagad', 'other'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export interface Invoice {
  id: Uuid;
  propertyId: Uuid;
  unitId: Uuid;
  tenantId: Uuid;
  leaseId: Uuid;
  invoiceNo: string;
  billingMonth: string; // YYYY-MM-01
  dueDate: string;
  rentAmount: number;
  utilitiesAmount: number;
  penaltyAmount: number;
  otherAmount: number;
  totalAmount: number;
  paidAmount: number;
  status: InvoiceStatus;
  note: string | null;
  createdBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: Uuid;
  invoiceId: Uuid;
  amount: number; // negative = reversal
  method: PaymentMethod;
  reference: string | null;
  paidOn: string;
  reversesPaymentId: Uuid | null;
  note: string | null;
  createdBy: Uuid | null;
  createdAt: Date;
}

const invoiceStatusCheck = invoiceStatuses.map((s) => `'${s}'`).join(', ');
const methodCheck = paymentMethods.map((s) => `'${s}'`).join(', ');

export const createInvoiceTableSql = `
CREATE TABLE IF NOT EXISTS ${INVOICE_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "unitId" UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  "leaseId" UUID NOT NULL REFERENCES leases(id) ON DELETE RESTRICT,
  "invoiceNo" VARCHAR(50) NOT NULL,
  "billingMonth" DATE NOT NULL,
  "dueDate" DATE NOT NULL,
  "rentAmount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("rentAmount" >= 0),
  "utilitiesAmount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("utilitiesAmount" >= 0),
  "penaltyAmount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("penaltyAmount" >= 0),
  "otherAmount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("otherAmount" >= 0),
  "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "paidAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'unpaid' CHECK (status IN (${invoiceStatusCheck})),
  note TEXT,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createPaymentTableSql = `
CREATE TABLE IF NOT EXISTS ${PAYMENT_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId" UUID NOT NULL REFERENCES ${INVOICE_TABLE_NAME}(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  method VARCHAR(32) NOT NULL CHECK (method IN (${methodCheck})),
  reference VARCHAR(100),
  "paidOn" DATE NOT NULL,
  "reversesPaymentId" UUID REFERENCES ${PAYMENT_TABLE_NAME}(id) ON DELETE RESTRICT,
  note TEXT,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createInvoiceIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS invoices_lease_month_uniq ON ${INVOICE_TABLE_NAME} ("leaseId", "billingMonth") WHERE status <> 'void';`,
  `CREATE UNIQUE INDEX IF NOT EXISTS invoices_no_uniq ON ${INVOICE_TABLE_NAME} ("invoiceNo");`,
  `CREATE INDEX IF NOT EXISTS invoices_property_idx ON ${INVOICE_TABLE_NAME} ("propertyId");`,
  `CREATE INDEX IF NOT EXISTS invoices_tenant_idx ON ${INVOICE_TABLE_NAME} ("tenantId");`,
  `CREATE INDEX IF NOT EXISTS payments_invoice_idx ON ${PAYMENT_TABLE_NAME} ("invoiceId");`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_reverses_uniq ON ${PAYMENT_TABLE_NAME} ("reversesPaymentId") WHERE "reversesPaymentId" IS NOT NULL;`,
];
