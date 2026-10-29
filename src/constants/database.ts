export const DATABASE_TABLES = {
  admin: 'admins',
  user: 'users',
  property: 'properties',
  building: 'buildings',
  floor: 'floors',
  unit: 'units',
  propertyRequest: 'property_requests',
  floorRequest: 'floor_requests',
  subscriptionPlan: 'subscription_plans',
} as const;

const seenTableNames = new Set<string>();

for (const [tableKey, tableName] of Object.entries(DATABASE_TABLES)) {
  if (seenTableNames.has(tableName)) {
    throw new Error(
      `Duplicate database table name detected: "${tableName}" is used by multiple tables (key: ${tableKey}).`,
    );
  }

  seenTableNames.add(tableName);
}

export const ADMIN_TABLE_NAME = DATABASE_TABLES.admin;
export const USER_TABLE_NAME = DATABASE_TABLES.user;
export const PROPERTY_TABLE_NAME = DATABASE_TABLES.property;
export const BUILDING_TABLE_NAME = DATABASE_TABLES.building;
export const FLOOR_TABLE_NAME = DATABASE_TABLES.floor;
export const UNIT_TABLE_NAME = DATABASE_TABLES.unit;
export const PROPERTY_REQUEST_TABLE_NAME = DATABASE_TABLES.propertyRequest;
export const FLOOR_REQUEST_TABLE_NAME = DATABASE_TABLES.floorRequest;
export const SUBSCRIPTION_PLAN_TABLE_NAME = DATABASE_TABLES.subscriptionPlan;
export const TENANT_TABLE_NAME = 'tenants';
export const LEASE_TABLE_NAME = 'leases';
export const INVOICE_TABLE_NAME = 'invoices';
export const PAYMENT_TABLE_NAME = 'payments';
export const MAINTENANCE_TABLE_NAME = 'maintenance_requests';
export const EXPENSE_TABLE_NAME = 'expenses';
export const PARKING_TABLE_NAME = 'parking_slots';
export const AUDIT_LOG_TABLE_NAME = 'audit_logs';
