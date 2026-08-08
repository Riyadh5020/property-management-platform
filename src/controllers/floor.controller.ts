import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type CreateFloorInput,
  type Floor,
  type FloorId,
  type UpdateFloorInput,
} from '../models/floor.model';
import { floorService } from '../services/floor.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

export class FloorController {
  getFloors = asyncHandler(
    async (
      req: Request<unknown, unknown, unknown, Record<string, string>>,
      res: Response,
    ): Promise<void> => {
      const { limit, offset, search, sortBy, sortDir, status, buildingId } =
        req.query as unknown as {
          limit?: string;
          offset?: string;
          search?: string;
          sortBy?: string;
          sortDir?: string;
          status?: Floor['status'];
          buildingId?: Floor['buildingId'];
        };

      const DEFAULT_LIMIT = 20;
      const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
      const offsetNumber = offset ? Number(offset) : 0;

      const { items, total } = await floorService.getAll({
        limit: limitNumber,
        offset: offsetNumber,
        search,
        status,
        buildingId,
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

  getFloorById = asyncHandler(
    async (req: Request<{ id: string }>, res: Response): Promise<void> => {
      const { id } = req.params;
      const floor = await floorService.getById(id as FloorId);

      if (!floor) {
        res.status(StatusCodes.NOT_FOUND).json(
          createSuccessResponse({
            statusCode: StatusCodes.NOT_FOUND,
            message: 'Floor not found',
            data: null,
          }),
        );
        return;
      }

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: floor,
        }),
      );
    },
  );

  createFloor = asyncHandler(
    async (req: Request<unknown, unknown, CreateFloorInput>, res: Response): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const floor = await floorService.create(req.body, actingAdminId);

      res.status(StatusCodes.CREATED).json(
        createSuccessResponse({
          statusCode: StatusCodes.CREATED,
          message: SUCCESS_MESSAGES.common.success,
          data: floor,
        }),
      );
    },
  );

  updateFloor = asyncHandler(
    async (
      req: Request<{ id: string }, unknown, UpdateFloorInput>,
      res: Response,
    ): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const floor = await floorService.update(req.params.id as FloorId, {
        ...req.body,
        updatedBy: actingAdminId as unknown as UpdateFloorInput['updatedBy'],
      });

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: floor,
        }),
      );
    },
  );
}

export const floorController = new FloorController();
