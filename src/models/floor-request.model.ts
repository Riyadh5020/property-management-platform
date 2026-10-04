import { FLOOR_REQUEST_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';
import { type PropertyId } from './properties.model';

export { FLOOR_REQUEST_TABLE_NAME };

export type FloorRequestId = Uuid;

export const floorRequestStatuses = ['pending', 'approved', 'denied'] as const;
export type FloorRequestStatus = (typeof floorRequestStatuses)[number];

export interface FloorRequest {
  id: FloorRequestId;
  propertyId: PropertyId;
  ownerId: AdminId;
  requestedFloorCount: number;
  note: string;
  status: FloorRequestStatus;
  reviewedBy: AdminId | null;
  reviewedAt: Date | null;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFloorRequestInput {
  propertyId: PropertyId;
  ownerId: AdminId;
  requestedFloorCount: number;
  note: string;
}

export interface UpdateFloorRequestInput {
  status?: FloorRequestStatus;
  reviewedBy?: AdminId | null;
  reviewedAt?: Date | null;
  consumedAt?: Date | null;
}

export const floorRequestDefaults = {
  status: 'pending' as FloorRequestStatus,
} as const;

const floorRequestStatusCheck = floorRequestStatuses.map((s) => `'${s}'`).join(', ');

export const createFloorRequestTableSql = `
CREATE TABLE IF NOT EXISTS ${FLOOR_REQUEST_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "ownerId" UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  "requestedFloorCount" INTEGER NOT NULL CHECK ("requestedFloorCount" > 0),
  note TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT '${floorRequestDefaults.status}' CHECK (status IN (${floorRequestStatusCheck})),
  "reviewedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "reviewedAt" TIMESTAMPTZ,
  "consumedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createFloorRequestIndexesSql = [
  `CREATE INDEX IF NOT EXISTS floor_requests_property_id_idx ON ${FLOOR_REQUEST_TABLE_NAME} ("propertyId");`,
  `CREATE INDEX IF NOT EXISTS floor_requests_owner_id_idx ON ${FLOOR_REQUEST_TABLE_NAME} ("ownerId");`,
  `CREATE INDEX IF NOT EXISTS floor_requests_status_idx ON ${FLOOR_REQUEST_TABLE_NAME} (status);`,
];
