import { StatusCodes } from 'http-status-codes';

import {
  type EditFloorRequestInput,
  type FloorRequest,
  type FloorRequestId,
} from '../models/floor-request.model';
import {
  createFloorRequest as createFloorRequestRepository,
  editFloorRequest as editFloorRequestRepository,
  findPendingRequestForProperty,
  getAllFloorRequests as getAllFloorRequestsRepository,
  getFloorRequestById as getFloorRequestByIdRepository,
  updateFloorRequest as updateFloorRequestRepository,
} from '../repositories/floor-request.repository';
import {
  createFloor as createFloorRepository,
  getMaxFloorNumber,
} from '../repositories/floor.repository';
import { syncPropertyFloorCount } from '../repositories/property.repository';
import { getSubscriptionPlanById } from '../repositories/subscription-plan.repository';
import { createResponseError } from '../utils/app-response';

import { getPropertyById } from './property.service';

const getPlanMaxFloors = async (planId: string): Promise<number | null> => {
  const plan = await getSubscriptionPlanById(planId as never);
  return plan?.maxFloors ?? null;
};
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
  const maxFloors = property.planId ? await getPlanMaxFloors(property.planId) : null;

  if (maxFloors !== null) {
    const currentMax = await getMaxFloorNumber(propertyId);
    if (currentMax + requestedFloorCount > maxFloors) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `Your plan allows ${maxFloors} floors per property. Contact your administrator to upgrade.`,
      });
    }
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
  reason?: string,
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
    ...(decision === 'denied' ? { rejectReason: reason ?? null } : {}),
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
    const approvedProperty = await getPropertyById(existingRequest.propertyId);
    const maxFloors = approvedProperty?.planId
      ? await getPlanMaxFloors(approvedProperty.planId)
      : null;

    if (maxFloors !== null && currentMax + existingRequest.requestedFloorCount > maxFloors) {
      await updateFloorRequestRepository(requestId, { status: 'pending' });
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `This property's plan allows ${maxFloors} floors. Upgrade the plan before approving.`,
      });
    }
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
    await syncPropertyFloorCount(existingRequest.propertyId);
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
const cancelFloorRequest = async (
  requestId: FloorRequestId,
  actorId: string | null,
  actorRole: string | null,
): Promise<FloorRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can cancel a request',
    });
  }

  const existing = await getFloorRequestByIdRepository(requestId);

  if (existing?.ownerId !== actorId) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Floor request not found',
    });
  }

  if (existing.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existing.status}`,
    });
  }

  const updated = await updateFloorRequestRepository(requestId, { status: 'cancelled' });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Floor request not found',
    });
  }

  return updated;
};

const editFloorRequest = async (
  requestId: FloorRequestId,
  input: EditFloorRequestInput,
  actorId: string | null,
  actorRole: string | null,
): Promise<FloorRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can edit a request',
    });
  }

  const existing = await getFloorRequestByIdRepository(requestId);

  if (existing?.ownerId !== actorId) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Floor request not found',
    });
  }

  if (existing.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existing.status}`,
    });
  }

  if (input.requestedFloorCount !== undefined) {
    const property = await getPropertyById(existing.propertyId);
    const maxFloors = property?.planId ? await getPlanMaxFloors(property.planId) : null;
    if (maxFloors !== null) {
      const currentMax = await getMaxFloorNumber(existing.propertyId);
      if (currentMax + input.requestedFloorCount > maxFloors) {
        throw createResponseError({
          statusCode: StatusCodes.CONFLICT,
          message: `Your plan allows ${maxFloors} floors per property. Contact your administrator to upgrade.`,
        });
      }
    }
  }

  const updated = await editFloorRequestRepository(requestId, input);
  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: 'This request can no longer be edited',
    });
  }
  return updated;
};
export {
  cancelFloorRequest,
  createFloorRequest,
  editFloorRequest,
  getAllFloorRequests,
  getFloorRequestById,
  reviewFloorRequest,
};
