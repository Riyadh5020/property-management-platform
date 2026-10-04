export const propertyTypes = ['apartment', 'house', 'villa', 'office', 'shop', 'land'] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const propertyStatuses = ['draft', 'active', 'inactive', 'rented'] as const;
export type PropertyStatus = (typeof propertyStatuses)[number];

export const listingTypes = ['rent'] as const;
export type ListingType = (typeof listingTypes)[number];
