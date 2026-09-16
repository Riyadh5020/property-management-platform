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
import { createFloor as createFloorRepository } from '../repositories/floor.repository';
import { updatePropertyRequest as updatePropertyRequestRepository } from '../repositories/property-request.repository';
import {
  createProperty as createPropertyRepository,
  deleteProperty as deletePropertyRepository,
  getAllProperties as getAllPropertiesRepository,
  getPropertyById as getPropertyByIdRepository,
  updateProperty as updatePropertyRepository,
} from '../repositories/property.repository';
import { ERROR_MESSAGES } from '../shared/error-messages';
import { createResponseError } from '../utils/app-response';

import { findApprovedUnconsumedRequest } from '@/repositories/property-request.repository';

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
// stay superAdmin-only per your confirmed rule.
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

  // listingType can never change away from 'rent', even for superAdmin —
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (input.listingType !== undefined && input.listingType !== 'rent') {
    throw createResponseError({
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'listingType must be "rent"',
    });
  }

  const updatePayload: UpdatePropertyInput = {
    title: input.title ?? existingProperty.title,
    buildingNumber: Object.prototype.hasOwnProperty.call(input, 'buildingNumber')
      ? (input.buildingNumber ?? null)
      : existingProperty.buildingNumber,
    description: Object.prototype.hasOwnProperty.call(input, 'description')
      ? (input.description ?? null)
      : existingProperty.description,
    type: input.type ?? existingProperty.type,
    listingType: 'rent',
    price: input.price ?? existingProperty.price,
    currency: input.currency ?? existingProperty.currency,
    floors: Object.prototype.hasOwnProperty.call(input, 'floors')
      ? (input.floors ?? null)
      : existingProperty.floors,
    totalUnits: Object.prototype.hasOwnProperty.call(input, 'totalUnits')
      ? (input.totalUnits ?? null)
      : existingProperty.totalUnits,
    totalArea: Object.prototype.hasOwnProperty.call(input, 'totalArea')
      ? (input.totalArea ?? null)
      : existingProperty.totalArea,
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

  return property;
};

export { createProperty, deleteProperty, getAllProperties, getPropertyById, updateProperty };

// import { StatusCodes } from 'http-status-codes';
// import { type AdminId } from '../models/admin.model';
// import {
//   type CreatePropertyInput,
//   type Property,
//   type PropertyId,
//   type UpdatePropertyInput,
// } from '../models/properties.model';
// import { findAdminById } from '../repositories/admin.repository';
// import {
//   createProperty as createPropertyRepository,
//   deleteProperty as deletePropertyRepository,
//   getAllProperties as getAllPropertiesRepository,
//   getPropertyById as getPropertyByIdRepository,
//   updateProperty as updatePropertyRepository,
// } from '../repositories/property.repository';
// import { ERROR_MESSAGES } from '../shared/error-messages';
// import { createResponseError } from '../utils/app-response';

// const createProperty = async (
//   input: CreatePropertyInput,
//   actorId: string | null,
//   actorRole: string | null,
// ): Promise<Property> => {
//   if (actorRole !== 'superAdmin') {
//     throw createResponseError({
//       statusCode: StatusCodes.FORBIDDEN,
//       message: ERROR_MESSAGES.admin.unauthorized,
//     });
//   }

// const targetOwner = await findAdminById(input.ownerId as unknown as AdminId);
//   if (!targetOwner || targetOwner.role !== 'owner') {
//     throw createResponseError({
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: 'ownerId must reference an existing owner account',
//     });
//   }

//   if (input.price <= 0) {
//     throw createResponseError({
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: ERROR_MESSAGES.property.invalidPrice,
//     });
//   }

//   const repoInput: CreatePropertyInput = {
//     ...input,
//     currency: input.currency ?? 'USD',
//     status: input.status ?? 'draft',
//     createdBy: actorId as CreatePropertyInput['createdBy'],
//     updatedBy: actorId as CreatePropertyInput['updatedBy'],
//   };

//   return await createPropertyRepository(repoInput);
// };
// const OWNER_EDITABLE_FIELDS = new Set<keyof UpdatePropertyInput>([
//   'description',
//   'state',
//   'postalCode',
//   'bedrooms',
//   'bathrooms',
//   'areaSize',
//   'areaUnit',
// ]);

// const updateProperty = async (
//   propertyId: PropertyId,
//   input: UpdatePropertyInput,
//   actorId: string | null = null,
//   actorRole: string | null = null,
// ): Promise<Property> => {
//   const existingProperty = await getPropertyByIdRepository(propertyId);

//   if (!existingProperty) {
//     throw createResponseError({
//       statusCode: StatusCodes.NOT_FOUND,
//       message: ERROR_MESSAGES.property.propertyNotFound,
//     });
//   }

//   if (actorRole !== 'superAdmin') {
//     if (actorRole !== 'owner' || existingProperty.ownerId !== actorId) {
//       throw createResponseError({
//         statusCode: StatusCodes.FORBIDDEN,
//         message: ERROR_MESSAGES.admin.unauthorized,
//       });
//     }

