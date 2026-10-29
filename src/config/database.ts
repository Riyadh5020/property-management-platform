import { Pool, types, type PoolConfig, type QueryResult, type QueryResultRow } from 'pg';

import { createAdminIndexesSql, createAdminTableSql } from '../models/admin.model';
import { createBuildingIndexesSql, createBuildingTableSql } from '../models/building.model';
import {
  createFloorRequestIndexesSql,
  createFloorRequestTableSql,
} from '../models/floor-request.model';
import {
  createInvoiceIndexesSql,
  createInvoiceTableSql,
  createPaymentTableSql,
} from '../models/invoice.model';
import { createLeaseIndexesSql, createLeaseTableSql } from '../models/lease.model';
import {
  createMaintenanceIndexesSql,
  createMaintenanceTableSql,
} from '../models/maintenance.model';
import {
  createManagerPropertyIndexesSql,
  createManagerPropertyTableSql,
} from '../models/manager-property.model';
import { createPropertyIndexesSql, createPropertyTableSql } from '../models/properties.model';
import {
  createPropertyRequestIndexesSql,
  createPropertyRequestTableSql,
} from '../models/property-request.model';
import {
  createSubscriptionHistoryIndexesSql,
  createSubscriptionHistoryTableSql,
} from '../models/subscription-history.model';
import {
  createSubscriptionPlanIndexesSql,
  createSubscriptionPlanTableSql,
} from '../models/subscription-plan.model';
import { createTenantIndexesSql, createTenantTableSql } from '../models/tenant.model';

import { env } from './env';

import { createAuditLogIndexesSql, createAuditLogTableSql } from '@/models/audit-log.model';
import { createExpenseIndexesSql, createExpenseTableSql } from '@/models/expense.model';
import { createFloorIndexesSql, createFloorTableSql } from '@/models/floor.model';
import { createParkingIndexesSql, createParkingTableSql } from '@/models/parking.model';
import { createUnitIndexesSql, createUnitTableSql } from '@/models/unit.model';

types.setTypeParser(types.builtins.NUMERIC, (v: string) => Number.parseFloat(v));
types.setTypeParser(types.builtins.INT8, (v: string) => Number.parseInt(v, 10));
types.setTypeParser(types.builtins.DATE, (v: string) => v);
const requiresSsl = env.DATABASE_URL.includes('sslmode=require');

const poolConfig: PoolConfig = {
  connectionString: env.DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
};

const database = new Pool(poolConfig);

const initializeDatabase = async (): Promise<void> => {
  await database.query(createAdminTableSql);

  await database.query(createPropertyTableSql);
  await database.query(createSubscriptionPlanTableSql);

  await database.query(createBuildingTableSql);

  await database.query(createFloorTableSql);

  await database.query(createUnitTableSql);
  await database.query(createManagerPropertyTableSql);
  await database.query(createFloorRequestTableSql);
  await database.query(createPropertyRequestTableSql);
  await database.query(createSubscriptionHistoryTableSql);

  await database.query(createTenantTableSql);
  await database.query(createLeaseTableSql);
  await database.query(createInvoiceTableSql);
  await database.query(createPaymentTableSql);
  await database.query(createMaintenanceTableSql);
  await database.query(createExpenseTableSql);
  await database.query(createParkingTableSql);
  await database.query(createAuditLogTableSql);
  for (const createIndexSql of createInvoiceIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createAdminIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createSubscriptionPlanIndexesSql) {
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

  for (const createIndexSql of createManagerPropertyIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createPropertyRequestIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createFloorRequestIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createSubscriptionHistoryIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createTenantIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createLeaseIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createInvoiceIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createMaintenanceIndexesSql) {
    await database.query(createIndexSql);
  }
  for (const createIndexSql of createExpenseIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createParkingIndexesSql) {
    await database.query(createIndexSql);
  }

  for (const createIndexSql of createAuditLogIndexesSql) {
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
