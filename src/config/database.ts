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
import {
  createBuildingRecordIndexesSql,
  createBuildingRecordTableSql,
  createSubscriptionReminderTableSql,
} from '@/models/building-record.model';
import { createExpenseIndexesSql, createExpenseTableSql } from '@/models/expense.model';
import { createFloorIndexesSql, createFloorTableSql } from '@/models/floor.model';
import { createParkingIndexesSql, createParkingTableSql } from '@/models/parking.model';
import {
  createCouponTableSql,
  createSubscriptionBillingIndexesSql,
  createSubscriptionInvoiceTableSql,
} from '@/models/subscription-billing.model';
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

// In dependency order: indexes and added columns come after every table.
const schemaStatements = [
  createAdminTableSql,
  createPropertyTableSql,
  createSubscriptionPlanTableSql,
  createBuildingTableSql,
  createFloorTableSql,
  createUnitTableSql,
  createManagerPropertyTableSql,
  createFloorRequestTableSql,
  createPropertyRequestTableSql,
  createSubscriptionHistoryTableSql,
  createTenantTableSql,
  createLeaseTableSql,
  createInvoiceTableSql,
  createPaymentTableSql,
  createMaintenanceTableSql,
  createExpenseTableSql,
  createParkingTableSql,
  createAuditLogTableSql,
  createBuildingRecordTableSql,
  createSubscriptionReminderTableSql,
  createSubscriptionInvoiceTableSql,
  createCouponTableSql,
  ...createSubscriptionBillingIndexesSql,
  ...createBuildingRecordIndexesSql,
  ...createInvoiceIndexesSql,
  ...createAdminIndexesSql,
  ...createSubscriptionPlanIndexesSql,
  ...createPropertyIndexesSql,
  ...createBuildingIndexesSql,
  ...createFloorIndexesSql,
  ...createUnitIndexesSql,
  ...createManagerPropertyIndexesSql,
  ...createPropertyRequestIndexesSql,
  ...createFloorRequestIndexesSql,
  ...createSubscriptionHistoryIndexesSql,
  ...createTenantIndexesSql,
  ...createLeaseIndexesSql,
  ...createMaintenanceIndexesSql,
  ...createExpenseIndexesSql,
  ...createParkingIndexesSql,
  ...createAuditLogIndexesSql,
];

// Sent as one request, because a serverless function can be cut off between many round trips to
// the database. If one statement fails the batch rolls back, so each is then tried on its own and
// a single bad one cannot stop the rest of the schema.
const initializeDatabase = async (): Promise<void> => {
  try {
    await database.query(schemaStatements.join('\n'));
  } catch (batchError) {
    console.warn('[database] schema batch failed, applying statements one by one:', batchError);
    for (const statement of schemaStatements) {
      try {
        await database.query(statement);
      } catch (error) {
        console.error('[database] schema statement failed:', statement.slice(0, 120), error);
      }
    }
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
