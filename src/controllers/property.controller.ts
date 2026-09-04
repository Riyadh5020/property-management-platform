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
  deleteProperty as deletePropertyService,
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

    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

    // superAdmin sees everything. An owner sees their own properties.
    // A manager sees the properties belonging to the owner they work for.
    const scopedOwnerId =
      actingAdminType === 'superAdmin'
        ? undefined
        : actingAdminType === 'owner'
          ? (actingAdminId ?? undefined)
          : (actingOwnerId ?? undefined);

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

    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

    // Same scoping rule as the list endpoint: superAdmin sees anything,
    // owner only their own, manager only their owner's.
    const isVisible =
      actingAdminType === 'superAdmin' ||
      (actingAdminType === 'owner' && property.ownerId === actingAdminId) ||
      (actingAdminType === 'manager' && property.ownerId === actingOwnerId);

    if (!isVisible) {
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
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const property = await createPropertyService(req.body, actingAdminId, actingAdminType);
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
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;

    const property = await updatePropertyService(
      req.params.id as PropertyId,
      {
        ...req.body,
        updatedBy: actingAdminId as unknown as UpdatePropertyInput['updatedBy'],
      },
      actingAdminId,
      actingAdminType,
    );

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: property,
      }),
    );
  },
);

const deleteProperty = asyncHandler(
  async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const property = await deletePropertyService(req.params.id as PropertyId, actingAdminType);

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: property,
      }),
    );
  },
);

export { createProperty, deleteProperty, getProperties, getPropertyById, updateProperty };
