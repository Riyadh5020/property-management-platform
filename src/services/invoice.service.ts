import { StatusCodes } from 'http-status-codes';

import { type Invoice, type Payment } from '../models/invoice.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createInvoice,
  createPayment,
  getAllInvoices as getAllRepo,
  getBillableLeases,
  getInvoiceById,
  getPaymentById,
  invoiceExistsForLeaseMonth,
  listPayments,
  nextInvoiceNo,
  recalcInvoice,
  updateInvoiceCharges,
  voidInvoice as voidRepo,
} from '../repositories/invoice.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getPropertyById } from '../repositories/property.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

interface Actor {
  id: string | null;
  role: string | null;
}

const err = (statusCode: number, message: string): ReturnType<typeof createResponseError> =>
  createResponseError({ statusCode, message });
const forbidden = (m = 'Unauthorized'): ReturnType<typeof createResponseError> =>
  err(StatusCodes.FORBIDDEN, m);
const notFound = (m = 'Invoice not found'): ReturnType<typeof createResponseError> =>
  err(StatusCodes.NOT_FOUND, m);

const hasPermission = (permissions: unknown, key: string): boolean =>
  typeof permissions === 'object' &&
  permissions !== null &&
  (permissions as Record<string, unknown>)[key] === true;

const assertPropertyAccess = async (actor: Actor, propertyId: string): Promise<void> => {
  if (!actor.id) {
    throw forbidden();
  }
  if (actor.role === 'superAdmin') {
    return;
  }
  const property = await getPropertyById(propertyId as never);
  if (!property) {
    throw notFound('Property not found');
  }
  if (actor.role === 'owner') {
    if (property.ownerId !== actor.id) {
      throw forbidden();
    }
    return;
  }
  if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'rent')) {
      throw forbidden('You do not have permission to manage billing');
    }
    if (admin.ownerId !== property.ownerId) {
      throw forbidden();
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (!assigned.includes(propertyId)) {
      throw forbidden();
    }
    return;
  }
  throw forbidden();
};

const loadInvoice = async (id: string, actor: Actor): Promise<Invoice> => {
  const inv = await getInvoiceById(id);
  if (!inv) {
    throw notFound();
  }
  await assertPropertyAccess(actor, inv.propertyId);
  return inv;
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// rent x (1 + escalation%) ^ full years since lease start
const rentForMonth = (
  rent: number,
  escalation: number,
  leaseStart: string,
  month: string,
): number => {
  const [sy, sm] = leaseStart.split('-').map(Number) as [number, number];
  const [my, mm] = month.split('-').map(Number) as [number, number];
  const months = (my - sy) * 12 + (mm - sm);
  const years = Math.max(0, Math.floor(months / 12));
  return round2(rent * Math.pow(1 + escalation / 100, years));
};

const generateInvoices = async (
  input: { month: string; propertyId?: string; dueDay?: number },
  actor: Actor,
): Promise<{ created: number; skipped: number; invoices: Invoice[] }> => {
  if (!actor.id) {
    throw forbidden();
  }
  const scope: { propertyId?: string; propertyIds?: string[]; ownerId?: string } = {};
  if (input.propertyId) {
    await assertPropertyAccess(actor, input.propertyId);
    scope.propertyId = input.propertyId;
  } else if (actor.role === 'owner') {
    scope.ownerId = actor.id;
  } else if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'rent')) {
      throw forbidden('You do not have permission to manage billing');
    }
    scope.propertyIds = await listPropertyIdsForManager(actor.id);
    if (scope.propertyIds.length === 0) {
      return { created: 0, skipped: 0, invoices: [] };
    }
  }

  const leases = await getBillableLeases({ ...scope, month: input.month });
  const dueDay = String(input.dueDay ?? 10).padStart(2, '0');
  const dueDate = `${input.month.slice(0, 7)}-${dueDay}`;

  const invoices: Invoice[] = [];
  let skipped = 0;
  for (const l of leases) {
    if (await invoiceExistsForLeaseMonth(l.id, input.month)) {
      skipped += 1;
      continue;
    }
    invoices.push(
      await createInvoice({
        propertyId: l.propertyId,
        unitId: l.unitId,
        tenantId: l.tenantId,
        leaseId: l.id,
        invoiceNo: await nextInvoiceNo(input.month),
        billingMonth: input.month,
        dueDate,
        rentAmount: rentForMonth(l.monthlyRent, l.escalationPercent, l.startDate, input.month),
        utilitiesAmount: 0,
        penaltyAmount: 0,
        otherAmount: 0,
        createdBy: actor.id,
      }),
    );
  }
  for (const invoice of invoices) {
    await recordAudit({
      actor,
      action: 'generate',
      entityType: 'invoice',
      entityId: invoice.id,
      propertyId: invoice.propertyId,
      summary: `Generated invoice ${invoice.invoiceNo}`,
    });
  }
  return { created: invoices.length, skipped, invoices };
};

