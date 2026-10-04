import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type FloorRequestId, type FloorRequestStatus } from '../models/floor-request.model';
import {
  createFloorRequest as createFloorRequestService,
  getAllFloorRequests as getAllFloorRequestsService,
  reviewFloorRequest as reviewFloorRequestService,
} from '../services/floor-request.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const createFloorRequest = asyncHandler(
  async (
    req: Request<
      unknown,
      unknown,
      { propertyId: string; requestedFloorCount: number; note: string }
    >,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await createFloorRequestService(
      req.body.propertyId,
      req.body.requestedFloorCount,
      req.body.note,
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.CREATED).json(
      createSuccessResponse({
        statusCode: StatusCodes.CREATED,
        message: SUCCESS_MESSAGES.common.success,
        data: request,
      }),
    );
  },
);

const getFloorRequests = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const { limit, offset, status, ownerId, propertyId, sortDir } = req.query as unknown as {
      limit?: string;
      offset?: string;
      status?: FloorRequestStatus;
      ownerId?: string;
      propertyId?: string;
      sortDir?: string;
    };

    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const DEFAULT_LIMIT = 20;
    const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
    const offsetNumber = offset ? Number(offset) : 0;

    const { items, total } = await getAllFloorRequestsService({
      limit: limitNumber,
      offset: offsetNumber,
      status,
      ownerId,
      propertyId,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
      actorId: actingAdminId,
      actorRole: actingAdminType,
    });

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: {
          items,
          pagination: { limit: limitNumber, offset: offsetNumber, total },
        },
      }),
    );
  },
);

const approveFloorRequest = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await reviewFloorRequestService(
      req.params.id as FloorRequestId,
      'approved',
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: request,
      }),
    );
  },
);

const denyFloorRequest = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await reviewFloorRequestService(
      req.params.id as FloorRequestId,
      'denied',
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: request,
      }),
    );
  },
);

export { approveFloorRequest, createFloorRequest, denyFloorRequest, getFloorRequests };
