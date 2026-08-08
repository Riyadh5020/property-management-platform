import { StatusCodes } from 'http-status-codes';

import {
  type CreateFloorInput,
  type Floor,
  type FloorId,
  type UpdateFloorInput,
} from '../models/floor.model';
import {
  createFloor as createFloorRepository,
  getAllFloors as getAllFloorsRepository,
  getFloorById as getFloorByIdRepository,
  updateFloor as updateFloorRepository,
} from '../repositories/floor.repository';
import { createResponseError } from '../utils/app-response';

export class FloorService {
  async create(input: CreateFloorInput, actorId: string | null): Promise<Floor> {
    if (input.floorNumber !== undefined && input.floorNumber !== null && input.floorNumber < 0) {
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

    const repoInput: CreateFloorInput = {
      ...input,
      status: input.status ?? 'draft',
      areaUnit: input.areaUnit ?? 'sqft',
      createdBy: actorId as CreateFloorInput['createdBy'],
      updatedBy: actorId as CreateFloorInput['updatedBy'],
    };

    return await createFloorRepository(repoInput);
  }

  async update(floorId: FloorId, input: UpdateFloorInput): Promise<Floor> {
    const existingFloor = await getFloorByIdRepository(floorId);

    if (!existingFloor) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Floor not found',
      });
    }

    if (input.floorNumber !== undefined && input.floorNumber !== null && input.floorNumber < 0) {
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

    const updatePayload: UpdateFloorInput = {
      buildingId: input.buildingId ?? existingFloor.buildingId,
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
      updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
        ? (input.updatedBy ?? null)
        : existingFloor.updatedBy,
    };

    const floor = await updateFloorRepository(floorId, updatePayload);

    if (!floor) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Floor not found',
      });
    }

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
    buildingId?: Floor['buildingId'];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ items: Floor[]; total: number }> {
    return await getAllFloorsRepository(options);
  }
}

export const floorService = new FloorService();
