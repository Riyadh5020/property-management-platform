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
  note: string;
  status: PropertyRequestStatus;
  reviewedBy: AdminId | null;
  reviewedAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePropertyRequestInput {
  ownerId: AdminId;
  note: string;
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
  note TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT '${propertyRequestDefaults.status}' CHECK (status IN (${propertyRequestStatusCheck})),
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
];
