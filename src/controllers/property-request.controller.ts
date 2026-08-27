import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type PropertyRequestId,
  type PropertyRequestStatus,
} from '../models/property-request.model';
import {
  createPropertyRequest as createPropertyRequestService,
  getAllPropertyRequests as getAllPropertyRequestsService,
  reviewPropertyRequest as reviewPropertyRequestService,
} from '../services/property-request.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const createPropertyRequest = asyncHandler(
  async (req: Request<unknown, unknown, { note: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await createPropertyRequestService(
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

const getPropertyRequests = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const { limit, offset, status, ownerId, sortDir } = req.query as unknown as {
      limit?: string;
      offset?: string;
      status?: PropertyRequestStatus;
      ownerId?: string;
      sortDir?: string;
    };

    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const DEFAULT_LIMIT = 20;
    const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
    const offsetNumber = offset ? Number(offset) : 0;

    const { items, total } = await getAllPropertyRequestsService({
      limit: limitNumber,
      offset: offsetNumber,
      status,
      ownerId,
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

const approvePropertyRequest = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await reviewPropertyRequestService(
      req.params.id as PropertyRequestId,
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

const denyPropertyRequest = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const request = await reviewPropertyRequestService(
      req.params.id as PropertyRequestId,
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

export { approvePropertyRequest, createPropertyRequest, denyPropertyRequest, getPropertyRequests };
