import { query } from '../config/database';
import {
  INVOICE_TABLE_NAME,
  PAYMENT_TABLE_NAME,
  type Invoice,
  type Payment,
} from '../models/invoice.model';

export interface NewInvoice {
  propertyId: string;
  unitId: string;
  tenantId: string;
  leaseId: string;
  invoiceNo: string;
  billingMonth: string;
  dueDate: string;
  rentAmount: number;
  utilitiesAmount: number;
  penaltyAmount: number;
  otherAmount: number;
  note?: string | null;
  createdBy: string | null;
}

const createInvoice = async (i: NewInvoice): Promise<Invoice> => {
  const total = i.rentAmount + i.utilitiesAmount + i.penaltyAmount + i.otherAmount;
  const r = await query<Invoice>(
    `INSERT INTO ${INVOICE_TABLE_NAME}
      ("propertyId","unitId","tenantId","leaseId","invoiceNo","billingMonth","dueDate",
       "rentAmount","utilitiesAmount","penaltyAmount","otherAmount","totalAmount",note,"createdBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *;`,
    [
      i.propertyId,
      i.unitId,
      i.tenantId,
      i.leaseId,
      i.invoiceNo,
      i.billingMonth,
      i.dueDate,
      i.rentAmount,
      i.utilitiesAmount,
      i.penaltyAmount,
      i.otherAmount,
      total,
      i.note ?? null,
      i.createdBy,
    ],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create invoice');
  }
  return row;
};

const getInvoiceById = async (id: string): Promise<Invoice | null> => {
  const r = await query<Invoice>(`SELECT * FROM ${INVOICE_TABLE_NAME} WHERE id = $1 LIMIT 1;`, [
    id,
  ]);
  return r.rows[0] ?? null;
};

const updateInvoiceCharges = async (
  id: string,
  c: {
    utilitiesAmount?: number;
    penaltyAmount?: number;
    otherAmount?: number;
    dueDate?: string;
    note?: string | null;
  },
): Promise<Invoice | null> => {
  const r = await query<Invoice>(
    `UPDATE ${INVOICE_TABLE_NAME} SET
       "utilitiesAmount" = COALESCE($2, "utilitiesAmount"),
       "penaltyAmount" = COALESCE($3, "penaltyAmount"),
       "otherAmount" = COALESCE($4, "otherAmount"),
       "dueDate" = COALESCE($5::date, "dueDate"),
       note = COALESCE($6, note),
       "updatedAt" = NOW()
     WHERE id = $1 RETURNING *;`,
    [
      id,
      c.utilitiesAmount ?? null,
      c.penaltyAmount ?? null,
      c.otherAmount ?? null,
      c.dueDate ?? null,
      c.note ?? null,
    ],
  );
  return r.rows[0] ?? null;
};

