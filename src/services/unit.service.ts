import { StatusCodes } from 'http-status-codes';

import {
  type CreateUnitInput,
  type Unit,
  type UnitId,
  type UpdateUnitInput,
} from '../models/unit.model';
import {
  createUnit as createUnitRepository,
  deleteUnit as deleteUnitRepository,
  getAllUnits as getAllUnitsRepository,
  getFloorUnitsAreaSum,
  getUnitById as getUnitByIdRepository,
  updateUnit as updateUnitRepository,
} from '../repositories/unit.repository';
import { createResponseError } from '../utils/app-response';

import { floorService } from './floor.service';
import { getPropertyById } from './property.service';

/** Resolves the owner id for the property that ultimately owns this floor. */
async function resolveFloorOwnerId(floorId: string): Promise<string | null> {
  const floor = await floorService.getById(floorId as never);
  if (!floor) {
    return null;
  }
  const property = await getPropertyById(floor.propertyId);
  return property?.ownerId ?? null;
}

class UnitService {
  async create(
    input: CreateUnitInput,
    actorId: string | null,
    actorRole: string | null,
  ): Promise<Unit> {
    if (input.areaSize <= 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Unit area size must be greater than 0',
      });
    }

    const belongsToOwnerId = await resolveFloorOwnerId(input.floorId);

    if (actorRole !== 'superAdmin') {
      if (actorRole !== 'owner' || belongsToOwnerId !== actorId) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Unauthorized',
        });
      }
    }

    // Soft warning only — never block. The caller can inspect `areaWarning`
    // in the response and decide whether to re-submit anyway.
    const floor = await floorService.getById(input.floorId);
    if (floor?.totalUnits !== null && floor?.totalUnits !== undefined) {
      const { total: existingUnitCount } = await getAllUnitsRepository({
        floorId: input.floorId,
        limit: 1,
      });
      if (existingUnitCount >= floor.totalUnits) {
        throw createResponseError({
          statusCode: StatusCodes.BAD_REQUEST,
          message: `This floor is capped at ${floor.totalUnits} unit${floor.totalUnits === 1 ? '' : 's'}.`,
        });
      }
    }
    const existingSum = await getFloorUnitsAreaSum(input.floorId);
    const projectedSum = existingSum + input.areaSize;
    const floorTotalArea = floor?.totalArea ?? null;

    const repoInput: CreateUnitInput = {
      ...input,
      status: input.status ?? 'vacant',
      unitType: input.unitType,
      createdBy: actorId as CreateUnitInput['createdBy'],
      updatedBy: actorId as CreateUnitInput['updatedBy'],
    };

    const unit = await createUnitRepository(repoInput);

    (unit as Unit & { areaWarning?: string }).areaWarning =
      floorTotalArea !== null && projectedSum > floorTotalArea
        ? `This floor's total area is ${floorTotalArea} sqft, and units now total ${projectedSum} sqft — over by ${(projectedSum - floorTotalArea).toFixed(2)} sqft.`
        : undefined;

    return unit;
  }

  private static readonly OWNER_EDITABLE_FIELDS = new Set<keyof UpdateUnitInput>([
    'unitCode',
    'unitType',
    'areaSize',
    'bedrooms',
    'bathrooms',
    'hasKitchen',
    'hasBalcony',
    'rent',
    'status',
  ]);

  async update(
    unitId: UnitId,
    input: UpdateUnitInput,
    actorId: string | null = null,
    actorRole: string | null = null,
  ): Promise<Unit> {
    const existingUnit = await getUnitByIdRepository(unitId);

    if (!existingUnit) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Unit not found',
      });
    }

    const belongsToOwnerId = await resolveFloorOwnerId(existingUnit.floorId);

    if (actorRole !== 'superAdmin') {
      if (actorRole !== 'owner' || belongsToOwnerId !== actorId) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Unauthorized',
        });
      }

      // Units are the owner's own operational data — unlike Property/Building,
      // owners get full control over their own units' fields, just not floorId
      // (moving a unit to a different floor stays superAdmin-only).
      for (const key of Object.keys(input) as (keyof UpdateUnitInput)[]) {
        if (key === 'updatedBy') {
          continue;
        }
        if (!UnitService.OWNER_EDITABLE_FIELDS.has(key)) {
          // delete input[key];
          input[key] = undefined;
        }
      }
    }

    if (input.areaSize !== undefined && input.areaSize <= 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Unit area size must be greater than 0',
      });
    }

    let areaWarning: string | undefined;
    if (input.areaSize !== undefined) {
      const floor = await floorService.getById(existingUnit.floorId);
      const existingSum = await getFloorUnitsAreaSum(existingUnit.floorId, unitId);
      const projectedSum = existingSum + input.areaSize;
      const floorTotalArea = floor?.totalArea ?? null;

      if (floorTotalArea !== null && projectedSum > floorTotalArea) {
        areaWarning = `This floor's total area is ${floorTotalArea} sqft, and units now total ${projectedSum} sqft — over by ${(projectedSum - floorTotalArea).toFixed(2)} sqft.`;
      }
    }

    const updatePayload: UpdateUnitInput = {
      floorId: input.floorId ?? existingUnit.floorId,
      unitCode: input.unitCode ?? existingUnit.unitCode,
      unitType: input.unitType ?? existingUnit.unitType,
      areaSize: input.areaSize ?? existingUnit.areaSize,
      bedrooms: Object.prototype.hasOwnProperty.call(input, 'bedrooms')
        ? (input.bedrooms ?? null)
        : existingUnit.bedrooms,
      bathrooms: Object.prototype.hasOwnProperty.call(input, 'bathrooms')
        ? (input.bathrooms ?? null)
        : existingUnit.bathrooms,
      hasKitchen: Object.prototype.hasOwnProperty.call(input, 'hasKitchen')
        ? (input.hasKitchen ?? false)
        : existingUnit.hasKitchen,
      hasBalcony: Object.prototype.hasOwnProperty.call(input, 'hasBalcony')
        ? (input.hasBalcony ?? false)
        : existingUnit.hasBalcony,
      rent: Object.prototype.hasOwnProperty.call(input, 'rent')
        ? (input.rent ?? null)
        : existingUnit.rent,
      status: input.status ?? existingUnit.status,
      updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
        ? (input.updatedBy ?? null)
        : existingUnit.updatedBy,
    };

    const unit = await updateUnitRepository(unitId, updatePayload);

    if (!unit) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Unit not found',
      });
    }

    (unit as Unit & { areaWarning?: string }).areaWarning = areaWarning;

    return unit;
  }

  async getById(unitId: UnitId): Promise<Unit | null> {
    return await getUnitByIdRepository(unitId);
  }

  async getAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: Unit['status'];
    unitType?: Unit['unitType'];
    floorId?: Unit['floorId'];
    ownerId?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ items: Unit[]; total: number }> {
    return await getAllUnitsRepository(options);
  }

  async delete(unitId: UnitId, actorId: string | null, actorRole: string | null): Promise<Unit> {
    const existingUnit = await getUnitByIdRepository(unitId);

    if (!existingUnit) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Unit not found',
      });
    }

    if (actorRole !== 'superAdmin') {
      const belongsToOwnerId = await resolveFloorOwnerId(existingUnit.floorId);
      if (actorRole !== 'owner' || belongsToOwnerId !== actorId) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Unauthorized',
        });
      }
    }

    const unit = await deleteUnitRepository(unitId);

    if (!unit) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Unit not found',
      });
    }

    return unit;
  }
}

export const unitService = new UnitService();
