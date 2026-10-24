import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  getManagerProperties as getManagerPropertiesService,
  setManagerPropertiesFor,
} from '../services/manager-property.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const getManagerProperties = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const propertyIds = await getManagerPropertiesService(
      req.params.id,
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: { propertyIds },
      }),
    );
  },
);

const setManagerProperties = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, { propertyIds: string[] }>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const propertyIds = await setManagerPropertiesFor(
      req.params.id,
      req.body.propertyIds,
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: { propertyIds },
      }),
    );
  },
);

export { getManagerProperties, setManagerProperties };
