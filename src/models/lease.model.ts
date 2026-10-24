import { LEASE_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { LEASE_TABLE_NAME };

export const leaseStatuses = ['draft', 'active', 'expired', 'terminated'] as const;
export type LeaseStatus = (typeof leaseStatuses)[number];

export interface Lease {
  id: Uuid;
  propertyId: Uuid;
  unitId: Uuid;
  tenantId: Uuid;
  agreementNo: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  escalationPercent: number;
  noticePeriodDays: number;
  status: LeaseStatus;
  createdBy: Uuid | null;
  updatedBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateLeaseInput {
  propertyId: string;
  unitId: string;
  tenantId: string;
  agreementNo?: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit?: number;
  escalationPercent?: number;
  noticePeriodDays?: number;
  status?: LeaseStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateLeaseInput = Partial<
  Omit<CreateLeaseInput, 'propertyId' | 'unitId' | 'tenantId' | 'createdBy'>
>;

const statusCheck = leaseStatuses.map((s) => `'${s}'`).join(', ');

export const createLeaseTableSql = `
CREATE TABLE IF NOT EXISTS ${LEASE_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "unitId" UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  "tenantId" UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  "agreementNo" VARCHAR(100),
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "monthlyRent" NUMERIC(12,2) NOT NULL CHECK ("monthlyRent" >= 0),
  "securityDeposit" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("securityDeposit" >= 0),
  "escalationPercent" NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK ("escalationPercent" >= 0),
  "noticePeriodDays" INTEGER NOT NULL DEFAULT 30 CHECK ("noticePeriodDays" >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN (${statusCheck})),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  CHECK ("endDate" >= "startDate")
);
`;

export const createLeaseIndexesSql = [
  `CREATE INDEX IF NOT EXISTS leases_property_idx ON ${LEASE_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS leases_unit_idx ON ${LEASE_TABLE_NAME} ("unitId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS leases_tenant_idx ON ${LEASE_TABLE_NAME} ("tenantId") WHERE "deletedAt" IS NULL;`,
];
