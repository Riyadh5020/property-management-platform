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
  findUnitByCode,
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
    if (await findUnitByCode(input.floorId, input.unitCode)) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `Unit code ${input.unitCode} already exists on this floor`,
        errors: [
          { path: 'unitCode', message: `Unit code ${input.unitCode} already exists on this floor` },
        ],
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

  async bulkCreate(
    floorId: string,
    units: Omit<CreateUnitInput, 'floorId' | 'createdBy' | 'updatedBy'>[],
    actorId: string | null,
    actorRole: string | null,
  ): Promise<{ created: Unit[]; areaWarning?: string }> {
    const floor = await floorService.getById(floorId as never);
    if (!floor) {
      throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Floor not found' });
    }

    if (actorRole !== 'superAdmin') {
      const belongsToOwnerId = await resolveFloorOwnerId(floorId);
      if (actorRole !== 'owner' || belongsToOwnerId !== actorId) {
        throw createResponseError({ statusCode: StatusCodes.FORBIDDEN, message: 'Unauthorized' });
      }
    }

    // 1. duplicates inside the request + clashes with existing units (all conflicts listed)
    const conflicts: { path: string; message: string }[] = [];
    const seen = new Set<string>();
    for (const [index, unit] of units.entries()) {
      const code = unit.unitCode.trim();
      if (seen.has(code)) {
        conflicts.push({
          path: `units.${index}.unitCode`,
          message: `Unit code ${code} is repeated in this request`,
        });
      }
      seen.add(code);
      if (await findUnitByCode(floorId, code)) {
        conflicts.push({
          path: `units.${index}.unitCode`,
          message: `Unit code ${code} already exists on this floor`,
        });
      }
    }
    if (conflicts.length > 0) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `${conflicts.length} unit code conflict${conflicts.length === 1 ? '' : 's'} — nothing was created`,
        errors: conflicts,
      });
    }

    // 2. cap
    const { total: existingCount } = await getAllUnitsRepository({
      floorId: floorId as never,
      limit: 1,
    });
    if (floor.totalUnits !== null && existingCount + units.length > floor.totalUnits) {
      const room = Math.max(0, floor.totalUnits - existingCount);
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: `This floor is capped at ${floor.totalUnits} unit${floor.totalUnits === 1 ? '' : 's'} and has ${existingCount}. You can add ${room} more, not ${units.length}.`,
      });
    }

    // 3. create; if one fails, soft-delete the ones already created (all-or-nothing)
    const created: Unit[] = [];
    try {
      for (const unit of units) {
        created.push(
          await createUnitRepository({
            ...unit,
            unitCode: unit.unitCode.trim(),
            floorId: floorId as CreateUnitInput['floorId'],
            status: unit.status ?? 'vacant',
            unitType: unit.unitType,
            createdBy: actorId as CreateUnitInput['createdBy'],
            updatedBy: actorId as CreateUnitInput['updatedBy'],
          }),
        );
      }
    } catch (error) {
      for (const unit of created) {
        await deleteUnitRepository(unit.id).catch(() => null);
      }
      throw error;
    }

    const existingSum = await getFloorUnitsAreaSum(floorId as never);
    const projectedSum = existingSum;
    const floorTotalArea = floor.totalArea ?? null;
    const areaWarning =
      floorTotalArea !== null && projectedSum > floorTotalArea
        ? `This floor's total area is ${floorTotalArea} sqft, and units now total ${projectedSum} sqft — over by ${(projectedSum - floorTotalArea).toFixed(2)} sqft.`
        : undefined;

    return areaWarning ? { created, areaWarning } : { created };
  }

  async copyLayout(
    targetFloorId: string,
    sourceFloorId: string,
    actorId: string | null,
    actorRole: string | null,
  ): Promise<{ created: Unit[]; areaWarning?: string }> {
    if (targetFloorId === sourceFloorId) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Source and target floor must be different',
      });
    }

    const source = await floorService.getById(sourceFloorId as never);
    const target = await floorService.getById(targetFloorId as never);
    if (!source || !target) {
      throw createResponseError({ statusCode: StatusCodes.NOT_FOUND, message: 'Floor not found' });
    }
    if (source.propertyId !== target.propertyId) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Both floors must belong to the same property',
      });
    }

    const { items: sourceUnits } = await getAllUnitsRepository({
      floorId: sourceFloorId as never,
      limit: 200,
      sortBy: 'unitCode',
      sortDir: 'asc',
    });
    if (sourceUnits.length === 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'The source floor has no units to copy',
      });
    }

    return await this.bulkCreate(
      targetFloorId,
      sourceUnits.map((u) => ({
        unitCode: u.unitCode,
        unitType: u.unitType,
        areaSize: u.areaSize,
        bedrooms: u.bedrooms,
        bathrooms: u.bathrooms,
        hasKitchen: u.hasKitchen,
        hasBalcony: u.hasBalcony,
        rent: u.rent,
        status: 'vacant',
      })),
      actorId,
      actorRole,
    );
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

    if (
      updatePayload.unitCode !== existingUnit.unitCode ||
      updatePayload.floorId !== existingUnit.floorId
    ) {
      const duplicate = await findUnitByCode(
        updatePayload.floorId as string,
        updatePayload.unitCode ?? existingUnit.unitCode,
        unitId,
      );
      if (duplicate) {
        throw createResponseError({
          statusCode: StatusCodes.CONFLICT,
          message: `Unit code ${updatePayload.unitCode} already exists on this floor`,
          errors: [
            {
              path: 'unitCode',
              message: `Unit code ${updatePayload.unitCode} already exists on this floor`,
            },
          ],
        });
      }
    }

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
    propertyIds?: string[];
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
