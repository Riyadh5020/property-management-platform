export const adminRoles = ['superAdmin', 'owner', 'manager'] as const;
export type AdminRole = (typeof adminRoles)[number];

export const adminStatuses = ['active', 'inactive', 'suspended', 'pending'] as const;
export type AdminStatus = (typeof adminStatuses)[number];
