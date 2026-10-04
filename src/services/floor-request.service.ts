import { StatusCodes } from 'http-status-codes';

import { type FloorRequest, type FloorRequestId } from '../models/floor-request.model';
import {
  createFloorRequest as createFloorRequestRepository,
  findPendingRequestForProperty,
  getAllFloorRequests as getAllFloorRequestsRepository,
  getFloorRequestById as getFloorRequestByIdRepository,
  updateFloorRequest as updateFloorRequestRepository,
} from '../repositories/floor-request.repository';
import {
  createFloor as createFloorRepository,
  getMaxFloorNumber,
} from '../repositories/floor.repository';
import { createResponseError } from '../utils/app-response';

import { getPropertyById } from './property.service';

const createFloorRequest = async (
  propertyId: string,
  requestedFloorCount: number,
  note: string,
  actorId: string | null,
  actorRole: string | null,
): Promise<FloorRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can request additional floors',
    });
  }

  const property = await getPropertyById(propertyId as never);

  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property not found',
    });
  }

  if (property.ownerId !== actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'You do not own this property',
    });
  }

  if (requestedFloorCount <= 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Requested floor count must be greater than 0',
    });
  }

  const existingPending = await findPendingRequestForProperty(propertyId as never);

  if (existingPending) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message:
        'This property already has a pending floor request. Please wait for it to be reviewed.',
    });
  }

  return await createFloorRequestRepository({
    propertyId: propertyId as never,
    ownerId: actorId,
    requestedFloorCount,
    note,
  });
};

const reviewFloorRequest = async (
  requestId: FloorRequestId,
  decision: 'approved' | 'denied',
  reviewerId: string | null,
  reviewerRole: string | null,
): Promise<FloorRequest> => {
  if (reviewerRole !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only superAdmin can review floor requests',
    });
  }

  const existingRequest = await getFloorRequestByIdRepository(requestId);

  if (!existingRequest) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Floor request not found',
    });
  }

  if (existingRequest.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existingRequest.status}`,
    });
  }

  const updated = await updateFloorRequestRepository(requestId, {
    status: decision,
    reviewedBy: reviewerId as never,
    reviewedAt: new Date(),
  });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Floor request not found',
    });
  }

  // On approval, actually create the floors — same loop property.service.ts
  // uses when floors are first seeded at property creation, just continuing
  // the numbering from wherever the property currently is.
  if (decision === 'approved') {
    const currentMax = await getMaxFloorNumber(existingRequest.propertyId);

    for (
      let floorNumber = currentMax + 1;
      floorNumber <= currentMax + existingRequest.requestedFloorCount;
      floorNumber++
    ) {
      await createFloorRepository({
        propertyId: existingRequest.propertyId,
        floorNumber,
        status: 'draft',
        areaUnit: 'sqft',
        createdBy: reviewerId as never,
        updatedBy: reviewerId as never,
      });
    }

    const consumed = await updateFloorRequestRepository(requestId, {
      consumedAt: new Date(),
    });

    return consumed ?? updated;
  }

  return updated;
};

const getAllFloorRequests = async (options?: {
  limit?: number;
  offset?: number;
  status?: FloorRequest['status'];
  ownerId?: string;
  propertyId?: string;
  sortDir?: 'asc' | 'desc';
  actorId?: string | null;
  actorRole?: string | null;
}): Promise<{ items: FloorRequest[]; total: number }> => {
  // Same scoping rule as property requests: superAdmin sees everything
  // (optionally filtered), owner is hard-scoped to their own requests.
  const scopedOwnerId =
    options?.actorRole === 'superAdmin' ? options.ownerId : (options?.actorId ?? undefined);

  return await getAllFloorRequestsRepository({
    limit: options?.limit,
    offset: options?.offset,
    status: options?.status,
    ownerId: scopedOwnerId ?? undefined,
    propertyId: options?.propertyId,
    sortDir: options?.sortDir,
  });
};

const getFloorRequestById = async (requestId: FloorRequestId): Promise<FloorRequest | null> => {
  return await getFloorRequestByIdRepository(requestId);
};

export { createFloorRequest, getAllFloorRequests, getFloorRequestById, reviewFloorRequest };
