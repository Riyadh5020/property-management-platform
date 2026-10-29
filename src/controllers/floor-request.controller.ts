import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import { type FloorRequestId, type FloorRequestStatus } from '../models/floor-request.model';
import {
  cancelFloorRequest as cancelFloorRequestService,
  createFloorRequest as createFloorRequestService,
  editFloorRequest as editFloorRequestService,
  getAllFloorRequests as getAllFloorRequestsService,
  reviewFloorRequest as reviewFloorRequestService,
} from '../services/floor-request.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

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

    const { limit: limitNumber, offset: offsetNumber } = parsePaging(limit, offset);

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
  async (
    req: Request<{ id: string }, unknown, { reason: string }>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await reviewFloorRequestService(
      req.params.id as FloorRequestId,
      'denied',
      actingAdminId,
      actingAdminType,
      req.body.reason,
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
const cancelFloorRequest = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await cancelFloorRequestService(
      req.params.id as FloorRequestId,
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

const editFloorRequest = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, { requestedFloorCount?: number; note?: string }>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const request = await editFloorRequestService(
      req.params.id as FloorRequestId,
      req.body,
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
export {
  approveFloorRequest,
  cancelFloorRequest,
  createFloorRequest,
  denyFloorRequest,
  editFloorRequest,
  getFloorRequests,
};
