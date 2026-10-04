import { StatusCodes } from 'http-status-codes';

import { type AdminId } from '../models/admin.model';
import {
  type CreatePropertyInput,
  type Property,
  type PropertyId,
  type UpdatePropertyInput,
} from '../models/properties.model';
import { type PropertyRequestId } from '../models/property-request.model';
import { findAdminById } from '../repositories/admin.repository';
import {
  createFloor as createFloorRepository,
  getMaxFloorNumber,
} from '../repositories/floor.repository';
import {
  findApprovedUnconsumedRequest,
  updatePropertyRequest as updatePropertyRequestRepository,
} from '../repositories/property-request.repository';
import {
  createProperty as createPropertyRepository,
  deleteProperty as deletePropertyRepository,
  getAllProperties as getAllPropertiesRepository,
  getPropertyById as getPropertyByIdRepository,
  ownerHasUsedTrial,
  setPropertySubscription,
  softDeleteChildrenOfProperty,
  updateProperty as updatePropertyRepository,
} from '../repositories/property.repository';
import { getSubscriptionPlanById } from '../repositories/subscription-plan.repository';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';

const DAY_MS = 24 * 60 * 60 * 1000;

const createProperty = async (
  input: CreatePropertyInput,
  actorId: string | null,
  actorRole: string | null,
): Promise<Property> => {
  if (actorRole !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.unauthorized,
    });
  }

  const targetOwner = await findAdminById(input.ownerId as unknown as AdminId);

  if (targetOwner?.role !== 'owner') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'ownerId must reference an existing owner account',
    });
  }

  // One property per owner, unless they have an approved, unconsumed request.
  const { total: existingPropertyCount } = await getAllPropertiesRepository({
    ownerId: input.ownerId as unknown as string,
    limit: 1,
  });

  let consumedRequestId: string | null = null;

  if (existingPropertyCount >= 1) {
    const approvedRequest = await findApprovedUnconsumedRequest(
      input.ownerId as unknown as AdminId,
    );

    if (!approvedRequest) {
      throw createResponseError({
        statusCode: StatusCodes.CONFLICT,
        message:
          'This owner already has a property. An additional property requires an approved request.',
      });
    }

    consumedRequestId = approvedRequest.id;
  }

  // ── Subscription plan ──
  if (!input.planId) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'A subscription plan is required',
    });
  }

  const plan = await getSubscriptionPlanById(input.planId);

  if (plan?.status !== 'active') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'The selected subscription plan is not available',
    });
  }

  if (
    plan.billingCycle === 'trial' &&
    (await ownerHasUsedTrial(input.ownerId as unknown as string))
  ) {
    throw createResponseError({
      statusCode: StatusCodes.CONFLICT,
      message: 'This owner has already used the free demo. Please choose a paid plan.',
    });
  }

  const subscriptionStartsAt = new Date();
  const subscriptionEndsAt = new Date(subscriptionStartsAt.getTime() + plan.durationDays * DAY_MS);

  const repoInput: CreatePropertyInput = {
    ...input,
    price: plan.amount,
    planId: plan.id,
    subscriptionStartsAt,
    subscriptionEndsAt,
    subscriptionStatus: plan.billingCycle === 'trial' ? 'trial' : 'active',
    currency: input.currency ?? 'USD',
    status: 'active',
    listingType: 'rent', // forced server-side — client input is ignored
    createdBy: actorId as CreatePropertyInput['createdBy'],
    updatedBy: actorId as CreatePropertyInput['updatedBy'],
  };

  const property = await createPropertyRepository(repoInput);

  if (repoInput.floors && repoInput.floors > 0) {
    for (let floorNumber = 1; floorNumber <= repoInput.floors; floorNumber++) {
      await createFloorRepository({
        propertyId: property.id,
        floorNumber,
        status: 'draft',
        areaUnit: 'sqft',
        createdBy: actorId as never,
        updatedBy: actorId as never,
      });
    }
  }

  if (consumedRequestId) {
    await updatePropertyRequestRepository(consumedRequestId as unknown as PropertyRequestId, {
      consumedAt: new Date(),
    });
  }

  return property;
};

// Owners may only touch a narrow subset of fields on their own property.
// Structural fields (floors, totalUnits, totalArea, price, ownerId, etc.)
// stay superAdmin-only.
const OWNER_EDITABLE_FIELDS = new Set<keyof UpdatePropertyInput>([
  'description',
  'state',
  'postalCode',
]);

