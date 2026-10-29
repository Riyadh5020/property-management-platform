import { MAINTENANCE_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { MAINTENANCE_TABLE_NAME };

export const maintenancePriorities = ['low', 'medium', 'high', 'urgent'] as const;
export type MaintenancePriority = (typeof maintenancePriorities)[number];

export const maintenanceStatuses = ['open', 'in_progress', 'completed', 'cancelled'] as const;
export type MaintenanceStatus = (typeof maintenanceStatuses)[number];

export const maintenanceCategories = ['tenant_request', 'preventive', 'common_area'] as const;
export type MaintenanceCategory = (typeof maintenanceCategories)[number];

// Manager requests start as pending; the owner (or superAdmin) approves or rejects them.
export const maintenanceApprovalStatuses = ['pending', 'approved', 'rejected'] as const;
export type MaintenanceApprovalStatus = (typeof maintenanceApprovalStatuses)[number];

export interface Maintenance {
  id: Uuid;
  propertyId: Uuid;
  unitId: Uuid | null;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  assignee: string | null;
  scheduledFor: string | null;
  completedOn: string | null;
  cost: number;
  approvalStatus: MaintenanceApprovalStatus;
  ownerNote: string | null;
  reviewedBy: Uuid | null;
  reviewedAt: Date | null;
  expenseId: Uuid | null;
  createdBy: Uuid | null;
  updatedBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateMaintenanceInput {
  propertyId: string;
  unitId?: string | null;
  title: string;
  description?: string | null;
  category?: MaintenanceCategory;
  priority?: MaintenancePriority;
  status?: MaintenanceStatus;
  assignee?: string | null;
  scheduledFor?: string | null;
  cost?: number;
  approvalStatus?: MaintenanceApprovalStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateMaintenanceInput = Partial<
  Omit<CreateMaintenanceInput, 'propertyId' | 'createdBy' | 'approvalStatus'>
>;

export interface ReviewMaintenanceInput {
  decision: Exclude<MaintenanceApprovalStatus, 'pending'>;
  note?: string | null;
  priority?: MaintenancePriority;
  assignee?: string | null;
  scheduledFor?: string | null;
  cost?: number;
}

const list = (a: readonly string[]): string => a.map((s) => `'${s}'`).join(', ');

export const createMaintenanceTableSql = `
CREATE TABLE IF NOT EXISTS ${MAINTENANCE_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "unitId" UUID REFERENCES units(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(32) NOT NULL DEFAULT 'tenant_request' CHECK (category IN (${list(maintenanceCategories)})),
  priority VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (priority IN (${list(maintenancePriorities)})),
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN (${list(maintenanceStatuses)})),
  assignee VARCHAR(255),
  "scheduledFor" DATE,
  "completedOn" DATE,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createMaintenanceIndexesSql = [
  `CREATE INDEX IF NOT EXISTS maintenance_property_idx ON ${MAINTENANCE_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS maintenance_status_idx ON ${MAINTENANCE_TABLE_NAME} (status) WHERE "deletedAt" IS NULL;`,
  // Approval workflow (additive; existing rows default to approved so they are not blocked).
  `ALTER TABLE ${MAINTENANCE_TABLE_NAME} ADD COLUMN IF NOT EXISTS "approvalStatus" VARCHAR(32) NOT NULL DEFAULT 'approved' CHECK ("approvalStatus" IN (${list(maintenanceApprovalStatuses)}));`,
  `ALTER TABLE ${MAINTENANCE_TABLE_NAME} ADD COLUMN IF NOT EXISTS "ownerNote" TEXT;`,
  `ALTER TABLE ${MAINTENANCE_TABLE_NAME} ADD COLUMN IF NOT EXISTS "reviewedBy" UUID REFERENCES admins(id) ON DELETE SET NULL;`,
  `ALTER TABLE ${MAINTENANCE_TABLE_NAME} ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMPTZ;`,
  `ALTER TABLE ${MAINTENANCE_TABLE_NAME} ADD COLUMN IF NOT EXISTS "expenseId" UUID REFERENCES expenses(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS maintenance_approval_idx ON ${MAINTENANCE_TABLE_NAME} ("approvalStatus") WHERE "deletedAt" IS NULL;`,
];
