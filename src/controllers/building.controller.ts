import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type Building,
  type BuildingId,
  type CreateBuildingInput,
  type UpdateBuildingInput,
} from '../models/building.model';
import { buildingService } from '../services/building.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

export class BuildingController {
  getBuildings = asyncHandler(
    async (
      req: Request<unknown, unknown, unknown, Record<string, string>>,
      res: Response,
    ): Promise<void> => {
      const { limit, offset, search, sortBy, sortDir, status, propertyId } =
        req.query as unknown as {
          limit?: string;
          offset?: string;
          search?: string;
          sortBy?: string;
          sortDir?: string;
          status?: Building['status'];
          propertyId?: Building['propertyId'];
        };

      const DEFAULT_LIMIT = 20;
      const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
      const offsetNumber = offset ? Number(offset) : 0;

      const { items, total } = await buildingService.getAll({
        limit: limitNumber,
        offset: offsetNumber,
        search,
        status,
        propertyId,
        sortBy,
        sortDir: sortDir === 'asc' ? 'asc' : 'desc',
      });

      const currentPageNumber = Math.floor(offsetNumber / limitNumber) + 1;

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: {
            items,
            pagination: {
              limit: limitNumber,
              offset: offsetNumber,
              total,
              currentPageNumber,
              sortBy: sortBy ?? 'createdAt',
              sortDir: sortDir === 'asc' ? 'asc' : 'desc',
            },
          },
        }),
      );
    },
  );

  getBuildingById = asyncHandler(
    async (req: Request<{ id: string }>, res: Response): Promise<void> => {
      const { id } = req.params;
      const building = await buildingService.getById(id as BuildingId);

      if (!building) {
        res.status(StatusCodes.NOT_FOUND).json(
          createSuccessResponse({
            statusCode: StatusCodes.NOT_FOUND,
            message: 'Building not found',
            data: null,
          }),
        );
        return;
      }

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: building,
        }),
      );
    },
  );

  createBuilding = asyncHandler(
    async (req: Request<unknown, unknown, CreateBuildingInput>, res: Response): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const building = await buildingService.create(req.body, actingAdminId);

      res.status(StatusCodes.CREATED).json(
        createSuccessResponse({
          statusCode: StatusCodes.CREATED,
          message: SUCCESS_MESSAGES.common.success,
          data: building,
        }),
      );
    },
  );

  updateBuilding = asyncHandler(
    async (
      req: Request<{ id: string }, unknown, UpdateBuildingInput>,
      res: Response,
    ): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const building = await buildingService.update(req.params.id as BuildingId, {
        ...req.body,
        updatedBy: actingAdminId as unknown as UpdateBuildingInput['updatedBy'],
      });

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: building,
        }),
      );
    },
  );
}

export const buildingController = new BuildingController();
