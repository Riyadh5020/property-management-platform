import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type CreateFloorInput,
  type Floor,
  type FloorId,
  type UpdateFloorInput,
} from '../models/floor.model';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { floorService } from '../services/floor.service';
import { getPropertyById } from '../services/property.service';
import { unitService } from '../services/unit.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

export class FloorController {
  getFloors = asyncHandler(
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
          status?: Floor['status'];
          propertyId?: Floor['propertyId'];
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

      const { limit: limitNumber, offset: offsetNumber } = parsePaging(limit, offset);
      const assignedIds =
        actingAdminType === 'manager' && actingAdminId
          ? await listPropertyIdsForManager(actingAdminId)
          : undefined;
      const { items, total } = await floorService.getAll({
        limit: limitNumber,
        offset: offsetNumber,
        search,
        status,
        propertyId,
        ownerId: scopedOwnerId,
        propertyIds: assignedIds,
        sortBy: sortBy ?? 'floorNumber',
        sortDir: sortDir === 'desc' ? 'desc' : 'asc',
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
              sortBy: sortBy ?? 'floorNumber',
              sortDir: sortDir === 'desc' ? 'desc' : 'asc',
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

      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

      if (actingAdminType !== 'superAdmin') {
        // Only one hop now: Floor -> Property directly.
        const parentProperty = await getPropertyById(floor.propertyId);
        const belongsToOwnerId = parentProperty?.ownerId ?? null;

        const assignedIds =
          actingAdminType === 'manager' && actingAdminId
            ? await listPropertyIdsForManager(actingAdminId)
            : [];

        const isVisible =
          (actingAdminType === 'owner' && belongsToOwnerId === actingAdminId) ||
          (actingAdminType === 'manager' &&
            belongsToOwnerId === actingOwnerId &&
            assignedIds.includes(floor.propertyId));

        if (!isVisible) {
          res.status(StatusCodes.NOT_FOUND).json(
            createSuccessResponse({
              statusCode: StatusCodes.NOT_FOUND,
              message: 'Floor not found',
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
          data: floor,
        }),
      );
    },
  );

  createFloor = asyncHandler(
    async (req: Request<unknown, unknown, CreateFloorInput>, res: Response): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
      const floor = await floorService.create(req.body, actingAdminId, actingAdminType);
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
      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

      const floor = await floorService.update(
        req.params.id as FloorId,
        {
          ...req.body,
          updatedBy: actingAdminId as unknown as UpdateFloorInput['updatedBy'],
        },
        actingAdminId,
        actingAdminType,
      );

      res.status(StatusCodes.OK).json(
        createSuccessResponse({
          statusCode: StatusCodes.OK,
          message: SUCCESS_MESSAGES.common.success,
          data: floor,
        }),
      );
    },
  );

  copyLayout = asyncHandler(
    async (
      req: Request<{ id: string }, unknown, { sourceFloorId: string }>,
      res: Response,
    ): Promise<void> => {
      const actingAdminId = (req as unknown as { id?: string }).id ?? null;
      const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

      const result = await unitService.copyLayout(
        req.params.id,
        req.body.sourceFloorId,
        actingAdminId,
        actingAdminType,
      );

      res.status(StatusCodes.CREATED).json(
        createSuccessResponse({
          statusCode: StatusCodes.CREATED,
          message: SUCCESS_MESSAGES.common.success,
          data: { items: result.created, areaWarning: result.areaWarning },
        }),
      );
    },
  );

  deleteFloor = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const floor = await floorService.delete(
      req.params.id as FloorId,
      actingAdminType,
      (req as unknown as { id?: string }).id ?? null,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: floor,
      }),
    );
  });
}

export const floorController = new FloorController();
