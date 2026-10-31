import { COUPON_TABLE_NAME, SUBSCRIPTION_INVOICE_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { COUPON_TABLE_NAME, SUBSCRIPTION_INVOICE_TABLE_NAME };

export const subscriptionInvoiceStatuses = ['due', 'paid', 'void'] as const;
export type SubscriptionInvoiceStatus = (typeof subscriptionInvoiceStatuses)[number];

export const subscriptionPaymentMethods = ['cash', 'bank', 'bkash', 'nagad', 'other'] as const;
export const couponTypes = ['percent', 'fixed'] as const;
export const couponStatuses = ['active', 'inactive'] as const;

export interface SubscriptionInvoice {
  id: Uuid;
  invoiceNo: string;
  propertyId: Uuid | null;
  ownerId: Uuid | null;
  planId: Uuid | null;
  description: string;
  amount: number;
  discountAmount: number;
  couponCode: string | null;
  status: SubscriptionInvoiceStatus;
  dueDate: string;
  paidOn: string | null;
  method: string | null;
  reference: string | null;
  note: string | null;
  createdBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Coupon {
  id: Uuid;
  code: string;
  discountType: (typeof couponTypes)[number];
  value: number;
  maxUses: number | null;
  usedCount: number;
  expiresOn: string | null;
  status: (typeof couponStatuses)[number];
  createdBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
}

export const createSubscriptionInvoiceTableSql = `
CREATE SEQUENCE IF NOT EXISTS subscription_invoice_no_seq;
CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_INVOICE_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceNo" VARCHAR(50) NOT NULL UNIQUE,
  "propertyId" UUID REFERENCES properties(id) ON DELETE SET NULL,
  "ownerId" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "planId" UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  "discountAmount" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("discountAmount" >= 0),
  "couponCode" VARCHAR(50),
  status VARCHAR(16) NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'paid', 'void')),
  "dueDate" DATE NOT NULL,
  "paidOn" DATE,
  method VARCHAR(16),
  reference VARCHAR(255),
  note TEXT,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createCouponTableSql = `
CREATE TABLE IF NOT EXISTS ${COUPON_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  "discountType" VARCHAR(16) NOT NULL CHECK ("discountType" IN ('percent', 'fixed')),
  value NUMERIC(12,2) NOT NULL CHECK (value > 0),
  "maxUses" INTEGER CHECK ("maxUses" > 0),
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresOn" DATE,
  status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createSubscriptionBillingIndexesSql = [
  `CREATE INDEX IF NOT EXISTS subscription_invoices_owner_idx ON ${SUBSCRIPTION_INVOICE_TABLE_NAME} ("ownerId", "createdAt" DESC);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_uniq ON ${COUPON_TABLE_NAME} (LOWER(code));`,
];
