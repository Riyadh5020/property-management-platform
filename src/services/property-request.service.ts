import { StatusCodes } from 'http-status-codes';

import { type PropertyRequest, type PropertyRequestId } from '../models/property-request.model';
import {
  createPropertyRequest as createPropertyRequestRepository,
  findPendingRequestForOwner,
  getAllPropertyRequests as getAllPropertyRequestsRepository,
  getPropertyRequestById as getPropertyRequestByIdRepository,
  updatePropertyRequest as updatePropertyRequestRepository,
} from '../repositories/property-request.repository';
import { createResponseError } from '../utils/app-response';

const createPropertyRequest = async (
  note: string,
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

  return await createPropertyRequestRepository({ ownerId: actorId as never, note });
};

const reviewPropertyRequest = async (
  requestId: PropertyRequestId,
  decision: 'approved' | 'denied',
  reviewerId: string | null,
  reviewerRole: string | null,
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

  const updated = await updatePropertyRequestRepository(requestId, {
    status: decision,
    reviewedBy: reviewerId as never,
    reviewedAt: new Date(),
  });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: 'Property request not found',
    });
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

export {
  createPropertyRequest,
  getAllPropertyRequests,
  getPropertyRequestById,
  reviewPropertyRequest,
};
