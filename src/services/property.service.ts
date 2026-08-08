import { StatusCodes } from 'http-status-codes';

import {
  type CreatePropertyInput,
  type Property,
  type PropertyId,
  type UpdatePropertyInput,
} from '../models/properties.model';
import {
  createProperty as createPropertyRepository,
  getAllProperties as getAllPropertiesRepository,
  getPropertyById as getPropertyByIdRepository,
  updateProperty as updatePropertyRepository,
} from '../repositories/property.repository';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';

const createProperty = async (
  input: CreatePropertyInput,
  actorId: string | null,
): Promise<Property> => {
  if (input.price <= 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: ERROR_MESSAGES.property.invalidPrice,
    });
  }

  const repoInput: CreatePropertyInput = {
    ...input,
    currency: input.currency ?? 'USD',
    status: input.status ?? 'draft',
    createdBy: actorId as CreatePropertyInput['createdBy'],
    updatedBy: actorId as CreatePropertyInput['updatedBy'],
  };

  return await createPropertyRepository(repoInput);
};

const updateProperty = async (
  propertyId: PropertyId,
  input: UpdatePropertyInput,
): Promise<Property> => {
  const existingProperty = await getPropertyByIdRepository(propertyId);

  if (!existingProperty) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
  }

  if (input.price !== undefined && input.price <= 0) {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: ERROR_MESSAGES.property.invalidPrice,
    });
  }

  const updatePayload: UpdatePropertyInput = {
    title: input.title ?? existingProperty.title,
    description: Object.prototype.hasOwnProperty.call(input, 'description')
      ? (input.description ?? null)
      : existingProperty.description,
    type: input.type ?? existingProperty.type,
    listingType: input.listingType ?? existingProperty.listingType,
    price: input.price ?? existingProperty.price,
    currency: input.currency ?? existingProperty.currency,
    address: input.address ?? existingProperty.address,
    city: input.city ?? existingProperty.city,
    state: Object.prototype.hasOwnProperty.call(input, 'state')
      ? (input.state ?? null)
      : existingProperty.state,
    country: input.country ?? existingProperty.country,
    postalCode: Object.prototype.hasOwnProperty.call(input, 'postalCode')
      ? (input.postalCode ?? null)
      : existingProperty.postalCode,
    latitude: Object.prototype.hasOwnProperty.call(input, 'latitude')
      ? (input.latitude ?? null)
      : existingProperty.latitude,
    longitude: Object.prototype.hasOwnProperty.call(input, 'longitude')
      ? (input.longitude ?? null)
      : existingProperty.longitude,
    bedrooms: Object.prototype.hasOwnProperty.call(input, 'bedrooms')
      ? (input.bedrooms ?? null)
      : existingProperty.bedrooms,
    bathrooms: Object.prototype.hasOwnProperty.call(input, 'bathrooms')
      ? (input.bathrooms ?? null)
      : existingProperty.bathrooms,
    areaSize: Object.prototype.hasOwnProperty.call(input, 'areaSize')
      ? (input.areaSize ?? null)
      : existingProperty.areaSize,
    areaUnit: Object.prototype.hasOwnProperty.call(input, 'areaUnit')
      ? (input.areaUnit ?? null)
      : existingProperty.areaUnit,
    amenities: Object.prototype.hasOwnProperty.call(input, 'amenities')
      ? (input.amenities ?? null)
      : existingProperty.amenities,
    images: Object.prototype.hasOwnProperty.call(input, 'images')
      ? (input.images ?? null)
      : existingProperty.images,
    status: input.status ?? existingProperty.status,
    ownerId: Object.prototype.hasOwnProperty.call(input, 'ownerId')
      ? (input.ownerId ?? null)
      : existingProperty.ownerId,
    updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
      ? (input.updatedBy ?? null)
      : existingProperty.updatedBy,
  };

  const property = await updatePropertyRepository(propertyId, updatePayload);

  if (!property) {
    throw createResponseError({
      statusCode: StatusCodes.NOT_FOUND,
      message: ERROR_MESSAGES.property.propertyNotFound,
    });
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
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}): Promise<{ items: Property[]; total: number }> => {
  return await getAllPropertiesRepository(options);
};

export { createProperty, getAllProperties, getPropertyById, updateProperty };
