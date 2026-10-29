import { StatusCodes } from 'http-status-codes';

import {
  type CreateParkingInput,
  type ParkingSlot,
  type UpdateParkingInput,
} from '../models/parking.model';
import { findAdminById } from '../repositories/admin.repository';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import {
  createParking as createRepo,
  deleteParking as deleteRepo,
  findSlotByNumber,
  getAllParking as getAllRepo,
  getParkingById as getByIdRepo,
  updateParking as updateRepo,
} from '../repositories/parking.repository';
import { getPropertyById } from '../repositories/property.repository';
import { getUnitPropertyId } from '../repositories/tenant.repository';
import { createResponseError } from '../utils/app-response';

interface Actor {
  id: string | null;
  role: string | null;
}

const err = (statusCode: number, message: string): Error =>
  createResponseError({ statusCode, message });
const forbidden = (m = 'Unauthorized'): Error => err(StatusCodes.FORBIDDEN, m);
const notFound = (m = 'Parking slot not found'): Error => err(StatusCodes.NOT_FOUND, m);

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
      throw forbidden('You do not have permission to manage parking');
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

const assertUnit = async (propertyId: string, unitId?: string | null): Promise<void> => {
  if (!unitId) {
    return;
  }
  if ((await getUnitPropertyId(unitId)) !== propertyId) {
    throw err(StatusCodes.BAD_REQUEST, 'This unit does not belong to the selected property');
  }
};

// A slot with a unit or vehicle is "assigned"; blocked stays blocked; otherwise free.
const deriveStatus = (
  requested: string | undefined,
  unitId: string | null | undefined,
  vehicle: string | null | undefined,
): 'free' | 'assigned' | 'blocked' => {
  if (requested === 'blocked') {
    return 'blocked';
  }
  return unitId || vehicle ? 'assigned' : 'free';
};

const createParking = async (input: CreateParkingInput, actor: Actor): Promise<ParkingSlot> => {
  await assertPropertyAccess(actor, input.propertyId);
  await assertUnit(input.propertyId, input.unitId);
  if (await findSlotByNumber(input.propertyId, input.slotNumber)) {
    throw err(StatusCodes.CONFLICT, `Slot ${input.slotNumber} already exists in this property`);
  }
  return await createRepo({
    ...input,
    status: deriveStatus(input.status, input.unitId, input.vehicleNumber),
    createdBy: actor.id,
    updatedBy: actor.id,
  });
};

const updateParking = async (
  id: string,
  input: UpdateParkingInput,
  actor: Actor,
): Promise<ParkingSlot> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  if (input.unitId) {
    await assertUnit(existing.propertyId, input.unitId);
  }
  if (input.slotNumber && input.slotNumber !== existing.slotNumber) {
    if (await findSlotByNumber(existing.propertyId, input.slotNumber, id)) {
      throw err(StatusCodes.CONFLICT, `Slot ${input.slotNumber} already exists in this property`);
    }
  }
  const nextUnit = 'unitId' in input ? input.unitId : existing.unitId;
  const nextVehicle = 'vehicleNumber' in input ? input.vehicleNumber : existing.vehicleNumber;
  const updated = await updateRepo(id, {
    ...input,
    status: deriveStatus(input.status ?? existing.status, nextUnit, nextVehicle),
    updatedBy: actor.id,
  });
  if (!updated) {
    throw notFound();
  }
  return updated;
};

const deleteParking = async (id: string, actor: Actor): Promise<ParkingSlot> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  const deleted = await deleteRepo(id);
  if (!deleted) {
    throw notFound();
  }
  return deleted;
};

const getParkingById = async (id: string, actor: Actor): Promise<ParkingSlot> => {
  const existing = await getByIdRepo(id);
  if (!existing) {
    throw notFound();
  }
  await assertPropertyAccess(actor, existing.propertyId);
  return existing;
};

const getAllParking = async (
  options: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
    slotType?: string;
    propertyId?: string;
  },
  actor: Actor,
): Promise<{ items: ParkingSlot[]; total: number }> => {
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
      throw forbidden('You do not have permission to manage parking');
    }
    const assigned = await listPropertyIdsForManager(actor.id);
    if (assigned.length === 0) {
      return { items: [], total: 0 };
    }
    return await getAllRepo({ ...options, propertyIds: assigned });
  }
  throw forbidden();
};

export { createParking, deleteParking, getAllParking, getParkingById, updateParking };
