import { type FlatStatusRow } from '../repositories/flat-status.repository';

type RestrictableField = 'tenantName' | 'leaseEnd' | 'overdueInvoices' | 'openMaintenance';

// Manager permission that unlocks each field, matching the tenant/lease/invoice/maintenance services.
const FIELD_PERMISSION: Record<RestrictableField, 'tenants' | 'rent' | 'maintenance'> = {
  tenantName: 'tenants',
  leaseEnd: 'rent',
  overdueInvoices: 'rent',
  openMaintenance: 'maintenance',
};

const RESTRICTABLE_FIELDS = Object.keys(FIELD_PERMISSION) as RestrictableField[];

type VisibleFlatStatusRow = Omit<FlatStatusRow, RestrictableField> & {
  tenantName: string | null;
  leaseEnd: string | null;
  overdueInvoices: number | null;
  openMaintenance: number | null;
};

// superAdmin and owner see everything; a manager only sees fields their permissions allow.
const getRestrictedFlatFields = (
  role: string,
  permissions: Record<string, boolean> | null | undefined,
): RestrictableField[] => {
  if (role !== 'manager') {
    return [];
  }
  return RESTRICTABLE_FIELDS.filter((field) => permissions?.[FIELD_PERMISSION[field]] !== true);
};

// Restricted fields are returned as null; callers also send the list so null can't be mistaken for "none".
const maskFlatStatusRows = (
  rows: FlatStatusRow[],
  restricted: RestrictableField[],
): VisibleFlatStatusRow[] => {
  if (restricted.length === 0) {
    return rows;
  }
  return rows.map((row) => {
    const visible: VisibleFlatStatusRow = { ...row };
    for (const field of restricted) {
      visible[field] = null;
    }
    return visible;
  });
};

export { getRestrictedFlatFields, maskFlatStatusRows };
export type { RestrictableField, VisibleFlatStatusRow };
