import { TENANT_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';

export { TENANT_TABLE_NAME };

export type TenantId = Uuid;

export const tenantStatuses = ['active', 'notice_served', 'moved_out'] as const;
export type TenantStatus = (typeof tenantStatuses)[number];

export const tenantRoles = ['primary', 'co_tenant'] as const;
export type TenantRole = (typeof tenantRoles)[number];

export const idDocTypes = ['nid', 'passport', 'driving_licence'] as const;
export type IdDocType = (typeof idDocTypes)[number];

export interface Tenant {
  id: TenantId;
  propertyId: Uuid;
  unitId: Uuid | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  idDocType: IdDocType | null;
  idDocNumber: string | null;
  role: TenantRole;
  moveInDate: string | null;
  moveOutDate: string | null;
  status: TenantStatus;
  createdBy: AdminId | null;
  updatedBy: AdminId | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTenantInput {
  propertyId: string;
  unitId?: string | null;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  idDocType?: IdDocType | null;
  idDocNumber?: string | null;
  role?: TenantRole;
  moveInDate?: string | null;
  moveOutDate?: string | null;
  status?: TenantStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateTenantInput = Partial<Omit<CreateTenantInput, 'propertyId' | 'createdBy'>>;

const statusCheck = tenantStatuses.map((s) => `'${s}'`).join(', ');
const roleCheck = tenantRoles.map((s) => `'${s}'`).join(', ');
const docCheck = idDocTypes.map((s) => `'${s}'`).join(', ');

export const createTenantTableSql = `
CREATE TABLE IF NOT EXISTS ${TENANT_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "unitId" UUID REFERENCES units(id) ON DELETE SET NULL,
  "fullName" VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  "idDocType" VARCHAR(32) CHECK ("idDocType" IN (${docCheck})),
  "idDocNumber" VARCHAR(100),
  role VARCHAR(32) NOT NULL DEFAULT 'primary' CHECK (role IN (${roleCheck})),
  "moveInDate" DATE,
  "moveOutDate" DATE,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN (${statusCheck})),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createTenantIndexesSql = [
  `CREATE INDEX IF NOT EXISTS tenants_property_idx ON ${TENANT_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS tenants_unit_idx ON ${TENANT_TABLE_NAME} ("unitId") WHERE "deletedAt" IS NULL;`,
];
