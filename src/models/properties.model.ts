import { PROPERTY_TABLE_NAME } from '../constants/database';
import { listingTypes, propertyStatuses, propertyTypes } from '../enums/property.enum';
import { subscriptionStatuses } from '../enums/subscription-plan.enum';
import { type JsonValue, type Uuid } from '../utils/common';

import { type AdminId } from './admin.model';
import { type SubscriptionPlanId } from './subscription-plan.model';

export { PROPERTY_TABLE_NAME };

export type PropertyType = (typeof propertyTypes)[number];
export type PropertyStatus = (typeof propertyStatuses)[number];
export type ListingType = (typeof listingTypes)[number];
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

export type PropertyId = Uuid;

export interface Property {
  id: PropertyId;

  title: string;
  buildingNumber: string | null;
  description: string | null;

  type: PropertyType;
  listingType: ListingType;

  price: number;
  currency: string;

  planId?: string | null;
  planName?: string | null;
  subscriptionStartsAt?: Date | string | null;
  subscriptionEndsAt?: Date | string | null;
  subscriptionStatus?: string | null;

  floors: number | null;
  totalUnits: number | null;
  totalArea: number | null;

  address: string;
  city: string;
  state: string | null;
  country: string;
  postalCode: string | null;

  latitude: number | null;
  longitude: number | null;

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
  buildingNumber?: string | null;
  description?: string | null;
  type: PropertyType;
  listingType?: ListingType;
  price?: number; // set by the server from the selected plan
  currency?: string;
  planId?: SubscriptionPlanId | null;
  subscriptionStartsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  subscriptionStatus?: SubscriptionStatus | null;
  floors?: number | null;
  totalUnits?: number | null;
  totalArea?: number | null;
  address: string;
  city: string;
  state?: string | null;
  country: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  listingType: 'rent' as ListingType,
} as const;

const propertyTypeCheck = propertyTypes.map((type) => `'${type}'`).join(', ');
const propertyStatusCheck = propertyStatuses.map((status) => `'${status}'`).join(', ');
const listingTypeCheck = listingTypes.map((listingType) => `'${listingType}'`).join(', ');
const subscriptionStatusCheck = subscriptionStatuses.map((s) => `'${s}'`).join(', ');

export const createPropertyTableSql = `
CREATE TABLE IF NOT EXISTS ${PROPERTY_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  "buildingNumber" VARCHAR(100),
  description TEXT,
  type VARCHAR(32) NOT NULL CHECK (type IN (${propertyTypeCheck})),
  "listingType" VARCHAR(32) NOT NULL DEFAULT '${propertyDefaults.listingType}' CHECK ("listingType" IN (${listingTypeCheck})),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency VARCHAR(10) NOT NULL DEFAULT '${propertyDefaults.currency}',
  floors INTEGER,
  "totalUnits" INTEGER,
  "totalArea" DOUBLE PRECISION,
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  country VARCHAR(100) NOT NULL,
  "postalCode" VARCHAR(30),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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

// The ALTERs live here because this array runs after every table exists,
// so the reference to subscription_plans is safe on an existing database.
export const createPropertyIndexesSql = [
  `ALTER TABLE ${PROPERTY_TABLE_NAME} ADD COLUMN IF NOT EXISTS "planId" UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;`,
  `ALTER TABLE ${PROPERTY_TABLE_NAME} ADD COLUMN IF NOT EXISTS "subscriptionStartsAt" TIMESTAMPTZ;`,
  `ALTER TABLE ${PROPERTY_TABLE_NAME} ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMPTZ;`,
  `ALTER TABLE ${PROPERTY_TABLE_NAME} ADD COLUMN IF NOT EXISTS "subscriptionStatus" VARCHAR(32) CHECK ("subscriptionStatus" IN (${subscriptionStatusCheck}));`,
  `CREATE INDEX IF NOT EXISTS properties_plan_id_idx ON ${PROPERTY_TABLE_NAME} ("planId");`,
  `CREATE INDEX IF NOT EXISTS properties_city_idx ON ${PROPERTY_TABLE_NAME} (city);`,
  `CREATE INDEX IF NOT EXISTS properties_status_idx ON ${PROPERTY_TABLE_NAME} (status);`,
  `CREATE INDEX IF NOT EXISTS properties_listing_type_idx ON ${PROPERTY_TABLE_NAME} ("listingType");`,
  `CREATE INDEX IF NOT EXISTS properties_owner_id_idx ON ${PROPERTY_TABLE_NAME} ("ownerId");`,
  `CREATE INDEX IF NOT EXISTS properties_title_idx ON ${PROPERTY_TABLE_NAME} (LOWER(title)) WHERE "deletedAt" IS NULL;`,
];
