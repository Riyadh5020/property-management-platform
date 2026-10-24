import { ADMIN_TABLE_NAME, PROPERTY_TABLE_NAME } from '../constants/database';

export const MANAGER_PROPERTY_TABLE_NAME = 'manager_properties';

export const createManagerPropertyTableSql = `
CREATE TABLE IF NOT EXISTS ${MANAGER_PROPERTY_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "managerId" UUID NOT NULL REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE CASCADE,
  "propertyId" UUID NOT NULL REFERENCES ${PROPERTY_TABLE_NAME}(id) ON DELETE CASCADE,
  "createdBy" UUID REFERENCES ${ADMIN_TABLE_NAME}(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deletedAt" TIMESTAMPTZ
);
`;

export const createManagerPropertyIndexesSql = [
  `CREATE UNIQUE INDEX IF NOT EXISTS manager_properties_uniq ON ${MANAGER_PROPERTY_TABLE_NAME} ("managerId", "propertyId") WHERE "deletedAt" IS NULL;`,
  `CREATE INDEX IF NOT EXISTS manager_properties_property_idx ON ${MANAGER_PROPERTY_TABLE_NAME} ("propertyId") WHERE "deletedAt" IS NULL;`,
];
