import { StatusCodes } from 'http-status-codes';

import {
  type Building,
  type BuildingId,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from '../models/building.model';
import {
  createBuilding as createBuildingRepository,
  deleteBuilding as deleteBuildingRepository,
  getAllBuildings as getAllBuildingsRepository,
  getBuildingById as getBuildingByIdRepository,
  updateBuilding as updateBuildingRepository,
} from '../repositories/building.repository';
import { createResponseError } from '../utils/app-response';

import { getPropertyById } from './property.service';

export class BuildingService {
  async create(input: CreateBuildingInput, actorId: string | null): Promise<Building> {
    if (input.floors !== undefined && input.floors !== null && input.floors < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Number of floors must be 0 or greater',
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

    const repoInput: CreateBuildingInput = {
      ...input,
      status: input.status ?? 'draft',
      areaUnit: input.areaUnit ?? 'sqft',
      createdBy: actorId as CreateBuildingInput['createdBy'],
      updatedBy: actorId as CreateBuildingInput['updatedBy'],
    };

    return await createBuildingRepository(repoInput);
  }

  async update(
    buildingId: BuildingId,
    input: UpdateBuildingInput,
    actorId: string | null = null,
    actorRole: string | null = null,
  ): Promise<Building> {
    const existingBuilding = await getBuildingByIdRepository(buildingId);

    if (!existingBuilding) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Building not found',
      });
    }

    if (actorRole !== 'superAdmin') {
      const parentProperty = await getPropertyById(existingBuilding.propertyId);
      const belongsToOwnerId = parentProperty?.ownerId ?? null;

      if (actorRole !== 'owner' || belongsToOwnerId !== actorId) {
        throw createResponseError({
          statusCode: StatusCodes.FORBIDDEN,
          message: 'Unauthorized',
        });
      }

      const BUILDING_OWNER_EDITABLE_FIELDS = new Set<keyof UpdateBuildingInput>(['description']);

      for (const key of Object.keys(input) as (keyof UpdateBuildingInput)[]) {
        if (key === 'updatedBy') {
          continue;
        }
        if (!BUILDING_OWNER_EDITABLE_FIELDS.has(key)) {
          // delete input[key];
          input[key] = undefined;
        }
      }
    }

    if (input.floors !== undefined && input.floors !== null && input.floors < 0) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Number of floors must be 0 or greater',
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

    const updatePayload: UpdateBuildingInput = {
      propertyId: input.propertyId ?? existingBuilding.propertyId,
      name: input.name ?? existingBuilding.name,
      buildingNumber: Object.prototype.hasOwnProperty.call(input, 'buildingNumber')
        ? (input.buildingNumber ?? null)
        : existingBuilding.buildingNumber,
      floors: Object.prototype.hasOwnProperty.call(input, 'floors')
        ? (input.floors ?? null)
        : existingBuilding.floors,
      totalUnits: Object.prototype.hasOwnProperty.call(input, 'totalUnits')
        ? (input.totalUnits ?? null)
        : existingBuilding.totalUnits,
      totalArea: Object.prototype.hasOwnProperty.call(input, 'totalArea')
        ? (input.totalArea ?? null)
        : existingBuilding.totalArea,
      areaUnit: Object.prototype.hasOwnProperty.call(input, 'areaUnit')
        ? (input.areaUnit ?? null)
        : existingBuilding.areaUnit,
      description: Object.prototype.hasOwnProperty.call(input, 'description')
        ? (input.description ?? null)
        : existingBuilding.description,
      status: input.status ?? existingBuilding.status,
      amenities: Object.prototype.hasOwnProperty.call(input, 'amenities')
        ? (input.amenities ?? null)
        : existingBuilding.amenities,
      images: Object.prototype.hasOwnProperty.call(input, 'images')
        ? (input.images ?? null)
        : existingBuilding.images,
      updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
        ? (input.updatedBy ?? null)
        : existingBuilding.updatedBy,
    };

    const building = await updateBuildingRepository(buildingId, updatePayload);

    if (!building) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Building not found',
      });
    }

    return building;
  }

  async getById(buildingId: BuildingId): Promise<Building | null> {
    return await getBuildingByIdRepository(buildingId);
  }

  async getAll(options?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: Building['status'];
    propertyId?: Building['propertyId'];
    ownerId?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): Promise<{ items: Building[]; total: number }> {
    return await getAllBuildingsRepository(options);
  }

  async delete(buildingId: BuildingId, actorRole: string | null): Promise<Building> {
    if (actorRole !== 'superAdmin') {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Unauthorized',
      });
    }

    const building = await deleteBuildingRepository(buildingId);

    if (!building) {
      throw createResponseError({
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Building not found',
      });
    }

    return building;
  }
}

export const buildingService = new BuildingService();
