import { StatusCodes } from 'http-status-codes';

import {
  type CreateExpenseInput,
  type Expense,
  type UpdateExpenseInput,
} from '../models/expense.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createExpense as createRepo,
  deleteExpense as deleteRepo,
  getAllExpenses as getAllRepo,
  getExpenseById as getByIdRepo,
  updateExpense as updateRepo,
} from '../repositories/expense.repository';
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
const notFound = (m = 'Expense not found'): ReturnType<typeof createResponseError> =>
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
    if (!admin || !hasPermission(admin.permissions, 'expenses')) {
      throw forbidden('You do not have permission to manage expenses');
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

const createExpense = async (input: CreateExpenseInput, actor: Actor): Promise<Expense> => {
  await assertPropertyAccess(actor, input.propertyId);
  const created = await createRepo({ ...input, createdBy: actor.id, updatedBy: actor.id });
  await recordAudit({
    actor,
    action: 'create',
    entityType: 'expense',
    entityId: created.id,
    propertyId: created.propertyId,
    summary: `Added expense ${created.title}`,
  });
  return created;
};

const updateExpense = async (
  id: string,
  input: UpdateExpenseInput,
  actor: Actor,
): Promise<Expense> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  const updated = await updateRepo(id, { ...input, updatedBy: actor.id });
  if (!updated) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'update',
    entityType: 'expense',
    entityId: updated.id,
    propertyId: updated.propertyId,
    summary: `Updated expense ${updated.title}`,
    before: existing,
    after: updated,
  });
  return updated;
};

const deleteExpense = async (id: string, actor: Actor): Promise<Expense> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  const deleted = await deleteRepo(id);
  if (!deleted) {
    throw notFound();
  }
  await recordAudit({
    actor,
    action: 'delete',
    entityType: 'expense',
    entityId: deleted.id,
    propertyId: deleted.propertyId,
    summary: `Deleted expense ${deleted.title}`,
  });
  return deleted;
};

const getExpenseById = async (id: string, actor: Actor): Promise<Expense> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  return existing;
};

const getAllExpenses = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    category?: string;
    propertyId?: string;
    from?: string;
    to?: string;
  },
  actor: Actor,
): Promise<{ items: Expense[]; total: number; sum: number }> => {
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
    if (!admin || !hasPermission(admin.permissions, 'expenses')) {
      throw forbidden('You do not have permission to manage expenses');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0, sum: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }
  throw forbidden();
};

export { createExpense, deleteExpense, getAllExpenses, getExpenseById, updateExpense };
