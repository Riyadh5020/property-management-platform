import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type CreateUnitInput,
  type Unit,
  type UnitId,
  type UpdateUnitInput,
} from '../models/unit.model';
import { floorService } from '../services/floor.service';
import { getPropertyById } from '../services/property.service';
import { unitService } from '../services/unit.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

export class UnitController {
  getUnits = asyncHandler(
    async (
      req: Request<unknown, unknown, unknown, Record<string, string>>,
      res: Response,
    ): Promise<void> => {
      const { limit, offset, search, sortBy, sortDir, status, unitType, floorId } =
        req.query as unknown as {
          limit?: string;
          offset?: string;
          search?: string;
          sortBy?: string;
          sortDir?: string;
          status?: Unit['status'];
          unitType?: Unit['unitType'];
          floorId?: Unit['floorId'];
        };

      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

      const scopedOwnerId =
        actingAdminType === 'superAdmin'
          ? undefined
          : actingAdminType === 'owner'
            ? (actingAdminId ?? undefined)
            : (actingOwnerId ?? undefined);

      const DEFAULT_LIMIT = 20;
      const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
      const offsetNumber = offset ? Number(offset) : 0;

      const { items, total } = await unitService.getAll({
        limit: limitNumber,
        offset: offsetNumber,
        search,
        status,
        unitType,
        floorId,
        ownerId: scopedOwnerId,
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

  getUnitById = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const unit = await unitService.getById(id as UnitId);

    if (!unit) {
      res.status(StatusCodes.NOT_FOUND).json(
        createSuccessResponse({
          statusCode: StatusCodes.NOT_FOUND,
          message: 'Unit not found',
          data: null,
        }),
      );
      return;
    }

    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

    if (actingAdminType !== 'superAdmin') {
      const parentFloor = await floorService.getById(unit.floorId);
      const parentProperty = parentFloor ? await getPropertyById(parentFloor.propertyId) : null;
      const belongsToOwnerId = parentProperty?.ownerId ?? null;
      const isVisible =
        (actingAdminType === 'owner' && belongsToOwnerId === actingAdminId) ||
        (actingAdminType === 'manager' && belongsToOwnerId === actingOwnerId);

      if (!isVisible) {
        res.status(StatusCodes.NOT_FOUND).json(
          createSuccessResponse({
            statusCode: StatusCodes.NOT_FOUND,
            message: 'Unit not found',
            data: null,
          }),
        );
        return;
      }
    }

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: unit,
      }),
    );
  });

  createUnit = asyncHandler(
    async (req: Request<unknown, unknown, CreateUnitInput>, res: Response): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

      const unit = await unitService.create(req.body, actingAdminId, actingAdminType);

      res.status(StatusCodes.CREATED).json(
        createSuccessResponse({
          statusCode: StatusCodes.CREATED,
          message: SUCCESS_MESSAGES.common.success,
          data: unit,
        }),
      );
    },
  );

  updateUnit = asyncHandler(
    async (
      req: Request<{ id: string }, unknown, UpdateUnitInput>,
      res: Response,
    ): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

      const unit = await unitService.update(
        req.params.id as UnitId,
        {
          ...req.body,
          updatedBy: actingAdminId as unknown as UpdateUnitInput['updatedBy'],
        },
        actingAdminId,
        actingAdminType,
      );

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: unit,
        }),
      );
    },
  );

  deleteUnit = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const unit = await unitService.delete(req.params.id as UnitId, actingAdminId, actingAdminType);

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: unit,
      }),
    );
  });
}

export const unitController = new UnitController();
