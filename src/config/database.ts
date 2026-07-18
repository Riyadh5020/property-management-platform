import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { createAdminIndexesSql, createAdminTableSql } from '../models/admin.model';
import { createUserIndexesSql, createUserTableSql } from '../models/user.model';

import { env } from './env';

const requiresSsl = env.DATABASE_URL.includes('sslmode=require');

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
};

const database = new Pool(poolConfig);

const initializeDatabase = async (): Promise<void> => {
  await database.query(createAdminTableSql);

  // ensure users table exists
  await database.query(createUserTableSql);

  for (const createIndexSql of createUserIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createAdminIndexesSql) {
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
