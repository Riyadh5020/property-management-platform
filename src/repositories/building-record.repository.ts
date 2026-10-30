import { query } from '../config/database';
import {
  BUILDING_RECORD_TABLE_NAME,
  type BuildingRecord,
  type RecordKind,
} from '../models/building-record.model';

const createRecord = async (i: {
  kind: RecordKind;
  propertyId: string | null;
  ownerId: string | null;
  title: string;
  status: string | null;
  data: Record<string, unknown>;
  createdBy: string | null;
}): Promise<BuildingRecord> => {
  const r = await query<BuildingRecord>(
    `INSERT INTO ${BUILDING_RECORD_TABLE_NAME}
      (kind,"propertyId","ownerId",title,status,data,"createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *;`,
    [i.kind, i.propertyId, i.ownerId, i.title, i.status, JSON.stringify(i.data), i.createdBy],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create record');
  }
  return row;
};

const getRecordById = async (kind: RecordKind, id: string): Promise<BuildingRecord | null> => {
  const r = await query<BuildingRecord>(
    `SELECT b.*, p.title AS "propertyTitle"
       FROM ${BUILDING_RECORD_TABLE_NAME} b
       LEFT JOIN properties p ON p.id = b."propertyId"
      WHERE b.id = $1 AND b.kind = $2 AND b."deletedAt" IS NULL LIMIT 1;`,
    [id, kind],
  );
  return r.rows[0] ?? null;
};

const updateRecord = async (
  id: string,
  i: {
    title: string;
    status: string | null;
    data: Record<string, unknown>;
    updatedBy: string | null;
  },
): Promise<BuildingRecord | null> => {
  const r = await query<BuildingRecord>(
    `UPDATE ${BUILDING_RECORD_TABLE_NAME}
        SET title = $2, status = $3, data = $4, "updatedBy" = $5, "updatedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id, i.title, i.status, JSON.stringify(i.data), i.updatedBy],
  );
  return r.rows[0] ?? null;
};

const deleteRecord = async (id: string): Promise<BuildingRecord | null> => {
  const r = await query<BuildingRecord>(
    `UPDATE ${BUILDING_RECORD_TABLE_NAME} SET "deletedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

// `scope` lists what the reader may see; the conditions are ORed. No scope means everything.
const getAllRecords = async (o: {
  kind: RecordKind;
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  propertyId?: string;
  scope?: {
    propertyOwnerId?: string;
    propertyIds?: string[];
    ownerIds?: string[];
    global?: boolean;
  };
}): Promise<{ items: BuildingRecord[]; total: number }> => {
  const values: unknown[] = [o.kind];
  const where = ['b.kind = $1', 'b."deletedAt" IS NULL', '(p.id IS NULL OR p."deletedAt" IS NULL)'];
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(`LOWER(b.title) LIKE $${values.length}`);
  }
  if (o.status) {
    values.push(o.status);
    where.push(`b.status = $${values.length}`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`b."propertyId" = $${values.length}`);
  }
  if (o.scope) {
    const any: string[] = [];
    if (o.scope.propertyOwnerId) {
      values.push(o.scope.propertyOwnerId);
      any.push(`p."ownerId" = $${values.length}`);
    }
    if (o.scope.propertyIds) {
      values.push(o.scope.propertyIds);
      any.push(`b."propertyId" = ANY($${values.length}::uuid[])`);
    }
    if (o.scope.ownerIds) {
      values.push(o.scope.ownerIds);
      any.push(`(b."propertyId" IS NULL AND b."ownerId" = ANY($${values.length}::uuid[]))`);
    }
    if (o.scope.global) {
      any.push(`(b."propertyId" IS NULL AND b."ownerId" IS NULL)`);
    }
    where.push(any.length > 0 ? `(${any.join(' OR ')})` : 'FALSE');
  }
  values.push(o.limit ?? 20, o.offset ?? 0);
  const r = await query<BuildingRecord & { totalCount?: number }>(
    `SELECT b.*, p.title AS "propertyTitle", COUNT(*) OVER() AS "totalCount"
       FROM ${BUILDING_RECORD_TABLE_NAME} b
       LEFT JOIN properties p ON p.id = b."propertyId"
      WHERE ${where.join(' AND ')}
      ORDER BY b."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...record } = row;
    return record;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

// Utility bills for one unit and month that are not on an invoice yet. Bills match by unit code.
const findUninvoicedBills = async (
  propertyId: string,
  unitCode: string,
  period: string,
): Promise<BuildingRecord[]> => {
  const r = await query<BuildingRecord>(
    `SELECT * FROM ${BUILDING_RECORD_TABLE_NAME}
      WHERE kind = 'utilities' AND "propertyId" = $1 AND "deletedAt" IS NULL
        AND LOWER(TRIM(title)) = LOWER(TRIM($2)) AND data->>'period' = $3
        AND COALESCE(status, '') <> 'Paid' AND data->>'invoiceId' IS NULL;`,
    [propertyId, unitCode, period],
  );
  return r.rows;
};

const linkBillToInvoice = async (id: string, invoiceId: string, amount: number): Promise<void> => {
  await query(
    `UPDATE ${BUILDING_RECORD_TABLE_NAME}
        SET status = 'Billed', "updatedAt" = NOW(),
            data = data || jsonb_build_object('invoiceId', $2::text, 'invoicedAmount', $3::numeric, 'status', 'Billed')
      WHERE id = $1;`,
    [id, invoiceId, amount],
  );
};

const setInvoiceBillsStatus = async (
  invoiceId: string,
  status: 'Billed' | 'Paid',
): Promise<void> => {
  await query(
    `UPDATE ${BUILDING_RECORD_TABLE_NAME}
        SET status = $2::varchar, "updatedAt" = NOW(),
            data = data || jsonb_build_object('status', $2::text)
      WHERE kind = 'utilities' AND data->>'invoiceId' = $1 AND "deletedAt" IS NULL;`,
    [invoiceId, status],
  );
};

// A voided invoice gives its bills back, so the next invoice can pick them up.
const releaseInvoiceBills = async (invoiceId: string): Promise<void> => {
  await query(
    `UPDATE ${BUILDING_RECORD_TABLE_NAME}
        SET status = 'Pending', "updatedAt" = NOW(),
            data = (data - 'invoiceId' - 'invoicedAmount') || jsonb_build_object('status', 'Pending')
      WHERE kind = 'utilities' AND data->>'invoiceId' = $1 AND "deletedAt" IS NULL;`,
    [invoiceId],
  );
};

export { findUninvoicedBills, linkBillToInvoice, releaseInvoiceBills, setInvoiceBillsStatus };
export { createRecord, deleteRecord, getAllRecords, getRecordById, updateRecord };
