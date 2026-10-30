import { StatusCodes } from 'http-status-codes';

import { type BuildingRecord } from '../models/building-record.model';
import { type Invoice, type Payment } from '../models/invoice.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  findUninvoicedBills,
  linkBillToInvoice,
  releaseInvoiceBills,
  setInvoiceBillsStatus,
} from '../repositories/building-record.repository';
import {
  adjustInvoiceUtilities,
  countUnitsWithCode,
  createInvoice,
  createPayment,
  findInvoiceForUnitMonth,
  getAllInvoices as getAllRepo,
  getBillableLeases,
  getInvoiceById,
  getPaymentById,
  getUnitParkingFee,
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

const billAmount = (bill: BuildingRecord): number => Number(bill.data.amount ?? 0);

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
  return await invoiceLeases(leases, input.month, input.dueDay, actor);
};

// The daily job's entry point: every billable lease, with no signed-in user behind it.
const generateInvoicesForAllLeases = async (
  month: string,
): Promise<{ created: number; skipped: number; invoices: Invoice[] }> => {
  const leases = await getBillableLeases({ month });
  return await invoiceLeases(leases, month, undefined, { id: null, role: 'system' });
};

const invoiceLeases = async (
  leases: Awaited<ReturnType<typeof getBillableLeases>>,
  month: string,
  requestedDueDay: number | undefined,
  actor: Actor,
): Promise<{ created: number; skipped: number; invoices: Invoice[] }> => {
  const input = { month };
  const dueDay = String(requestedDueDay ?? 10).padStart(2, '0');
  const dueDate = `${input.month.slice(0, 7)}-${dueDay}`;

  const invoices: Invoice[] = [];
  let skipped = 0;
  for (const l of leases) {
    if (await invoiceExistsForLeaseMonth(l.id, input.month)) {
      skipped += 1;
      continue;
    }
    const period = input.month.slice(0, 7);
    const bills =
      (await countUnitsWithCode(l.propertyId, l.unitCode)) === 1
        ? await findUninvoicedBills(l.propertyId, l.unitCode, period)
        : [];
    const parkingFee = await getUnitParkingFee(l.unitId);
    const invoice = await createInvoice({
      propertyId: l.propertyId,
      unitId: l.unitId,
      tenantId: l.tenantId,
      leaseId: l.id,
      invoiceNo: await nextInvoiceNo(input.month),
      billingMonth: input.month,
      dueDate,
      rentAmount: rentForMonth(l.monthlyRent, l.escalationPercent, l.startDate, input.month),
      utilitiesAmount: round2(bills.reduce((sum, b) => sum + billAmount(b), 0)),
      penaltyAmount: 0,
      otherAmount: parkingFee,
      note: parkingFee > 0 ? `Other charges include parking: ${parkingFee}` : null,
      createdBy: actor.id,
    });
    for (const bill of bills) {
      await linkBillToInvoice(bill.id, invoice.id, billAmount(bill));
    }
    invoices.push(invoice);
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
  await setInvoiceBillsStatus(id, invoice.status === 'paid' ? 'Paid' : 'Billed');
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
  await setInvoiceBillsStatus(id, invoice.status === 'paid' ? 'Paid' : 'Billed');
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
  await releaseInvoiceBills(id);
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

// Refuses a bill change the linked invoice cannot absorb. `next` is null when deleting.
const assertBillChangeAllowed = async (
  existing: BuildingRecord,
  next: { unit: unknown; period: unknown; amount: number } | null,
): Promise<void> => {
  const invoiceId = existing.data.invoiceId as string | undefined;
  if (!invoiceId) {
    return;
  }
  if (next && (next.unit !== existing.data.unit || next.period !== existing.data.period)) {
    throw err(
      StatusCodes.CONFLICT,
      'This bill is already on an invoice, so its unit and month cannot change',
    );
  }
  const invoice = await getInvoiceById(invoiceId);
  const delta = (next?.amount ?? 0) - Number(existing.data.invoicedAmount ?? 0);
  if (invoice && invoice.paidAmount > invoice.totalAmount + delta) {
    throw err(StatusCodes.CONFLICT, 'Charges cannot be lower than the amount already paid');
  }
};

const applyBillDelta = async (
  invoiceId: string,
  delta: number,
  summary: string,
  actor: Actor,
): Promise<void> => {
  await adjustInvoiceUtilities(invoiceId, delta);
  const invoice = await recalcInvoice(invoiceId);
  if (!invoice) {
    return;
  }
  await setInvoiceBillsStatus(invoiceId, invoice.status === 'paid' ? 'Paid' : 'Billed');
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'invoice',
    entityId: invoice.id,
    propertyId: invoice.propertyId,
    summary: `${summary} on invoice ${invoice.invoiceNo}`,
  });
};

// Puts a saved bill on this month's invoice if there is one, or carries a changed amount over.
const syncBillWithInvoice = async (bill: BuildingRecord, actor: Actor): Promise<void> => {
  const amount = billAmount(bill);
  const invoiceId = bill.data.invoiceId as string | undefined;
  if (invoiceId) {
    const delta = round2(amount - Number(bill.data.invoicedAmount ?? 0));
    if (delta !== 0) {
      await linkBillToInvoice(bill.id, invoiceId, amount);
      await applyBillDelta(invoiceId, delta, `Changed the ${bill.title} utility bill`, actor);
    }
    return;
  }
  const period = bill.data.period as string | null | undefined;
  if (!period || !bill.propertyId || amount <= 0 || bill.status === 'Paid') {
    return;
  }
  if ((await countUnitsWithCode(bill.propertyId, bill.title)) !== 1) {
    return;
  }
  const invoice = await findInvoiceForUnitMonth(bill.propertyId, bill.title, `${period}-01`);
  if (invoice) {
    await linkBillToInvoice(bill.id, invoice.id, amount);
    await applyBillDelta(invoice.id, amount, `Added the ${bill.title} utility bill`, actor);
  }
};

const removeBillFromInvoice = async (bill: BuildingRecord, actor: Actor): Promise<void> => {
  const invoiceId = bill.data.invoiceId as string | undefined;
  if (invoiceId) {
    await applyBillDelta(
      invoiceId,
      -Number(bill.data.invoicedAmount ?? 0),
      `Removed the ${bill.title} utility bill`,
      actor,
    );
  }
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
  assertBillChangeAllowed,
  generateInvoices,
  generateInvoicesForAllLeases,
  getAllInvoices,
  getInvoice,
  removeBillFromInvoice,
  reversePayment,
  syncBillWithInvoice,
  updateInvoice,
  voidInvoice,
};