// Recompute total, paid and status from the source rows.
const recalcInvoice = async (id: string): Promise<Invoice | null> => {
  const r = await query<Invoice>(
    `UPDATE ${INVOICE_TABLE_NAME} i SET
       "totalAmount" = i."rentAmount" + i."utilitiesAmount" + i."penaltyAmount" + i."otherAmount",
       "paidAmount" = COALESCE((SELECT SUM(p.amount) FROM ${PAYMENT_TABLE_NAME} p WHERE p."invoiceId" = i.id), 0),
       status = CASE
         WHEN i.status = 'void' THEN 'void'
         WHEN COALESCE((SELECT SUM(p.amount) FROM ${PAYMENT_TABLE_NAME} p WHERE p."invoiceId" = i.id), 0)
              >= i."rentAmount" + i."utilitiesAmount" + i."penaltyAmount" + i."otherAmount" THEN 'paid'
         WHEN COALESCE((SELECT SUM(p.amount) FROM ${PAYMENT_TABLE_NAME} p WHERE p."invoiceId" = i.id), 0) > 0 THEN 'partial'
         ELSE 'unpaid' END,
       "updatedAt" = NOW()
     WHERE i.id = $1 RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const voidInvoice = async (id: string): Promise<Invoice | null> => {
  const r = await query<Invoice>(
    `UPDATE ${INVOICE_TABLE_NAME} SET status = 'void', "updatedAt" = NOW() WHERE id = $1 RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const createPayment = async (p: {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string | null;
  paidOn: string;
  reversesPaymentId?: string | null;
  note?: string | null;
  createdBy: string | null;
}): Promise<Payment> => {
  const r = await query<Payment>(
    `INSERT INTO ${PAYMENT_TABLE_NAME}
      ("invoiceId", amount, method, reference, "paidOn", "reversesPaymentId", note, "createdBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *;`,
    [
      p.invoiceId,
      p.amount,
      p.method,
      p.reference ?? null,
      p.paidOn,
      p.reversesPaymentId ?? null,
      p.note ?? null,
      p.createdBy,
    ],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create payment');
  }
  return row;
};

const getPaymentById = async (id: string): Promise<Payment | null> => {
  const r = await query<Payment>(`SELECT * FROM ${PAYMENT_TABLE_NAME} WHERE id = $1 LIMIT 1;`, [
    id,
  ]);
  return r.rows[0] ?? null;
};

const listPayments = async (invoiceId: string): Promise<Payment[]> => {
  const r = await query<Payment>(
    `SELECT * FROM ${PAYMENT_TABLE_NAME} WHERE "invoiceId" = $1 ORDER BY "createdAt" ASC;`,
    [invoiceId],
  );
  return r.rows;
};

const nextInvoiceNo = async (month: string): Promise<string> => {
  const ym = month.slice(0, 7).replace('-', '');
  const r = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${INVOICE_TABLE_NAME} WHERE "invoiceNo" LIKE $1;`,
    [`INV-${ym}-%`],
  );
  return `INV-${ym}-${String((r.rows[0]?.count ?? 0) + 1).padStart(4, '0')}`;
};

const invoiceExistsForLeaseMonth = async (leaseId: string, month: string): Promise<boolean> => {
  const r = await query(
    `SELECT 1 FROM ${INVOICE_TABLE_NAME} WHERE "leaseId" = $1 AND "billingMonth" = $2::date AND status <> 'void' LIMIT 1;`,
    [leaseId, month],
  );
  return r.rows.length > 0;
};

// Active leases covering the month (any day of the month inside the lease period).
const getBillableLeases = async (opts: {
  propertyId?: string;
  propertyIds?: string[];
  ownerId?: string;
  month: string;
}): Promise<
  {
    id: string;
    propertyId: string;
    unitId: string;
    tenantId: string;
    monthlyRent: number;
    escalationPercent: number;
    startDate: string;
    unitCode: string;
  }[]
> => {
  const where = [
    `l."deletedAt" IS NULL`,
    `l.status = 'active'`,
    `l."startDate" <= (($1::date + INTERVAL '1 month') - INTERVAL '1 day')::date`,
    `l."endDate" >= $1::date`,
  ];
  const values: unknown[] = [opts.month];
  if (opts.propertyId) {
    values.push(opts.propertyId);
    where.push(`l."propertyId" = $${values.length}`);
  }
  if (opts.ownerId) {
    values.push(opts.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (opts.propertyIds) {
    values.push(opts.propertyIds);
    where.push(`l."propertyId" = ANY($${values.length}::uuid[])`);
  }
  const r = await query<{
    id: string;
    propertyId: string;
    unitId: string;
    tenantId: string;
    monthlyRent: number;
    escalationPercent: number;
    startDate: string;
    unitCode: string;
  }>(
    `SELECT l.id, l."propertyId", l."unitId", l."tenantId", l."monthlyRent", l."escalationPercent", l."startDate", u."unitCode"
       FROM leases l JOIN properties p ON p.id = l."propertyId"
       JOIN units u ON u.id = l."unitId"
      WHERE ${where.join(' AND ')};`,
    values,
  );
  return r.rows;
};

const getUnitParkingFee = async (unitId: string): Promise<number> => {
  const r = await query<{ fee: number }>(
    `SELECT COALESCE(SUM("monthlyFee"), 0)::float8 AS fee FROM parking_slots
      WHERE "unitId" = $1 AND "deletedAt" IS NULL AND status <> 'blocked';`,
    [unitId],
  );
  return r.rows[0]?.fee ?? 0;
};

// Unit codes are only unique per floor, so a bill can name more than one unit.
const countUnitsWithCode = async (propertyId: string, unitCode: string): Promise<number> => {
  const r = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM units u JOIN floors f ON f.id = u."floorId"
      WHERE f."propertyId" = $1 AND u."deletedAt" IS NULL
        AND LOWER(TRIM(u."unitCode")) = LOWER(TRIM($2));`,
    [propertyId, unitCode],
  );
  return r.rows[0]?.count ?? 0;
};

const findInvoiceForUnitMonth = async (
  propertyId: string,
  unitCode: string,
  month: string,
): Promise<Invoice | null> => {
  const r = await query<Invoice>(
    `SELECT i.* FROM ${INVOICE_TABLE_NAME} i JOIN units u ON u.id = i."unitId"
      WHERE i."propertyId" = $1 AND LOWER(TRIM(u."unitCode")) = LOWER(TRIM($2))
        AND i."billingMonth" = $3::date AND i.status <> 'void' LIMIT 1;`,
    [propertyId, unitCode, month],
  );
  return r.rows[0] ?? null;
};

const adjustInvoiceUtilities = async (id: string, delta: number): Promise<void> => {
  await query(
    `UPDATE ${INVOICE_TABLE_NAME}
        SET "utilitiesAmount" = GREATEST(0, "utilitiesAmount" + $2::numeric), "updatedAt" = NOW()
      WHERE id = $1;`,
    [id, delta],
  );
};

const getAllInvoices = async (o: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  month?: string;
  propertyId?: string;
  tenantId?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: Invoice[]; total: number }> => {
  const where: string[] = ['p."deletedAt" IS NULL'];
  const values: unknown[] = [];
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(
      `(LOWER(t."fullName") LIKE $${values.length} OR LOWER(i."invoiceNo") LIKE $${values.length})`,
    );
  }
  if (o.status === 'overdue') {
    where.push(`i.status IN ('unpaid','partial') AND i."dueDate" < CURRENT_DATE`);
  } else if (o.status) {
    values.push(o.status);
    where.push(`i.status = $${values.length}`);
  }
  if (o.month) {
    values.push(o.month);
    where.push(`i."billingMonth" = $${values.length}::date`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`i."propertyId" = $${values.length}`);
  }
  if (o.tenantId) {
    values.push(o.tenantId);
    where.push(`i."tenantId" = $${values.length}`);
  }
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (o.propertyIds) {
    values.push(o.propertyIds);
    where.push(`i."propertyId" = ANY($${values.length}::uuid[])`);
  }
  values.push(o.limit ?? 20, o.offset ?? 0);
  const r = await query<Invoice & { totalCount?: number }>(
    `SELECT i.*, p.title AS "propertyTitle", u."unitCode" AS "unitCode", t."fullName" AS "tenantName",
            (i.status IN ('unpaid','partial') AND i."dueDate" < CURRENT_DATE) AS "isOverdue",
            COUNT(*) OVER() AS "totalCount"
       FROM ${INVOICE_TABLE_NAME} i
       JOIN properties p ON p.id = i."propertyId"
       JOIN units u ON u.id = i."unitId"
       JOIN tenants t ON t.id = i."tenantId"
      WHERE ${where.join(' AND ')}
      ORDER BY i."billingMonth" DESC, i."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...inv } = row;
    return inv;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

export {
  adjustInvoiceUtilities,
  countUnitsWithCode,
  createInvoice,
  createPayment,
  findInvoiceForUnitMonth,
  getAllInvoices,
  getBillableLeases,
  getInvoiceById,
  getPaymentById,
  getUnitParkingFee,
  invoiceExistsForLeaseMonth,
  listPayments,
  nextInvoiceNo,
  recalcInvoice,
  updateInvoiceCharges,
  voidInvoice,
};
