import { type Request, type Response } from 'express';
import { StatusCodes } from 'http-status-codes';

import {
  type CreatePropertyInput,
  type Property,
  type PropertyId,
  type UpdatePropertyInput,
} from '../models/properties.model';
import { listPropertyIdsForManager } from '../repositories/manager-property.repository';
import { getSubscriptionHistory } from '../repositories/subscription-history.repository';
import {
  adjustSubscription as adjustSubscriptionService,
  createProperty as createPropertyService,
  deleteProperty as deletePropertyService,
  getAllProperties as getAllPropertiesService,
  getPropertyById as getPropertyByIdService,
  setSubscription as setSubscriptionService,
  updateProperty as updatePropertyService,
} from '../services/property.service';
import { SUCCESS_MESSAGES } from '../shared/success-messages';
import { createSuccessResponse } from '../utils/app-response';
import { asyncHandler } from '../utils/async-handler';
import { parsePaging } from '../utils/paging';

const stripBusinessInfo = <T extends object>(property: T): T => {
  const {
    price: _price,
    planId: _planId,
    planName: _planName,
    subscriptionStartsAt: _subscriptionStartsAt,
    subscriptionEndsAt: _subscriptionEndsAt,
    subscriptionStatus: _subscriptionStatus,
    ...rest
  } = property as Record<string, unknown>;
  return rest as T;
};

const getProperties = asyncHandler(
  async (
    req: Request<unknown, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const {
      limit,
      offset,
      search,
      sortBy,
      sortDir,
      status,
      type,
      listingType,
      ownerId,
      subscription,
    } = req.query as unknown as {
      subscription?: string;
      limit?: string;
      offset?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
      status?: Property['status'];
      type?: Property['type'];
      listingType?: Property['listingType'];
      ownerId?: string;
    };

    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingOwnerId = (req as unknown as { ownerId?: string | null }).ownerId ?? null;

    // superAdmin sees everything. An owner sees their own properties.
    // A manager sees the properties belonging to the owner they work for.
    const scopedOwnerId =
      actingAdminType === 'superAdmin'
        ? (ownerId ?? undefined)
        : actingAdminType === 'owner'
          ? (actingAdminId ?? undefined)
          : (actingOwnerId ?? undefined);

    const { limit: limitNumber, offset: offsetNumber } = parsePaging(limit, offset);

    const assignedIds =
      actingAdminType === 'manager' && actingAdminId
        ? await listPropertyIdsForManager(actingAdminId)
        : undefined;

    const { items, total } = await getAllPropertiesService({
      limit: limitNumber,
      offset: offsetNumber,
      search,
      status,
      type,
      listingType,
      ownerId: scopedOwnerId,
      propertyIds: assignedIds,
      ...(subscription === 'expiring' || subscription === 'expired' ? { subscription } : {}),
      sortBy,
      sortDir: sortDir === 'asc' ? 'asc' : 'desc',
    });

    const currentPageNumber = Math.floor(offsetNumber / limitNumber) + 1;

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: {
          items: actingAdminType === 'manager' ? items.map((p) => stripBusinessInfo(p)) : items,
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
    const assignedIds =
      actingAdminType === 'manager' && actingAdminId
        ? await listPropertyIdsForManager(actingAdminId)
        : [];

    const isVisible =
      actingAdminType === 'superAdmin' ||
      (actingAdminType === 'owner' && property.ownerId === actingAdminId) ||
      (actingAdminType === 'manager' &&
        property.ownerId === actingOwnerId &&
        assignedIds.includes(property.id));

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
        data: actingAdminType === 'manager' ? stripBusinessInfo(property) : property,
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

const updatePropertySubscription = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, { planId: string }>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const property = await setSubscriptionService(
      req.params.id as PropertyId,
      req.body.planId,
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
const getPropertySubscriptionHistory = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, unknown, Record<string, string>>,
    res: Response,
  ): Promise<void> => {
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;

    const property = await getPropertyByIdService(req.params.id as PropertyId);

    // superAdmin sees all; an owner sees only their own property. Managers never.
    const allowed =
      !!property &&
      (actingAdminType === 'superAdmin' ||
        (actingAdminType === 'owner' && property.ownerId === actingAdminId));

    if (!allowed) {
      res.status(StatusCodes.NOT_FOUND).json(
        createSuccessResponse({
          statusCode: StatusCodes.NOT_FOUND,
          message: 'Property not found',
          data: null,
        }),
      );
      return;
    }

    const { limit: limitNumber, offset: offsetNumber } = parsePaging(
      req.query.limit,
      req.query.offset,
    );

    const { items, total } = await getSubscriptionHistory({
      propertyId: req.params.id,
      limit: limitNumber,
      offset: offsetNumber,
    });

    res.status(StatusCodes.OK).json(
      createSuccessResponse({
        statusCode: StatusCodes.OK,
        message: SUCCESS_MESSAGES.common.success,
        data: { items, pagination: { limit: limitNumber, offset: offsetNumber, total } },
      }),
    );
  },
);

const adjustPropertySubscription = asyncHandler(
  async (
    req: Request<{ id: string }, unknown, Parameters<typeof adjustSubscriptionService>[1]>,
    res: Response,
  ): Promise<void> => {
    const actingAdminId = (req as unknown as { id?: string }).id ?? null;
    const actingAdminType = (req as unknown as { adminType?: string }).adminType ?? null;
    const property = await adjustSubscriptionService(
      req.params.id as PropertyId,
      req.body,
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

export {
  adjustPropertySubscription,
  createProperty,
  deleteProperty,
  getProperties,
  getPropertyById,
  getPropertySubscriptionHistory,
  updateProperty,
  updatePropertySubscription,
};
