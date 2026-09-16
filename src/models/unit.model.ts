import { FLOOR_TABLE_NAME, UNIT_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';
import { type FloorId } from './floor.model';

export { UNIT_TABLE_NAME };

export type UnitId = Uuid;

export const unitTypes = ['apartment', 'office', 'shop', 'parking', 'common'] as const;
export type UnitType = (typeof unitTypes)[number];

export const unitStatuses = ['vacant', 'occupied', 'reserved', 'maintenance'] as const;
export type UnitStatus = (typeof unitStatuses)[number];

export interface Unit {
  id: UnitId;
  floorId: FloorId;

  unitCode: string;
  unitType: UnitType;
  areaSize: number;

  bedrooms: number | null;
  bathrooms: number | null;
  hasKitchen: boolean;
  hasBalcony: boolean;

  rent: number | null;
  status: UnitStatus;

  createdBy: AdminId | null;
  updatedBy: AdminId | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateUnitInput {
  floorId: FloorId;
  unitCode: string;
  unitType: UnitType;
  areaSize: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  hasKitchen?: boolean;
  hasBalcony?: boolean;
  rent?: number | null;
  status?: UnitStatus;
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
  deletedAt?: Date | null;
}

export interface UpdateUnitInput extends Partial<
  Omit<Unit, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
> {
  updatedAt?: Date;
}

export const unitDefaults = {
  unitType: 'apartment' as UnitType,
  status: 'vacant' as UnitStatus,
} as const;

const unitTypeCheck = unitTypes.map((t) => `'${t}'`).join(', ');
const unitStatusCheck = unitStatuses.map((s) => `'${s}'`).join(', ');

export const createUnitTableSql = `
CREATE TABLE IF NOT EXISTS ${UNIT_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "floorId" UUID NOT NULL REFERENCES ${FLOOR_TABLE_NAME}(id) ON DELETE CASCADE,
  "unitCode" VARCHAR(50) NOT NULL,
  "unitType" VARCHAR(32) NOT NULL DEFAULT '${unitDefaults.unitType}' CHECK ("unitType" IN (${unitTypeCheck})),
  "areaSize" DOUBLE PRECISION NOT NULL CHECK ("areaSize" > 0),
  bedrooms INTEGER,
  bathrooms INTEGER,
  "hasKitchen" BOOLEAN NOT NULL DEFAULT false,
  "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
  rent NUMERIC(12,2),
  status VARCHAR(32) NOT NULL DEFAULT '${unitDefaults.status}' CHECK (status IN (${unitStatusCheck})),
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ,
  UNIQUE ("floorId", "unitCode")
);
`;

export const createUnitIndexesSql = [
  `CREATE INDEX IF NOT EXISTS units_floor_id_idx ON ${UNIT_TABLE_NAME} ("floorId");`,
  `CREATE INDEX IF NOT EXISTS units_status_idx ON ${UNIT_TABLE_NAME} (status);`,
];
