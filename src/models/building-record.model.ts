import {
  BUILDING_RECORD_TABLE_NAME,
  SUBSCRIPTION_REMINDER_TABLE_NAME,
} from '../constants/database';
import { type Uuid } from '../utils/common';

export { BUILDING_RECORD_TABLE_NAME, SUBSCRIPTION_REMINDER_TABLE_NAME };

// Simple day-to-day records that share one table: their fields live in `data`, and each kind's
// fields are validated in building-record.middleware.ts.
export const recordKinds = [
  'notices',
  'visitors',
  'staff',
  'utilities',
  'amenities',
  'emergencyContacts',
  'tickets',
] as const;
export type RecordKind = (typeof recordKinds)[number];

export interface BuildingRecord {
  id: Uuid;
  kind: RecordKind;
  propertyId: Uuid | null;
  ownerId: Uuid | null;
  title: string;
  status: string | null;
  data: Record<string, unknown>;
  propertyTitle?: string | null;
  createdBy: Uuid | null;
  updatedBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const createBuildingRecordTableSql = `
CREATE TABLE IF NOT EXISTS ${BUILDING_RECORD_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(32) NOT NULL,
  "propertyId" UUID REFERENCES properties(id) ON DELETE CASCADE,
  "ownerId" UUID REFERENCES admins(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(64),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

// One row per reminder sent. A renewal changes "endsAt", so the next cycle reminds again.
export const createSubscriptionReminderTableSql = `
CREATE TABLE IF NOT EXISTS ${SUBSCRIPTION_REMINDER_TABLE_NAME} (
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "endsAt" TIMESTAMPTZ NOT NULL,
  days INTEGER NOT NULL,
  "sentAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("propertyId", "endsAt", days)
);
`;

export const createBuildingRecordIndexesSql = [
  `CREATE INDEX IF NOT EXISTS building_records_kind_idx ON ${BUILDING_RECORD_TABLE_NAME} (kind, "createdAt" DESC) WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS building_records_property_idx ON ${BUILDING_RECORD_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
];
