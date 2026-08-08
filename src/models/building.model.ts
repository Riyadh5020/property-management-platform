import { BUILDING_TABLE_NAME, PROPERTY_TABLE_NAME } from '../constants/database';
import { type JsonValue, type Uuid } from '../utils/common';
import { type AdminId } from './admin.model';
import { type PropertyId } from './properties.model';

export { BUILDING_TABLE_NAME };

export const buildingStatuses = ['draft', 'active', 'inactive', 'maintenance'] as const;
export type BuildingStatus = (typeof buildingStatuses)[number];

export type BuildingId = Uuid;

export interface Building {
  id: BuildingId;
  propertyId: PropertyId;

  name: string;
  buildingNumber: string | null;
  floors: number | null;
  totalUnits: number | null;
  totalArea: number | null;
  areaUnit: string | null;
  description: string | null;

  status: BuildingStatus;
  amenities: JsonValue | null;
  images: string[] | null;

  createdBy: AdminId | null;
  updatedBy: AdminId | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateBuildingInput {
  propertyId: PropertyId;
  name: string;
  buildingNumber?: string | null;
  floors?: number | null;
  totalUnits?: number | null;
  totalArea?: number | null;
  areaUnit?: string | null;
  description?: string | null;
  status?: BuildingStatus;
  amenities?: JsonValue | null;
  images?: string[] | null;
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
  deletedAt?: Date | null;
}

export interface UpdateBuildingInput extends Partial<
  Omit<Building, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
> {
  updatedAt?: Date;
}

export const buildingDefaults = {
  status: 'draft' as BuildingStatus,
  areaUnit: 'sqft',
} as const;

const buildingStatusCheck = buildingStatuses.map((status) => `'${status}'`).join(', ');

export const createBuildingTableSql = `
CREATE TABLE IF NOT EXISTS ${BUILDING_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES ${PROPERTY_TABLE_NAME}(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "buildingNumber" VARCHAR(100),
  floors INTEGER,
  "totalUnits" INTEGER,
  "totalArea" DOUBLE PRECISION,
  "areaUnit" VARCHAR(20) DEFAULT '${buildingDefaults.areaUnit}',
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT '${buildingDefaults.status}' CHECK (status IN (${buildingStatusCheck})),
  amenities JSONB,
  images TEXT[],
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createBuildingIndexesSql = [
  `CREATE INDEX IF NOT EXISTS buildings_property_id_idx ON ${BUILDING_TABLE_NAME} ("propertyId");`,
  `CREATE INDEX IF NOT EXISTS buildings_status_idx ON ${BUILDING_TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS buildings_name_idx ON ${BUILDING_TABLE_NAME} (LOWER(name)) WHERE "deletedAt" IS NULL;`,
];