//     // Owners may only touch a safe subset of fields — silently drop the rest,
//     // even if the client sent them (defense against a crafted request body).
//     for (const key of Object.keys(input) as Array<keyof UpdatePropertyInput>) {
//       if (key === 'updatedBy') continue;
//       if (!OWNER_EDITABLE_FIELDS.has(key)) {
//         delete input[key];
//       }
//     }
//   }

//   if (input.price !== undefined && input.price <= 0) {
//     throw createResponseError({
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: ERROR_MESSAGES.property.invalidPrice,
//     });
//   }

//   const updatePayload: UpdatePropertyInput = {
//     title: input.title ?? existingProperty.title,
//     description: Object.prototype.hasOwnProperty.call(input, 'description')
//       ? (input.description ?? null)
//       : existingProperty.description,
//     type: input.type ?? existingProperty.type,
//     listingType: input.listingType ?? existingProperty.listingType,
//     price: input.price ?? existingProperty.price,
//     currency: input.currency ?? existingProperty.currency,
//     address: input.address ?? existingProperty.address,
//     city: input.city ?? existingProperty.city,
//     state: Object.prototype.hasOwnProperty.call(input, 'state')
//       ? (input.state ?? null)
//       : existingProperty.state,
//     country: input.country ?? existingProperty.country,
//     postalCode: Object.prototype.hasOwnProperty.call(input, 'postalCode')
//       ? (input.postalCode ?? null)
//       : existingProperty.postalCode,
//     latitude: Object.prototype.hasOwnProperty.call(input, 'latitude')
//       ? (input.latitude ?? null)
//       : existingProperty.latitude,
//     longitude: Object.prototype.hasOwnProperty.call(input, 'longitude')
//       ? (input.longitude ?? null)
//       : existingProperty.longitude,
//     bedrooms: Object.prototype.hasOwnProperty.call(input, 'bedrooms')
//       ? (input.bedrooms ?? null)
//       : existingProperty.bedrooms,
//     bathrooms: Object.prototype.hasOwnProperty.call(input, 'bathrooms')
//       ? (input.bathrooms ?? null)
//       : existingProperty.bathrooms,
//     areaSize: Object.prototype.hasOwnProperty.call(input, 'areaSize')
//       ? (input.areaSize ?? null)
//       : existingProperty.areaSize,
//     areaUnit: Object.prototype.hasOwnProperty.call(input, 'areaUnit')
//       ? (input.areaUnit ?? null)
//       : existingProperty.areaUnit,
//     amenities: Object.prototype.hasOwnProperty.call(input, 'amenities')
//       ? (input.amenities ?? null)
//       : existingProperty.amenities,
//     images: Object.prototype.hasOwnProperty.call(input, 'images')
//       ? (input.images ?? null)
//       : existingProperty.images,
//     status: input.status ?? existingProperty.status,
//     ownerId: Object.prototype.hasOwnProperty.call(input, 'ownerId')
//       ? (input.ownerId ?? null)
//       : existingProperty.ownerId,
//     updatedBy: Object.prototype.hasOwnProperty.call(input, 'updatedBy')
//       ? (input.updatedBy ?? null)
//       : existingProperty.updatedBy,
//   };

//   const property = await updatePropertyRepository(propertyId, updatePayload);

//   if (!property) {
//     throw createResponseError({
//       statusCode: StatusCodes.NOT_FOUND,
//       message: ERROR_MESSAGES.property.propertyNotFound,
//     });
//   }

//   return property;
// };

// const getPropertyById = async (propertyId: PropertyId): Promise<Property | null> => {
//   return await getPropertyByIdRepository(propertyId);
// };

// const getAllProperties = async (options?: {
//   limit?: number;
//   offset?: number;
//   search?: string;
//   status?: Property['status'];
//   type?: Property['type'];
//   listingType?: Property['listingType'];
//   ownerId?: string;
//   sortBy?: string;
//   sortDir?: 'asc' | 'desc';
// }): Promise<{ items: Property[]; total: number }> => {
//   return await getAllPropertiesRepository(options);
// };

// const deleteProperty = async (
//   propertyId: PropertyId,
//   actorRole: string | null,
// ): Promise<Property> => {
//   if (actorRole !== 'superAdmin') {
//     throw createResponseError({
//       statusCode: StatusCodes.FORBIDDEN,
//       message: ERROR_MESSAGES.admin.unauthorized,
//     });
//   }

//   const property = await deletePropertyRepository(propertyId);

//   if (!property) {
//     throw createResponseError({
//       statusCode: StatusCodes.NOT_FOUND,
//       message: ERROR_MESSAGES.property.propertyNotFound,
//     });
//   }

//   return property;
// };

// export { createProperty, deleteProperty, getAllProperties, getPropertyById, updateProperty };
