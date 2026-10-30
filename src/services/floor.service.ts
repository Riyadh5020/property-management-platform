import { StatusCodes } from 'http-status-codes';

import {
  type CreateFloorInput,
  type Floor,
  type FloorId,
  type UpdateFloorInput,
} from '../models/floor.model';
import {
  createFloor as createFloorRepository,
  deleteFloor as deleteFloorRepository,
  findFloorByNumber,
  getAllFloors as getAllFloorsRepository,
  getFloorById as getFloorByIdRepository,
  updateFloor as updateFloorRepository,
} from '../repositories/floor.repository';
import { getPropertyById, syncPropertyFloorCount } from '../repositories/property.repository';
import { getSubscriptionPlanById } from '../repositories/subscription-plan.repository';
import { getAllUnits as getAllUnitsRepository } from '../repositories/unit.repository';
import { createResponseError } from '../utils/app-response';

import { recordAudit } from './audit-log.service';

export class FloorService {
  async create(
    input: CreateFloorInput,
    actorId: string | null,
    actorRole: string | null,
  ): Promise<Floor> {
    if (actorRole !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Only a super admin can add floors',
      });
    }

    if (input.floorNumber < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Floor number must be 0 or greater',
      });
    }

    if (input.totalUnits !== undefined && input.totalUnits !== null && input.totalUnits < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Total units must be 0 or greater',
      });
    }

    if (input.totalArea !== undefined && input.totalArea !== null && input.totalArea < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Total area must be 0 or greater',
      });
    }

    const duplicate = await findFloorByNumber(input.propertyId, input.floorNumber);
    if (duplicate) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `Floor ${input.floorNumber} already exists in this property`,
        errors: [
          {
            path: 'floorNumber',
            message: `Floor ${input.floorNumber} already exists in this property`,
          },
        ],
      });
    }
    const parentProperty = await getPropertyById(input.propertyId);
    if (parentProperty?.planId) {
      const plan = await getSubscriptionPlanById(parentProperty.planId as never);
      if (plan?.maxFloors !== null && plan?.maxFloors !== undefined) {
        const { total: floorCount } = await getAllFloorsRepository({
          propertyId: input.propertyId,
          limit: 1,
        });
        if (floorCount >= plan.maxFloors) {
          throw createResponseError({
            statusCode: StatusCodes.CONFLICT,
            message: `This property's plan allows ${plan.maxFloors} floors. Upgrade the plan first.`,
          });
        }
      }
    }
    const repoInput: CreateFloorInput = {
      ...input,
      status: input.status ?? 'draft',
      areaUnit: input.areaUnit ?? 'sqft',
      createdBy: actorId as CreateFloorInput['createdBy'],
      updatedBy: actorId as CreateFloorInput['updatedBy'],
    };

    const created = await createFloorRepository(repoInput);
    await syncPropertyFloorCount(created.propertyId);
    await recordAudit({
      actor: { id: actorId, role: actorRole },
      action: 'create',
      entityType: 'floor',
      entityId: created.id,
      propertyId: created.propertyId,
      summary: `Added floor ${created.floorNumber}`,
    });
    return created;
  }

  async update(
    floorId: FloorId,
    input: UpdateFloorInput,
    actorId: string | null = null,
    actorRole: string | null = null,
  ): Promise<Floor> {
    const existingFloor = await getFloorByIdRepository(floorId);

    if (!existingFloor) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Floor not found',
      });
    }

    if (actorRole !== 'superAdmin') {
      const parentProperty = await getPropertyById(existingFloor.propertyId);
      if (actorRole !== 'owner' || parentProperty?.ownerId !== actorId) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Only a super admin or the property owner can edit floors',
        });
      }
    }

    if (input.floorNumber !== undefined && input.floorNumber < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Floor number must be 0 or greater',
      });
    }

    if (input.totalUnits !== undefined && input.totalUnits !== null && input.totalUnits < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Total units must be 0 or greater',
      });
    }

    if (input.totalUnits !== undefined && input.totalUnits !== null) {
      const { total: currentUnitCount } = await getAllUnitsRepository({ floorId, limit: 1 });
      if (input.totalUnits < currentUnitCount) {
        throw createResponseError({
          statusCode: StatusCodes.BAD_REQUEST,
          message: `Cannot set the unit cap below ${currentUnitCount} — this floor already has ${currentUnitCount} unit${currentUnitCount === 1 ? '' : 's'}.`,
        });
      }
    }

    if (input.totalArea !== undefined && input.totalArea !== null && input.totalArea < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Total area must be 0 or greater',
      });
    }

    const updatePayload: UpdateFloorInput = {
      propertyId:
        actorRole === 'superAdmin'
          ? (input.propertyId ?? existingFloor.propertyId)
          : existingFloor.propertyId,
      floorNumber: Object.prototype.hasOwnProperty.call(input, 'floorNumber')
        ? (input.floorNumber ?? existingFloor.floorNumber)
        : existingFloor.floorNumber,
      name: Object.prototype.hasOwnProperty.call(input, 'name')
        ? (input.name ?? null)
        : existingFloor.name,
      totalUnits: Object.prototype.hasOwnProperty.call(input, 'totalUnits')
        ? (input.totalUnits ?? null)
        : existingFloor.totalUnits,
      totalArea: Object.prototype.hasOwnProperty.call(input, 'totalArea')
        ? (input.totalArea ?? null)
        : existingFloor.totalArea,
      areaUnit: Object.prototype.hasOwnProperty.call(input, 'areaUnit')
        ? (input.areaUnit ?? null)
        : existingFloor.areaUnit,
      description: Object.prototype.hasOwnProperty.call(input, 'description')
        ? (input.description ?? null)
        : existingFloor.description,
      amenities: Object.prototype.hasOwnProperty.call(input, 'amenities')
        ? (input.amenities ?? null)
        : existingFloor.amenities,
      status: input.status ?? existingFloor.status,

      floorType: Object.prototype.hasOwnProperty.call(input, 'floorType')
        ? (input.floorType ?? null)
        : existingFloor.floorType,

      updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
        ? (input.updatedBy ?? null)
        : existingFloor.updatedBy,
    };
    if (
      updatePayload.floorNumber !== existingFloor.floorNumber ||
      updatePayload.propertyId !== existingFloor.propertyId
    ) {
      const duplicate = await findFloorByNumber(
        updatePayload.propertyId as string,
        updatePayload.floorNumber ?? existingFloor.floorNumber,
        floorId,
      );
      if (duplicate) {
        throw createResponseError({
          statusCode: StatusCodes.CONFLICT,
          message: `Floor ${updatePayload.floorNumber} already exists in this property`,
          errors: [
            {
              path: 'floorNumber',
              message: `Floor ${updatePayload.floorNumber} already exists in this property`,
            },
          ],
        });
      }
    }

    const floor = await updateFloorRepository(floorId, updatePayload);

    if (!floor) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Floor not found',
      });
    }

    await recordAudit({
      actor: { id: actorId, role: actorRole },
      action: 'update',
      entityType: 'floor',
      entityId: floor.id,
      propertyId: floor.propertyId,
      summary: `Updated floor ${floor.floorNumber}`,
      before: existingFloor,
      after: floor,
    });
    return floor;
  }

  async delete(
    floorId: FloorId,
    actorRole: string | null,
    actorId: string | null = null,
  ): Promise<Floor> {
    if (actorRole !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Unauthorized',
      });
    }

    const floor = await deleteFloorRepository(floorId);

    if (!floor) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Floor not found',
      });
    }
    await syncPropertyFloorCount(floor.propertyId);
    await recordAudit({
      actor: { id: actorId, role: actorRole },
      action: 'delete',
      entityType: 'floor',
      entityId: floor.id,
      propertyId: floor.propertyId,
      summary: `Deleted floor ${floor.floorNumber}`,
    });
    return floor;
  }

  async getById(floorId: FloorId): Promise<Floor | null> {
    return await getFloorByIdRepository(floorId);
  }

  async getAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: Floor['status'];
    propertyId?: Floor['propertyId'];
    ownerId?: string;
    propertyIds?: string[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ items: Floor[]; total: number }> {
    return await getAllFloorsRepository(options);
  }
}

export const floorService = new FloorService();
