import { BUILDING_TABLE_NAME, FLOOR_TABLE_NAME } from '../constants/database';
import { type JsonValue, type Uuid } from '../utils/common';
import { type AdminId } from './admin.model';
import { type BuildingId } from './building.model';

export { FLOOR_TABLE_NAME };

export type FloorId = Uuid;

export interface Floor {
  id: FloorId;
  buildingId: BuildingId;

  floorNumber: number;
  name: string | null;
  totalUnits: number | null;
  totalArea: number | null;
  areaUnit: string | null;
  description: string | null;
  amenities: JsonValue | null;
  status: 'draft' | 'active' | 'inactive' | 'maintenance';

  createdBy: AdminId | null;
  updatedBy: AdminId | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateFloorInput {
  buildingId: BuildingId;
  floorNumber: number;
  name?: string | null;
  totalUnits?: number | null;
  totalArea?: number | null;
  areaUnit?: string | null;
  description?: string | null;
  amenities?: JsonValue | null;
  status?: Floor['status'];
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
  deletedAt?: Date | null;
}

export interface UpdateFloorInput extends Partial<
  Omit<Floor, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
> {
  updatedAt?: Date;
}

export const floorStatuses = ['draft', 'active', 'inactive', 'maintenance'] as const;
export type FloorStatus = (typeof floorStatuses)[number];

export const floorDefaults = {
  status: 'draft' as FloorStatus,
  areaUnit: 'sqft',
} as const;

const floorStatusCheck = floorStatuses.map((status) => `'${status}'`).join(', ');

export const createFloorTableSql = `
CREATE TABLE IF NOT EXISTS ${FLOOR_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "buildingId" UUID NOT NULL REFERENCES ${BUILDING_TABLE_NAME}(id) ON DELETE CASCADE,
  "floorNumber" INTEGER NOT NULL CHECK ("floorNumber" >= 0),
  name VARCHAR(100),
  "totalUnits" INTEGER,
  "totalArea" DOUBLE PRECISION,
  "areaUnit" VARCHAR(20) DEFAULT '${floorDefaults.areaUnit}',
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT '${floorDefaults.status}' CHECK (status IN (${floorStatusCheck})),
  amenities JSONB,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createFloorIndexesSql = [
  `CREATE INDEX IF NOT EXISTS floors_building_id_idx ON ${FLOOR_TABLE_NAME} ("buildingId");`,
  `CREATE INDEX IF NOT EXISTS floors_status_idx ON ${FLOOR_TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS floors_number_idx ON ${FLOOR_TABLE_NAME} ("buildingId", "floorNumber");`,
  `CREATE INDEX IF NOT EXISTS floors_name_idx ON ${FLOOR_TABLE_NAME} (LOWER(name)) WHERE "deletedAt" IS NULL;`,
];