const updateInvoice = async (
  id: string,
  input: {
    utilitiesAmount?: number;
    penaltyAmount?: number;
    otherAmount?: number;
    dueDate?: string;
    note?: string | null;
  },
  actor: Actor,
): Promise<Invoice> => {
  const inv = await loadInvoice(id, actor);
  if (inv.status === 'void') {
    throw err(StatusCodes.CONFLICT, 'A void invoice cannot be changed');
  }
  const updated = await updateInvoiceCharges(id, input);
  if (!updated) {
    throw notFound();
  }
  const recalculated = await recalcInvoice(id);
  if (!recalculated) {
    throw notFound();
  }
  // Lowering charges below what is already paid would create an overpayment.
  if (recalculated.paidAmount > recalculated.totalAmount) {
    await updateInvoiceCharges(id, {
      utilitiesAmount: inv.utilitiesAmount,
      penaltyAmount: inv.penaltyAmount,
      otherAmount: inv.otherAmount,
    });
    await recalcInvoice(id);
    throw err(StatusCodes.CONFLICT, 'Charges cannot be lower than the amount already paid');
  }
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'invoice',
    entityId: recalculated.id,
    propertyId: recalculated.propertyId,
    summary: `Updated invoice ${recalculated.invoiceNo}`,
    before: inv,
    after: recalculated,
  });
  return recalculated;
};

const addPayment = async (
  id: string,
  input: {
    amount: number;
    method: string;
    reference?: string | null;
    paidOn: string;
    note?: string | null;
  },
  actor: Actor,
): Promise<{ invoice: Invoice; payment: Payment }> => {
  const inv = await loadInvoice(id, actor);
  if (inv.status === 'void') {
    throw err(StatusCodes.CONFLICT, 'Cannot take payment on a void invoice');
  }
  const balance = round2(inv.totalAmount - inv.paidAmount);
  if (input.amount > balance) {
    throw err(StatusCodes.BAD_REQUEST, `Payment exceeds the balance of ${balance}`);
  }
  const payment = await createPayment({ invoiceId: id, ...input, createdBy: actor.id });
  const invoice = await recalcInvoice(id);
  if (!invoice) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'payment',
    entityType: 'invoice',
    entityId: invoice.id,
    propertyId: invoice.propertyId,
    summary: `Recorded payment of ${payment.amount} (${payment.method}) on invoice ${invoice.invoiceNo}`,
  });
  return { invoice, payment };
};

const reversePayment = async (
  id: string,
  paymentId: string,
  note: string,
  actor: Actor,
): Promise<{ invoice: Invoice; payment: Payment }> => {
  const inv = await loadInvoice(id, actor);
  const original = await getPaymentById(paymentId);
  if (original?.invoiceId !== id) {
    throw notFound('Payment not found');
  }
  if (original.amount <= 0) {
    throw err(StatusCodes.BAD_REQUEST, 'A reversal cannot be reversed');
  }
  let reversal: Payment;
  try {
    reversal = await createPayment({
      invoiceId: id,
      amount: -original.amount,
      method: original.method,
      paidOn: new Date().toISOString().slice(0, 10),
      reversesPaymentId: paymentId,
      note,
      createdBy: actor.id,
    });
  } catch {
    throw err(StatusCodes.CONFLICT, 'This payment has already been reversed');
  }
  void inv;
  const invoice = await recalcInvoice(id);
  if (!invoice) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'reverse_payment',
    entityType: 'invoice',
    entityId: invoice.id,
    propertyId: invoice.propertyId,
    summary: `Reversed payment of ${original.amount} on invoice ${invoice.invoiceNo}: ${note}`,
  });
  return { invoice, payment: reversal };
};

const voidInvoice = async (id: string, actor: Actor): Promise<Invoice> => {
  const inv = await loadInvoice(id, actor);
  if (inv.status === 'void') {
    throw err(StatusCodes.CONFLICT, 'Invoice is already void');
  }
  if (inv.paidAmount !== 0) {
    throw err(StatusCodes.CONFLICT, 'Reverse the payments before voiding this invoice');
  }
  const voided = await voidRepo(id);
  if (!voided) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'void',
    entityType: 'invoice',
    entityId: voided.id,
    propertyId: voided.propertyId,
    summary: `Voided invoice ${voided.invoiceNo}`,
  });
  return voided;
};

const getInvoice = async (
  id: string,
  actor: Actor,
): Promise<{ invoice: Invoice; payments: Payment[] }> => {
  const invoice = await loadInvoice(id, actor);
  return { invoice, payments: await listPayments(id) };
};

const getAllInvoices = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    month?: string;
    propertyId?: string;
    tenantId?: string;
  },
  actor: Actor,
): Promise<{ items: Invoice[]; total: number }> => {
  if (!actor.id) {
    throw forbidden();
  }
  if (actor.role === 'superAdmin') {
    return await getAllRepo(options);
  }
  if (actor.role === 'owner') {
    return await getAllRepo({ ...options, ownerId: actor.id });
  }
  if (actor.role === 'manager') {
    const admin = await findAdminById(actor.id);
    if (!admin || !hasPermission(admin.permissions, 'rent')) {
      throw forbidden('You do not have permission to manage billing');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }
  throw forbidden();
};

export {
  addPayment,
  generateInvoices,
  getAllInvoices,
  getInvoice,
  reversePayment,
  updateInvoice,
  voidInvoice,
};
