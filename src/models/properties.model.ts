import { PROPERTY_TABLE_NAME } from '../constants/database';
import { propertyTypes, propertyStatuses, listingTypes } from '../enums/property.enum';
import { type JsonValue, type Uuid } from '../utils/common';
import { type AdminId } from './admin.model';

export { PROPERTY_TABLE_NAME };

export type PropertyType = (typeof propertyTypes)[number];
export type PropertyStatus = (typeof propertyStatuses)[number];
export type ListingType = (typeof listingTypes)[number];

export type PropertyId = Uuid;

export interface Property {
  id: PropertyId;

  title: string;
  description: string | null;

  type: PropertyType;
  listingType: ListingType;

  price: number;
  currency: string;

  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;

  latitude: number | null;
  longitude: number | null;

  bedrooms: number | null;
  bathrooms: number | null;
  areaSize: number | null;
  areaUnit: string | null;

  amenities: JsonValue | null;

  images: string[] | null;

  status: PropertyStatus;

  ownerId: AdminId | null;

  createdBy: AdminId | null;
  updatedBy: AdminId | null;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreatePropertyInput {
  title: string;
  description?: string | null;
  type: PropertyType;
  listingType: ListingType;
  price: number;
  currency?: string;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaSize?: number | null;
  areaUnit?: string | null;
  amenities?: JsonValue | null;
  images?: string[] | null;
  status?: PropertyStatus;
  ownerId?: AdminId | null;
  createdBy?: AdminId | null;
  updatedBy?: AdminId | null;
  deletedAt?: Date | null;
}

export interface UpdatePropertyInput extends Partial<
  Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>
> {
  updatedAt?: Date;
}

export const propertyDefaults = {
  status: 'draft' as PropertyStatus,
  currency: 'USD',
} as const;

const propertyTypeCheck = propertyTypes.map((type) => `'${type}'`).join(', ');
const propertyStatusCheck = propertyStatuses.map((status) => `'${status}'`).join(', ');
const listingTypeCheck = listingTypes.map((listingType) => `'${listingType}'`).join(', ');

export const createPropertyTableSql = `
CREATE TABLE IF NOT EXISTS ${PROPERTY_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(32) NOT NULL CHECK (type IN (${propertyTypeCheck})),
  "listingType" VARCHAR(32) NOT NULL CHECK ("listingType" IN (${listingTypeCheck})),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT '${propertyDefaults.currency}',
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) NOT NULL,
  "postalCode" VARCHAR(30),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  bedrooms INTEGER,
  bathrooms INTEGER,
  "areaSize" DOUBLE PRECISION,
  "areaUnit" VARCHAR(20),
  amenities JSONB,
  images TEXT[],
  status VARCHAR(32) NOT NULL DEFAULT '${propertyDefaults.status}' CHECK (status IN (${propertyStatusCheck})),
  "ownerId" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "updatedBy" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createPropertyIndexesSql = [
  `CREATE INDEX IF NOT EXISTS properties_city_idx ON ${PROPERTY_TABLE_NAME} (city);`,
  `CREATE INDEX IF NOT EXISTS properties_status_idx ON ${PROPERTY_TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS properties_listing_type_idx ON ${PROPERTY_TABLE_NAME} ("listingType");`,
  `CREATE INDEX IF NOT EXISTS properties_owner_id_idx ON ${PROPERTY_TABLE_NAME} ("ownerId");`,
  `CREATE INDEX IF NOT EXISTS properties_title_idx ON ${PROPERTY_TABLE_NAME} (LOWER(title)) WHERE "deletedAt" IS NULL;`,
];
