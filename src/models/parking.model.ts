import { PARKING_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { PARKING_TABLE_NAME };

export const parkingTypes = ['resident', 'visitor', 'staff'] as const;
export type ParkingType = (typeof parkingTypes)[number];

export const parkingStatuses = ['free', 'assigned', 'blocked'] as const;
export type ParkingStatus = (typeof parkingStatuses)[number];

export interface ParkingSlot {
  id: Uuid;
  propertyId: Uuid;
  slotNumber: string;
  slotType: ParkingType;
  unitId: Uuid | null;
  vehicleNumber: string | null;
  monthlyFee: number;
  status: ParkingStatus;
  createdBy: Uuid | null;
  updatedBy: Uuid | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateParkingInput {
  propertyId: string;
  slotNumber: string;
  slotType?: ParkingType;
  unitId?: string | null;
  vehicleNumber?: string | null;
  monthlyFee?: number;
  status?: ParkingStatus;
  createdBy?: string | null;
  updatedBy?: string | null;
}

export type UpdateParkingInput = Partial<Omit<CreateParkingInput, 'propertyId' | 'createdBy'>>;

const list = (a: readonly string[]): string => a.map((s) => `'${s}'`).join(', ');

export const createParkingTableSql = `
CREATE TABLE IF NOT EXISTS ${PARKING_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  "slotNumber" VARCHAR(50) NOT NULL,
  "slotType" VARCHAR(32) NOT NULL DEFAULT 'resident' CHECK ("slotType" IN (${list(parkingTypes)})),
  "unitId" UUID REFERENCES units(id) ON DELETE SET NULL,
  "vehicleNumber" VARCHAR(50),
  "monthlyFee" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("monthlyFee" >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'free' CHECK (status IN (${list(parkingStatuses)})),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createParkingIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS parking_slot_uniq ON ${PARKING_TABLE_NAME} ("propertyId", "slotNumber") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS parking_unit_idx ON ${PARKING_TABLE_NAME} ("unitId") WHERE "deletedAt" IS NULL;`,
];
