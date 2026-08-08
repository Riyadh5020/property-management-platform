import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type CreatePropertyInput,
  type Property,
  type PropertyId,
  type UpdatePropertyInput,
} from '../models/properties.model';
import {
  createProperty as createPropertyService,
  getAllProperties as getAllPropertiesService,
  getPropertyById as getPropertyByIdService,
  updateProperty as updatePropertyService,
} from '../services/property.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';

const getProperties = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const { limit, offset, search, sortBy, sortDir, status, type, listingType } =
      req.query as unknown as {
        limit?: string;
        offset?: string;
        search?: string;
        sortBy?: string;
        sortDir?: string;
        status?: Property['status'];
        type?: Property['type'];
        listingType?: Property['listingType'];
      };

    const DEFAULT_LIMIT = 20;
    const limitNumber = limit ? Number(limit) : DEFAULT_LIMIT;
    const offsetNumber = offset ? Number(offset) : 0;

    const { items, total } = await getAllPropertiesService({
      limit: limitNumber,
      offset: offsetNumber,
      search,
      status,
      type,
      listingType,
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

const getPropertyById = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const property = await getPropertyByIdService(id as PropertyId);

    if (!property) {
      res.status(StatusCodes.NOT_FOUND).json(
        createSuccessResponse({
          statusCode: StatusCodes.NOT_FOUND,
          message: 'Property not found',
          data: null,
        }),
      );
      return;
    }

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: property,
      }),
    );
  },
);

const createProperty = asyncHandler(
  async (req: Request<unknown, unknown, CreatePropertyInput>, res: Response): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const property = await createPropertyService(req.body, actingAdminId);

    res.status(StatusCodes.CREATED).json(
      createSuccessResponse({
        statusCode: StatusCodes.CREATED,
        message: SUCCESS_MESSAGES.common.success,
        data: property,
      }),
    );
  },
);

const updateProperty = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, UpdatePropertyInput>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const property = await updatePropertyService(req.params.id as PropertyId, {
      ...req.body,
      updatedBy: actingAdminId as unknown as UpdatePropertyInput['updatedBy'],
    });

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: property,
      }),
    );
  },
);

export { createProperty, getProperties, getPropertyById, updateProperty };
