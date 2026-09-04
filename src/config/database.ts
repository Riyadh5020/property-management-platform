import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { createAdminIndexesSql, createAdminTableSql } from '../models/admin.model';
import { createBuildingIndexesSql, createBuildingTableSql } from '../models/building.model';
import { createPropertyIndexesSql, createPropertyTableSql } from '../models/properties.model';
import {
  createPropertyRequestIndexesSql,
  createPropertyRequestTableSql,
} from '../models/property-request.model';

import { env } from './env';

import { createFloorIndexesSql, createFloorTableSql } from '@/models/floor.model';
import { createUnitIndexesSql, createUnitTableSql } from '@/models/unit.model';

const requiresSsl = env.DATABASE_URL.includes('sslmode=require');

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
};

const database = new Pool(poolConfig);

const initializeDatabase = async (): Promise<void> => {
  await database.query(createAdminTableSql);

  await database.query(createPropertyTableSql);

  await database.query(createBuildingTableSql);

  await database.query(createFloorTableSql);

  await database.query(createUnitTableSql);

  await database.query(createPropertyRequestTableSql);

  for (const createIndexSql of createAdminIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createPropertyIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createBuildingIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createFloorIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createUnitIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createPropertyRequestIndexesSql) {
    await database.query(createIndexSql);
  }

  console.info('[database] schema initialized');
};
const connectToDatabase = async (): Promise<void> => {
  const client = await database.connect();

  try {
    await client.query('SELECT 1');
    console.info('[database] connected');

    await initializeDatabase();
  } finally {
    client.release();
  }
};

const query = async <T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> => {
  return await database.query<T>(text, params);
};

export { connectToDatabase, database, query };
