import { query } from '../config/database';
import {
  TENANT_TABLE_NAME,
  type CreateTenantInput,
  type Tenant,
  type UpdateTenantInput,
} from '../models/tenant.model';

const createTenant = async (input: CreateTenantInput): Promise<Tenant> => {
  const result = await query<Tenant>(
    `INSERT INTO ${TENANT_TABLE_NAME}
      ("propertyId", "unitId", "fullName", phone, email, "idDocType", "idDocNumber",
       role, "moveInDate", "moveOutDate", status, "createdBy", "updatedBy",
       occupation, "permanentAddress", "emergencyContactName", "emergencyContactPhone",
       "familyMembers", notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *;`,
    [
      input.propertyId,
      input.unitId ?? null,
      input.fullName,
      input.phone ?? null,
      input.email ?? null,
      input.idDocType ?? null,
      input.idDocNumber ?? null,
      input.role ?? 'primary',
      input.moveInDate ?? null,
      input.moveOutDate ?? null,
      input.status ?? 'active',
      input.createdBy ?? null,
      input.updatedBy ?? null,
      input.occupation ?? null,
      input.permanentAddress ?? null,
      input.emergencyContactName ?? null,
      input.emergencyContactPhone ?? null,
      input.familyMembers ?? null,
      input.notes ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Failed to create tenant');
  }
  return row;
};

const getTenantById = async (id: string): Promise<Tenant | null> => {
  const result = await query<Tenant>(
    `SELECT * FROM ${TENANT_TABLE_NAME} WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1;`,
    [id],
  );
  return result.rows[0] ?? null;
};

const updateTenant = async (id: string, input: UpdateTenantInput): Promise<Tenant | null> => {
  const has = (k: keyof UpdateTenantInput): boolean =>
    Object.prototype.hasOwnProperty.call(input, k);
  const result = await query<Tenant>(
    `UPDATE ${TENANT_TABLE_NAME} SET
       "unitId" = CASE WHEN $2::boolean THEN $3::uuid ELSE "unitId" END,
       "fullName" = COALESCE($4, "fullName"),
       phone = CASE WHEN $5::boolean THEN $6 ELSE phone END,
       email = CASE WHEN $7::boolean THEN $8 ELSE email END,
       "idDocType" = CASE WHEN $9::boolean THEN $10 ELSE "idDocType" END,
       "idDocNumber" = CASE WHEN $11::boolean THEN $12 ELSE "idDocNumber" END,
       role = COALESCE($13, role),
       "moveInDate" = CASE WHEN $14::boolean THEN $15::date ELSE "moveInDate" END,
       "moveOutDate" = CASE WHEN $16::boolean THEN $17::date ELSE "moveOutDate" END,
       status = COALESCE($18, status),
       occupation = CASE WHEN $20::boolean THEN $21 ELSE occupation END,
       "permanentAddress" = CASE WHEN $22::boolean THEN $23 ELSE "permanentAddress" END,
       "emergencyContactName" = CASE WHEN $24::boolean THEN $25 ELSE "emergencyContactName" END,
       "emergencyContactPhone" = CASE WHEN $26::boolean THEN $27 ELSE "emergencyContactPhone" END,
       "familyMembers" = CASE WHEN $28::boolean THEN $29::integer ELSE "familyMembers" END,
       notes = CASE WHEN $30::boolean THEN $31 ELSE notes END,
       "updatedBy" = COALESCE($19, "updatedBy"),
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL
     RETURNING *;`,
    [
      id,
      has('unitId'),
      input.unitId ?? null,
      input.fullName ?? null,
      has('phone'),
      input.phone ?? null,
      has('email'),
      input.email ?? null,
      has('idDocType'),
      input.idDocType ?? null,
      has('idDocNumber'),
      input.idDocNumber ?? null,
      input.role ?? null,
      has('moveInDate'),
      input.moveInDate ?? null,
      has('moveOutDate'),
      input.moveOutDate ?? null,
      input.status ?? null,
      input.updatedBy ?? null,
      has('occupation'),
      input.occupation ?? null,
      has('permanentAddress'),
      input.permanentAddress ?? null,
      has('emergencyContactName'),
      input.emergencyContactName ?? null,
      has('emergencyContactPhone'),
      input.emergencyContactPhone ?? null,
      has('familyMembers'),
      input.familyMembers ?? null,
      has('notes'),
      input.notes ?? null,
    ],
  );
  return result.rows[0] ?? null;
};

const deleteTenant = async (id: string): Promise<Tenant | null> => {
  const result = await query<Tenant>(
    `UPDATE ${TENANT_TABLE_NAME} SET "deletedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id],
  );
  return result.rows[0] ?? null;
};

// Does this unit already have an active primary tenant (other than excludeId)?
const findActivePrimaryForUnit = async (
  unitId: string,
  excludeId?: string,
): Promise<Tenant | null> => {
  const result = await query<Tenant>(
    `SELECT * FROM ${TENANT_TABLE_NAME}
      WHERE "unitId" = $1 AND role = 'primary' AND status <> 'moved_out'
        AND "deletedAt" IS NULL AND ($2::uuid IS NULL OR id <> $2)
      LIMIT 1;`,
    [unitId, excludeId ?? null],
  );
  return result.rows[0] ?? null;
};

// Which property does this unit belong to? (null if unit missing)
const getUnitPropertyId = async (unitId: string): Promise<string | null> => {
  const result = await query<{ propertyId: string }>(
    `SELECT f."propertyId" FROM units u JOIN floors f ON f.id = u."floorId"
      WHERE u.id = $1 AND u."deletedAt" IS NULL AND f."deletedAt" IS NULL LIMIT 1;`,
    [unitId],
  );
  return result.rows[0]?.propertyId ?? null;
};

const getAllTenants = async (options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  propertyId?: string;
  unitId?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: Tenant[]; total: number }> => {
  const where: string[] = ['t."deletedAt" IS NULL', 'p."deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (options.search) {
    values.push(`%${options.search.toLowerCase()}%`);
    where.push(
      `(LOWER(t."fullName") LIKE $${values.length} OR LOWER(COALESCE(t.email,'')) LIKE $${values.length} OR COALESCE(t.phone,'') LIKE $${values.length})`,
    );
  }
  if (options.status) {
    values.push(options.status);
    where.push(`t.status = $${values.length}`);
  }
  if (options.propertyId) {
    values.push(options.propertyId);
    where.push(`t."propertyId" = $${values.length}`);
  }
  if (options.unitId) {
    values.push(options.unitId);
    where.push(`t."unitId" = $${values.length}`);
  }
  if (options.ownerId) {
    values.push(options.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (options.propertyIds) {
    values.push(options.propertyIds);
    where.push(`t."propertyId" = ANY($${values.length}::uuid[])`);
  }

  values.push(options.limit ?? 20, options.offset ?? 0);

  const result = await query<Tenant & { totalCount?: number }>(
    `SELECT t.*, p.title AS "propertyTitle", u."unitCode" AS "unitCode",
            COUNT(*) OVER() AS "totalCount"
       FROM ${TENANT_TABLE_NAME} t
       JOIN properties p ON p.id = t."propertyId"
       LEFT JOIN units u ON u.id = t."unitId"
      WHERE ${where.join(' AND ')}
      ORDER BY t."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );

  const items = result.rows.map((row) => {
    const { totalCount: _totalCount, ...tenant } = row;
    return tenant;
  });
  return { items, total: result.rows[0]?.totalCount ?? 0 };
};

export {
  createTenant,
  deleteTenant,
  findActivePrimaryForUnit,
  getAllTenants,
  getTenantById,
  getUnitPropertyId,
  updateTenant,
};