const updateProperty = async (
  propertyId: PropertyId,
  input: UpdatePropertyInput,
  actorId: string | null = null,
  actorRole: string | null = null,
): Promise<Property> => {
  const existingProperty = await getPropertyByIdRepository(propertyId);

  if (!existingProperty) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }

  if (actorRole !== 'superAdmin') {
    if (actorRole !== 'owner' || existingProperty.ownerId !== actorId) {
      throw createResponseError({
        statusCode: StatusCodes.FORBIDDEN,
        message: ERROR_MESSAGES.admin.unauthorized,
      });
    }

    const strippedInput: UpdatePropertyInput = {};
    for (const key of Object.keys(input) as (keyof UpdatePropertyInput)[]) {
      if (key === 'updatedBy' || OWNER_EDITABLE_FIELDS.has(key)) {
        (strippedInput as Record<string, unknown>)[key] = input[key];
      }
    }
    input = strippedInput;
  }

  if (input.price !== undefined && input.price <= 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: ERROR_MESSAGES.property.invalidPrice,
    });
  }

  // listingType can never change away from 'rent', even for superAdmin
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (input.listingType !== undefined && input.listingType !== 'rent') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'listingType must be "rent"',
    });
  }

  const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(input, key);
  const updatePayload: UpdatePropertyInput = {
    title: input.title ?? existingProperty.title,
    buildingNumber: has('buildingNumber')
      ? (input.buildingNumber ?? null)
      : existingProperty.buildingNumber,
    description: has('description') ? (input.description ?? null) : existingProperty.description,
    type: input.type ?? existingProperty.type,
    listingType: 'rent',
    price: input.price ?? existingProperty.price,
    currency: input.currency ?? existingProperty.currency,
    floors: has('floors') ? (input.floors ?? null) : existingProperty.floors,
    totalUnits: has('totalUnits') ? (input.totalUnits ?? null) : existingProperty.totalUnits,
    totalArea: has('totalArea') ? (input.totalArea ?? null) : existingProperty.totalArea,
    address: input.address ?? existingProperty.address,
    city: input.city ?? existingProperty.city,
    state: has('state') ? (input.state ?? null) : existingProperty.state,
    country: input.country ?? existingProperty.country,
    postalCode: has('postalCode') ? (input.postalCode ?? null) : existingProperty.postalCode,
    latitude: has('latitude') ? (input.latitude ?? null) : existingProperty.latitude,
    longitude: has('longitude') ? (input.longitude ?? null) : existingProperty.longitude,
    amenities: has('amenities') ? (input.amenities ?? null) : existingProperty.amenities,
    images: has('images') ? (input.images ?? null) : existingProperty.images,
    status: input.status ?? existingProperty.status,
    ownerId: has('ownerId') ? (input.ownerId ?? null) : existingProperty.ownerId,
    updatedBy: has('updatedBy') ? (input.updatedBy ?? null) : existingProperty.updatedBy,
  };

  const property = await updatePropertyRepository(propertyId, updatePayload);

  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }

  if (actorRole === 'superAdmin' && input.floors && input.floors > 0) {
    const current = await getMaxFloorNumber(propertyId);

    for (let n = current + 1; n <= input.floors; n++) {
      await createFloorRepository({
        propertyId,
        floorNumber: n,
        status: 'draft',
        areaUnit: 'sqft',
        createdBy: actorId as never,
        updatedBy: actorId as never,
      });
    }
  }
  return property;
};

const getPropertyById = async (propertyId: PropertyId): Promise<Property | null> => {
  return await getPropertyByIdRepository(propertyId);
};

const getAllProperties = async (options?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: Property['status'];
  type?: Property['type'];
  listingType?: Property['listingType'];
  ownerId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Property[]; total: number }> => {
  return await getAllPropertiesRepository(options);
};

const deleteProperty = async (
  propertyId: PropertyId,
  actorRole: string | null,
): Promise<Property> => {
  if (actorRole !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.unauthorized,
    });
  }

  const property = await deletePropertyRepository(propertyId);

  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }

  await softDeleteChildrenOfProperty(propertyId);

  return property;
};
const setSubscription = async (
  propertyId: PropertyId,
  planId: string,
  actorId: string | null,
  actorRole: string | null,
): Promise<Property> => {
  if (actorRole !== 'superAdmin') {
    throw createResponseError({
      statusCode: StatusCodes.FORBIDDEN,
      message: ERROR_MESSAGES.admin.unauthorized,
    });
  }
  const property = await getPropertyByIdRepository(propertyId);
  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }
  const plan = await getSubscriptionPlanById(planId as never);
  if (plan?.status !== 'active') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'The selected subscription plan is not available',
    });
  }
  if (plan.billingCycle === 'trial') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'A free demo cannot be assigned to an existing property',
    });
  }

  const currentEnd = property.subscriptionEndsAt ? new Date(property.subscriptionEndsAt) : null;
  const extend = property.planId === plan.id && currentEnd !== null && currentEnd > new Date();
  const startsAt = extend ? new Date(property.subscriptionStartsAt ?? Date.now()) : new Date();
  const base = currentEnd !== null && extend ? currentEnd : startsAt;
  const endsAt = new Date(base.getTime() + plan.durationDays * DAY_MS);

  const updated = await setPropertySubscription(propertyId, {
    planId: plan.id,
    startsAt,
    endsAt,
    status: 'active',
    price: plan.amount,
    updatedBy: actorId,
  });

  if (!updated) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }

  return updated;
};

export {
  createProperty,
  deleteProperty,
  getAllProperties,
  getPropertyById,
  setSubscription,
  updateProperty,
};
