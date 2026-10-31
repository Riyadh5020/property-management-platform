import { StatusCodes } from 'http-status-codes';

import { type Coupon, type SubscriptionInvoice } from '../models/subscription-billing.model';
import {
  applyCouponToInvoice,
  claimCoupon,
  createCoupon as createCouponRepo,
  createSubscriptionInvoice,
  exportRows,
  getBusinessStats as getBusinessStatsRepo,
  getSubscriptionInvoiceById,
  listCoupons as listCouponsRepo,
  listSubscriptionInvoices,
  markSubscriptionInvoicePaid,
  releaseCoupon,
  setCouponStatus as setCouponStatusRepo,
  voidSubscriptionInvoice,
  type BusinessStats,
  type ExportType,
} from '../repositories/subscription-billing.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

interface Actor {
  id: string | null;
  role: string | null;
}

const err = (statusCode: number, message: string): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode, message });
const forbidden = (): ReturnType<typeof createResponseError> =>
  err(StatusCodes.FORBIDDEN, 'Unauthorized');

const assertSuperAdmin = (actor: Actor): void => {
  if (actor.role !== 'superAdmin') {
    throw forbidden();
  }
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Called when a paid plan is set or renewed. Best effort: a billing record problem must not undo
// the subscription change, so failures are only logged.
const issueSubscriptionInvoice = async (input: {
  propertyId: string;
  ownerId: string | null;
  planId: string | null;
  description: string;
  amount: number;
  discountAmount: number;
  createdBy: string | null;
}): Promise<void> => {
  if (input.amount <= 0) {
    return;
  }
  try {
    await createSubscriptionInvoice(input);
  } catch (error) {
    console.warn('[billing] could not create a subscription invoice:', error);
  }
};

const listInvoices = async (
  options: { limit: number; offset: number; status?: string; search?: string },
  actor: Actor,
): Promise<{ items: SubscriptionInvoice[]; total: number }> => {
  if (actor.role === 'superAdmin') {
    return await listSubscriptionInvoices(options);
  }
  if (actor.role === 'owner' && actor.id) {
    return await listSubscriptionInvoices({ ...options, ownerId: actor.id });
  }
  throw forbidden();
};

const recordPayment = async (
  id: string,
  input: { paidOn: string; method: string; reference?: string | null; note?: string | null },
  actor: Actor,
): Promise<SubscriptionInvoice> => {
  assertSuperAdmin(actor);
  const paid = await markSubscriptionInvoicePaid(id, input);
  if (!paid) {
    throw err(StatusCodes.CONFLICT, 'Only a due invoice can be marked as paid');
  }
  await recordAudit({
    actor,
    action: 'payment',
    entityType: 'subscription_invoice',
    entityId: paid.id,
    propertyId: paid.propertyId,
    summary: `Recorded a payment of ${paid.amount} (${paid.method ?? ''}) on ${paid.invoiceNo}`,
  });
  return paid;
};

const voidInvoice = async (id: string, actor: Actor): Promise<SubscriptionInvoice> => {
  assertSuperAdmin(actor);
  const voided = await voidSubscriptionInvoice(id);
  if (!voided) {
    throw err(StatusCodes.CONFLICT, 'Only a due invoice can be voided');
  }
  await recordAudit({
    actor,
    action: 'void',
    entityType: 'subscription_invoice',
    entityId: voided.id,
    propertyId: voided.propertyId,
    summary: `Voided ${voided.invoiceNo}`,
  });
  return voided;
};

const applyCoupon = async (
  id: string,
  code: string,
  actor: Actor,
): Promise<SubscriptionInvoice> => {
  const invoice = await getSubscriptionInvoiceById(id);
  if (!invoice) {
    throw err(StatusCodes.NOT_FOUND, 'Invoice not found');
  }
  if (actor.role !== 'superAdmin' && (actor.role !== 'owner' || invoice.ownerId !== actor.id)) {
    throw forbidden();
  }
  if (invoice.status !== 'due' || invoice.couponCode) {
    throw err(StatusCodes.CONFLICT, 'A coupon can be used once, on a due invoice');
  }
  const coupon = await claimCoupon(code);
  if (!coupon) {
    throw err(StatusCodes.BAD_REQUEST, 'This coupon is not valid or has expired');
  }
  const amount = invoice.amount;
  const value = coupon.value;
  const discount = round2(
    Math.min(amount, coupon.discountType === 'percent' ? (amount * value) / 100 : value),
  );
  const updated = await applyCouponToInvoice(id, coupon.code, discount);
  if (!updated) {
    await releaseCoupon(coupon.id);
    throw err(StatusCodes.CONFLICT, 'A coupon can be used once, on a due invoice');
  }
  await recordAudit({
    actor,
    action: 'coupon',
    entityType: 'subscription_invoice',
    entityId: updated.id,
    propertyId: updated.propertyId,
    summary: `Used coupon ${coupon.code} on ${updated.invoiceNo} for ${discount} off`,
  });
  return updated;
};

const createCoupon = async (
  input: {
    code: string;
    discountType: string;
    value: number;
    maxUses?: number | null;
    expiresOn?: string | null;
  },
  actor: Actor,
): Promise<Coupon> => {
  assertSuperAdmin(actor);
  if (input.discountType === 'percent' && input.value > 100) {
    throw err(StatusCodes.BAD_REQUEST, 'A percent discount cannot be more than 100');
  }
  return await createCouponRepo({ ...input, createdBy: actor.id });
};

const listCoupons = async (actor: Actor): Promise<Coupon[]> => {
  assertSuperAdmin(actor);
  return await listCouponsRepo();
};

const setCouponStatus = async (id: string, status: string, actor: Actor): Promise<Coupon> => {
  assertSuperAdmin(actor);
  const updated = await setCouponStatusRepo(id, status);
  if (!updated) {
    throw err(StatusCodes.NOT_FOUND, 'Coupon not found');
  }
  return updated;
};

const getBusinessStats = async (actor: Actor): Promise<BusinessStats> => {
  assertSuperAdmin(actor);
  return await getBusinessStatsRepo();
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  let text = value instanceof Date ? value.toISOString() : `${value as string | number | boolean}`;
  // Spreadsheets run cells that start with these characters as formulas.
  if (/^[=+\-@\t\r]/.test(text) && Number.isNaN(Number(text))) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const exportCsv = async (
  type: ExportType,
  actor: Actor,
): Promise<{ filename: string; csv: string }> => {
  if (actor.role !== 'superAdmin' && actor.role !== 'owner') {
    throw forbidden();
  }
  const { columns, rows } = await exportRows(
    type,
    actor.role === 'owner' ? (actor.id ?? undefined) : undefined,
  );
  const lines = [
    columns.map((c) => csvCell(c)).join(','),
    ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(',')),
  ];
  await recordAudit({
    actor,
    action: 'export',
    entityType: 'record',
    entityId: null,
    propertyId: null,
    summary: `Exported ${type} (${rows.length} rows)`,
  });
  return {
    filename: `estateops-${type}-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: `${lines.join('\r\n')}\r\n`,
  };
};

export {
  applyCoupon,
  createCoupon,
  exportCsv,
  getBusinessStats,
  issueSubscriptionInvoice,
  listCoupons,
  listInvoices,
  recordPayment,
  setCouponStatus,
  voidInvoice,
};
