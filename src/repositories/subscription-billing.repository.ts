import { query } from '../config/database';
import {
  COUPON_TABLE_NAME,
  SUBSCRIPTION_INVOICE_TABLE_NAME,
  type Coupon,
  type SubscriptionInvoice,
} from '../models/subscription-billing.model';

const createSubscriptionInvoice = async (i: {
  propertyId: string;
  ownerId: string | null;
  planId: string | null;
  description: string;
  amount: number;
  discountAmount: number;
  createdBy: string | null;
}): Promise<SubscriptionInvoice> => {
  const r = await query<SubscriptionInvoice>(
    `INSERT INTO ${SUBSCRIPTION_INVOICE_TABLE_NAME}
      ("invoiceNo","propertyId","ownerId","planId",description,amount,"discountAmount","dueDate","createdBy")
     VALUES ('SUB-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(nextval('subscription_invoice_no_seq')::text, 5, '0'),
             $1,$2,$3,$4,$5,$6,(CURRENT_DATE + 7),$7)
     RETURNING *;`,
    [i.propertyId, i.ownerId, i.planId, i.description, i.amount, i.discountAmount, i.createdBy],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create subscription invoice');
  }
  return row;
};

const getSubscriptionInvoiceById = async (id: string): Promise<SubscriptionInvoice | null> => {
  const r = await query<SubscriptionInvoice>(
    `SELECT * FROM ${SUBSCRIPTION_INVOICE_TABLE_NAME} WHERE id = $1 LIMIT 1;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const listSubscriptionInvoices = async (o: {
  limit: number;
  offset: number;
  status?: string;
  ownerId?: string;
  search?: string;
}): Promise<{ items: SubscriptionInvoice[]; total: number }> => {
  const where = ['TRUE'];
  const values: unknown[] = [];
  if (o.status) {
    values.push(o.status);
    where.push(`i.status = $${values.length}`);
  }
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`i."ownerId" = $${values.length}`);
  }
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(
      `(LOWER(i."invoiceNo") LIKE $${values.length} OR LOWER(COALESCE(p.title, '')) LIKE $${values.length} OR LOWER(COALESCE(a.email, '')) LIKE $${values.length})`,
    );
  }
  values.push(o.limit, o.offset);
  const r = await query<SubscriptionInvoice & { totalCount?: number }>(
    `SELECT i.*, p.title AS "propertyTitle", a.email AS "ownerEmail", pl.name AS "planName",
            COUNT(*) OVER() AS "totalCount"
       FROM ${SUBSCRIPTION_INVOICE_TABLE_NAME} i
       LEFT JOIN properties p ON p.id = i."propertyId"
       LEFT JOIN admins a ON a.id = i."ownerId"
       LEFT JOIN subscription_plans pl ON pl.id = i."planId"
      WHERE ${where.join(' AND ')}
      ORDER BY i."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...invoice } = row;
    return invoice;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

const markSubscriptionInvoicePaid = async (
  id: string,
  p: { paidOn: string; method: string; reference?: string | null; note?: string | null },
): Promise<SubscriptionInvoice | null> => {
  const r = await query<SubscriptionInvoice>(
    `UPDATE ${SUBSCRIPTION_INVOICE_TABLE_NAME}
        SET status = 'paid', "paidOn" = $2, method = $3, reference = $4, note = COALESCE($5, note),
            "updatedAt" = NOW()
      WHERE id = $1 AND status = 'due' RETURNING *;`,
    [id, p.paidOn, p.method, p.reference ?? null, p.note ?? null],
  );
  return r.rows[0] ?? null;
};

const voidSubscriptionInvoice = async (id: string): Promise<SubscriptionInvoice | null> => {
  const r = await query<SubscriptionInvoice>(
    `UPDATE ${SUBSCRIPTION_INVOICE_TABLE_NAME} SET status = 'void', "updatedAt" = NOW()
      WHERE id = $1 AND status = 'due' RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

// Takes one use of the coupon only if it can still be used, so two people cannot pass its limit.
const claimCoupon = async (code: string): Promise<Coupon | null> => {
  const r = await query<Coupon>(
    `UPDATE ${COUPON_TABLE_NAME} SET "usedCount" = "usedCount" + 1, "updatedAt" = NOW()
      WHERE LOWER(code) = LOWER($1) AND status = 'active'
        AND ("expiresOn" IS NULL OR "expiresOn" >= CURRENT_DATE)
        AND ("maxUses" IS NULL OR "usedCount" < "maxUses")
      RETURNING *;`,
    [code],
  );
  return r.rows[0] ?? null;
};

const releaseCoupon = async (id: string): Promise<void> => {
  await query(
    `UPDATE ${COUPON_TABLE_NAME} SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE id = $1;`,
    [id],
  );
};

const applyCouponToInvoice = async (
  id: string,
  code: string,
  discount: number,
): Promise<SubscriptionInvoice | null> => {
  const r = await query<SubscriptionInvoice>(
    `UPDATE ${SUBSCRIPTION_INVOICE_TABLE_NAME}
        SET amount = amount - $3::numeric, "discountAmount" = "discountAmount" + $3::numeric,
            "couponCode" = $2, "updatedAt" = NOW()
      WHERE id = $1 AND status = 'due' AND "couponCode" IS NULL AND amount >= $3::numeric
      RETURNING *;`,
    [id, code, discount],
  );
  return r.rows[0] ?? null;
};

const createCoupon = async (c: {
  code: string;
  discountType: string;
  value: number;
  maxUses?: number | null;
  expiresOn?: string | null;
  createdBy: string | null;
}): Promise<Coupon> => {
  const r = await query<Coupon>(
    `INSERT INTO ${COUPON_TABLE_NAME} (code,"discountType",value,"maxUses","expiresOn","createdBy")
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *;`,
    [c.code, c.discountType, c.value, c.maxUses ?? null, c.expiresOn ?? null, c.createdBy],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create coupon');
  }
  return row;
};

const listCoupons = async (): Promise<Coupon[]> => {
  const r = await query<Coupon>(`SELECT * FROM ${COUPON_TABLE_NAME} ORDER BY "createdAt" DESC;`);
  return r.rows;
};

const setCouponStatus = async (id: string, status: string): Promise<Coupon | null> => {
  const r = await query<Coupon>(
    `UPDATE ${COUPON_TABLE_NAME} SET status = $2, "updatedAt" = NOW() WHERE id = $1 RETURNING *;`,
    [id, status],
  );
  return r.rows[0] ?? null;
};

interface BusinessStats {
  mrr: number;
  collectedThisMonth: number;
  outstanding: number;
  activeOwners: number;
  trialOwners: number;
  expiredOwners: number;
  newOwners30Days: number;
  lostOwners: number;
  plans: { name: string; properties: number }[];
}

const getBusinessStats = async (): Promise<BusinessStats> => {
  const money = await query<{ mrr: number; collected: number; outstanding: number }>(
    `SELECT
       (SELECT COALESCE(SUM(pl.amount::float8 * 30 / NULLIF(pl."durationDays", 0)), 0)
          FROM properties p JOIN subscription_plans pl ON pl.id = p."planId"
         WHERE p."deletedAt" IS NULL AND p."subscriptionStatus" = 'active'
           AND p."subscriptionEndsAt" > NOW()) AS mrr,
       (SELECT COALESCE(SUM(amount), 0)::float8 FROM ${SUBSCRIPTION_INVOICE_TABLE_NAME}
         WHERE status = 'paid' AND "paidOn" >= DATE_TRUNC('month', CURRENT_DATE)) AS collected,
       (SELECT COALESCE(SUM(amount), 0)::float8 FROM ${SUBSCRIPTION_INVOICE_TABLE_NAME}
         WHERE status = 'due') AS outstanding;`,
  );
  // An owner counts once: paying beats trial, and trial beats expired.
  const owners = await query<{
    active: number;
    trial: number;
    expired: number;
    new30: number;
    lost: number;
  }>(
    `WITH o AS (
       SELECT a.id, a.status, a."createdAt",
              BOOL_OR(p."subscriptionStatus" = 'active' AND p."subscriptionEndsAt" > NOW()) AS paying,
              BOOL_OR(p."subscriptionStatus" = 'trial' AND p."subscriptionEndsAt" > NOW()) AS trial,
              COUNT(p.id) > 0 AS "hasProperty"
         FROM admins a
         LEFT JOIN properties p ON p."ownerId" = a.id AND p."deletedAt" IS NULL
        WHERE a.role = 'owner' AND a."deletedAt" IS NULL
        GROUP BY a.id
     )
     SELECT COUNT(*) FILTER (WHERE paying IS TRUE)::int AS active,
            COUNT(*) FILTER (WHERE paying IS NOT TRUE AND trial IS TRUE)::int AS trial,
            COUNT(*) FILTER (WHERE "hasProperty" AND paying IS NOT TRUE AND trial IS NOT TRUE)::int AS expired,
            COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days')::int AS new30,
            COUNT(*) FILTER (WHERE status IN ('inactive', 'suspended'))::int AS lost
       FROM o;`,
  );
  const plans = await query<{ name: string; properties: number }>(
    `SELECT pl.name, COUNT(p.id)::int AS properties
       FROM subscription_plans pl
       LEFT JOIN properties p ON p."planId" = pl.id AND p."deletedAt" IS NULL
      WHERE pl."deletedAt" IS NULL
      GROUP BY pl.id, pl.name
      ORDER BY properties DESC, pl.name;`,
  );
  const m = money.rows[0];
  const o = owners.rows[0];
  return {
    mrr: Math.round((m?.mrr ?? 0) * 100) / 100,
    collectedThisMonth: m?.collected ?? 0,
    outstanding: m?.outstanding ?? 0,
    activeOwners: o?.active ?? 0,
    trialOwners: o?.trial ?? 0,
    expiredOwners: o?.expired ?? 0,
    newOwners30Days: o?.new30 ?? 0,
    lostOwners: o?.lost ?? 0,
    plans: plans.rows,
  };
};

export const exportTypes = [
  'properties',
  'tenants',
  'leases',
  'invoices',
  'payments',
  'expenses',
] as const;
export type ExportType = (typeof exportTypes)[number];

// Every query exposes the owning property as `p`, so one owner filter covers them all.
const EXPORT_SQL: Record<ExportType, string> = {
  properties: `SELECT p.title, p.address, p.city, p.state, p.country, p.floors, p."subscriptionStatus", p."subscriptionEndsAt"
                 FROM properties p WHERE p."deletedAt" IS NULL`,
  tenants: `SELECT p.title AS property, u."unitCode" AS unit, t."fullName", t.phone, t.email, t."idDocType", t."idDocNumber",
                   t.role, t."moveInDate", t."moveOutDate", t.status, t.occupation, t."permanentAddress",
                   t."emergencyContactName", t."emergencyContactPhone", t."familyMembers", t.notes
              FROM tenants t JOIN properties p ON p.id = t."propertyId" LEFT JOIN units u ON u.id = t."unitId"
             WHERE t."deletedAt" IS NULL AND p."deletedAt" IS NULL`,
  leases: `SELECT p.title AS property, u."unitCode" AS unit, t."fullName" AS tenant, l."agreementNo", l."startDate", l."endDate",
                  l."monthlyRent", l."escalationPercent", l.status
             FROM leases l JOIN properties p ON p.id = l."propertyId" JOIN units u ON u.id = l."unitId"
             JOIN tenants t ON t.id = l."tenantId"
            WHERE l."deletedAt" IS NULL AND p."deletedAt" IS NULL`,
  invoices: `SELECT i."invoiceNo", p.title AS property, u."unitCode" AS unit, t."fullName" AS tenant, i."billingMonth", i."dueDate",
                    i."rentAmount", i."utilitiesAmount", i."penaltyAmount", i."otherAmount", i."totalAmount", i."paidAmount", i.status
               FROM invoices i JOIN properties p ON p.id = i."propertyId" JOIN units u ON u.id = i."unitId"
               JOIN tenants t ON t.id = i."tenantId"
              WHERE p."deletedAt" IS NULL`,
  payments: `SELECT i."invoiceNo", p.title AS property, t."fullName" AS tenant, pay.amount, pay.method, pay.reference, pay."paidOn", pay.note
               FROM payments pay JOIN invoices i ON i.id = pay."invoiceId" JOIN properties p ON p.id = i."propertyId"
               JOIN tenants t ON t.id = i."tenantId"
              WHERE p."deletedAt" IS NULL`,
  expenses: `SELECT p.title AS property, e.title, e.category, e.amount, e."expenseDate", e."paidBy", e.status, e.notes
               FROM expenses e JOIN properties p ON p.id = e."propertyId"
              WHERE e."deletedAt" IS NULL AND p."deletedAt" IS NULL`,
};

const exportRows = async (
  type: ExportType,
  ownerId?: string,
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> => {
  const r = await query<Record<string, unknown>>(
    ownerId ? `${EXPORT_SQL[type]} AND p."ownerId" = $1;` : `${EXPORT_SQL[type]};`,
    ownerId ? [ownerId] : [],
  );
  return { columns: r.fields.map((f) => f.name), rows: r.rows };
};

export {
  applyCouponToInvoice,
  claimCoupon,
  createCoupon,
  createSubscriptionInvoice,
  exportRows,
  getBusinessStats,
  getSubscriptionInvoiceById,
  listCoupons,
  listSubscriptionInvoices,
  markSubscriptionInvoicePaid,
  releaseCoupon,
  setCouponStatus,
  voidSubscriptionInvoice,
};
export type { BusinessStats };
