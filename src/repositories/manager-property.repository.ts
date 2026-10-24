import { database, query } from '../config/database';
import { MANAGER_PROPERTY_TABLE_NAME } from '../models/manager-property.model';

const listPropertyIdsForManager = async (managerId: string): Promise<string[]> => {
  const result = await query<{ propertyId: string }>(
    `SELECT "propertyId" FROM ${MANAGER_PROPERTY_TABLE_NAME}
      WHERE "managerId" = $1 AND "deletedAt" IS NULL`,
    [managerId],
  );
  return result.rows.map((r) => r.propertyId);
};

const setManagerProperties = async (
  managerId: string,
  propertyIds: string[],
  actorId: string | null,
): Promise<void> => {
  const client = await database.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE ${MANAGER_PROPERTY_TABLE_NAME} SET "deletedAt" = NOW()
        WHERE "managerId" = $1 AND "deletedAt" IS NULL
          AND NOT ("propertyId" = ANY($2::uuid[]))`,
      [managerId, propertyIds],
    );
    await client.query(
      `INSERT INTO ${MANAGER_PROPERTY_TABLE_NAME} ("managerId", "propertyId", "createdBy")
       SELECT $1::uuid, t.pid, $3::uuid FROM unnest($2::uuid[]) AS t(pid)
        WHERE NOT EXISTS (
          SELECT 1 FROM ${MANAGER_PROPERTY_TABLE_NAME} mp
           WHERE mp."managerId" = $1::uuid AND mp."propertyId" = t.pid AND mp."deletedAt" IS NULL)`,
      [managerId, propertyIds, actorId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export { listPropertyIdsForManager, setManagerProperties };
