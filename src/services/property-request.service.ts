import { StatusCodes } from 'http-status-codes';

import {
  type CreatePropertyRequestInput,
  type EditPropertyRequestInput,
  type PropertyRequest,
  type PropertyRequestId,
} from '../models/property-request.model';
import {
  createPropertyRequest as createPropertyRequestRepository,
  editPropertyRequest as editPropertyRequestRepository,
  findPendingRequestForOwner,
  getAllPropertyRequests as getAllPropertyRequestsRepository,
  getPropertyRequestById as getPropertyRequestByIdRepository,
  updatePropertyRequest as updatePropertyRequestRepository,
} from '../repositories/property-request.repository';
import { countPropertiesOfOwner, getOwnerPropertyLimit } from '../repositories/property.repository';
import { createResponseError } from '../utils/app-response';

import { createProperty } from './property.service';

const createPropertyRequest = async (
  input: Omit<CreatePropertyRequestInput, 'ownerId'>,
  actorId: string | null,
  actorRole: string | null,
): Promise<PropertyRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can request an additional property',
    });
  }

  const existingPending = await findPendingRequestForOwner(actorId as never);

  if (existingPending) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: 'You already have a pending request. Please wait for it to be reviewed.',
    });
  }
  const limit = await getOwnerPropertyLimit(actorId);

  if (limit?.maxProperties !== null && limit?.maxProperties !== undefined) {
    const current = await countPropertiesOfOwner(actorId);
    if (current >= limit.maxProperties) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message: `Your plan allows ${limit.maxProperties} propert${limit.maxProperties === 1 ? 'y' : 'ies'}. Contact your administrator to upgrade.`,
      });
    }
  }
  return await createPropertyRequestRepository({ ...input, ownerId: actorId as never });
};

const reviewPropertyRequest = async (
  requestId: PropertyRequestId,
  decision: 'approved' | 'denied',
  reviewerId: string | null,
  reviewerRole: string | null,
  planId?: string,
  reason?: string,
): Promise<PropertyRequest> => {
  if (reviewerRole !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only superAdmin can review property requests',
    });
  }

  const existingRequest = await getPropertyRequestByIdRepository(requestId);

  if (!existingRequest) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
  }

  if (existingRequest.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existingRequest.status}`,
    });
  }

  if (decision === 'approved') {
    const r = existingRequest;
    if (!r.title || !r.address || !r.city || !r.state || !r.country || !r.floors) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'This request has no property details. Deny it and ask the owner to resubmit.',
      });
    }
    if (!planId) {
      throw createResponseError({
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Select a subscription plan to approve this request',
      });
    }
  }

  const updated = await updatePropertyRequestRepository(requestId, {
    status: decision,
    reviewedBy: reviewerId as never,
    reviewedAt: new Date(),
    ...(decision === 'denied' ? { rejectReason: reason ?? null } : {}),
  });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
  }

  if (decision === 'approved') {
    try {
      await createProperty(
        {
          title: updated.title,
          buildingNumber: updated.buildingNumber,
          type: updated.type ?? 'apartment',
          listingType: 'rent',
          floors: updated.floors,
          totalUnits: updated.totalUnits,
          totalArea: updated.totalArea,
          address: updated.address,
          city: updated.city,
          state: updated.state,
          country: updated.country,
          postalCode: updated.postalCode,
          ownerId: updated.ownerId,
          planId,
          status: 'active',
        } as never,
        reviewerId,
        reviewerRole,
      );
    } catch (error) {
      // property creation failed (e.g. trial already used): put the request back to pending
      await updatePropertyRequestRepository(requestId, { status: 'pending' });
      throw error;
    }

    return (
      (await updatePropertyRequestRepository(requestId, { consumedAt: new Date() })) ?? updated
    );
  }

  return updated;
};

const getAllPropertyRequests = async (options?: {
  limit?: number;
  offset?: number;
  status?: PropertyRequest['status'];
  ownerId?: string;
  sortDir?: 'asc' | 'desc';
  actorId?: string | null;
  actorRole?: string | null;
}): Promise<{ items: PropertyRequest[]; total: number }> => {
  // superAdmin sees everything (optionally filtered). An owner is hard-scoped
  // to their own requests regardless of what ownerId they pass in.
  const scopedOwnerId =
    options?.actorRole === 'superAdmin' ? options.ownerId : (options?.actorId ?? undefined);

  return await getAllPropertyRequestsRepository({
    limit: options?.limit,
    offset: options?.offset,
    status: options?.status,
    ownerId: scopedOwnerId ?? undefined,
    sortDir: options?.sortDir,
  });
};

const getPropertyRequestById = async (
  requestId: PropertyRequestId,
): Promise<PropertyRequest | null> => {
  return await getPropertyRequestByIdRepository(requestId);
};
const cancelPropertyRequest = async (
  requestId: PropertyRequestId,
  actorId: string | null,
  actorRole: string | null,
): Promise<PropertyRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can cancel a request',
    });
  }

  const existing = await getPropertyRequestByIdRepository(requestId);

  if (existing?.ownerId !== actorId) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
  }

  if (existing.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existing.status}`,
    });
  }

  const updated = await updatePropertyRequestRepository(requestId, { status: 'cancelled' });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
  }

  return updated;
};

const editPropertyRequest = async (
  requestId: PropertyRequestId,
  input: EditPropertyRequestInput,
  actorId: string | null,
  actorRole: string | null,
): Promise<PropertyRequest> => {
  if (actorRole !== 'owner' || !actorId) {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Only an owner can edit a request',
    });
  }
  const existing = await getPropertyRequestByIdRepository(requestId);
  if (existing?.ownerId !== actorId) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
  }
  if (existing.status !== 'pending') {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: `This request has already been ${existing.status}`,
    });
  }
  const updated = await editPropertyRequestRepository(requestId, input);
  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: 'This request can no longer be edited',
    });
  }
  return updated;
};

export {
  cancelPropertyRequest,
  createPropertyRequest,
  editPropertyRequest,
  getAllPropertyRequests,
  getPropertyRequestById,
  reviewPropertyRequest,
};
