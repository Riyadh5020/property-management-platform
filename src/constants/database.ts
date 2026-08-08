export const DATABASE_TABLES = {
  admin: 'admins',
  user: 'users',
  property: 'properties',
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
