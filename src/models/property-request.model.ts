import { PROPERTY_REQUEST_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';

export { PROPERTY_REQUEST_TABLE_NAME };

export type PropertyRequestId = Uuid;

export const propertyRequestStatuses = ['pending', 'approved', 'denied'] as const;
export type PropertyRequestStatus = (typeof propertyRequestStatuses)[number];

export interface PropertyRequest {
  id: PropertyRequestId;
  ownerId: AdminId;
  note: string | null;
  title: string | null;
  buildingNumber: string | null;
  floors: number | null;
  totalUnits: number | null;
  totalArea: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  status: PropertyRequestStatus;
  reviewedBy: AdminId | null;
  reviewedAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertyRequestInput {
  ownerId: AdminId;
  note?: string | null;
  title: string;
  buildingNumber?: string | null;
  floors: number;
  totalUnits?: number | null;
  totalArea?: number | null;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string | null;
}

export interface UpdatePropertyRequestInput {
  status?: PropertyRequestStatus;
  reviewedBy?: AdminId | null;
  reviewedAt?: Date | null;
  consumedAt?: Date | null;
}

export const propertyRequestDefaults = {
  status: 'pending' as PropertyRequestStatus,
} as const;

const propertyRequestStatusCheck = propertyRequestStatuses.map((s) => `'${s}'`).join(', ');

export const createPropertyRequestTableSql = `
CREATE TABLE IF NOT EXISTS ${PROPERTY_REQUEST_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  note TEXT,
  title VARCHAR(255),
  "buildingNumber" VARCHAR(100),
  floors INTEGER,
  "totalUnits" INTEGER,
  "totalArea" NUMERIC(12,2),
  address VARCHAR(500),
  city VARCHAR(255),
  state VARCHAR(255),
  country VARCHAR(255),
  "postalCode" VARCHAR(50),  status VARCHAR(32) NOT NULL DEFAULT '${propertyRequestDefaults.status}' CHECK (status IN (${propertyRequestStatusCheck})),
  "reviewedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMPTZ,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createPropertyRequestIndexesSql = [
  `CREATE INDEX IF NOT EXISTS property_requests_owner_id_idx ON ${PROPERTY_REQUEST_TABLE_NAME} ("ownerId");`,
  `CREATE INDEX IF NOT EXISTS property_requests_status_idx ON ${PROPERTY_REQUEST_TABLE_NAME} (status);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ALTER COLUMN note DROP NOT NULL;`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS title VARCHAR(255);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS "buildingNumber" VARCHAR(100);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS floors INTEGER;`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS "totalUnits" INTEGER;`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS "totalArea" NUMERIC(12,2);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS address VARCHAR(500);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS city VARCHAR(255);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS state VARCHAR(255);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS country VARCHAR(255);`,
  `ALTER TABLE ${PROPERTY_REQUEST_TABLE_NAME} ADD COLUMN IF NOT EXISTS "postalCode" VARCHAR(50);`,
];
