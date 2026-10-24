import { query } from '../config/database';
import {
  MAINTENANCE_TABLE_NAME,
  type CreateMaintenanceInput,
  type Maintenance,
  type UpdateMaintenanceInput,
} from '../models/maintenance.model';

const createMaintenance = async (i: CreateMaintenanceInput): Promise<Maintenance> => {
  const r = await query<Maintenance>(
    `INSERT INTO ${MAINTENANCE_TABLE_NAME}
      ("propertyId","unitId",title,description,category,priority,status,assignee,
       "scheduledFor",cost,"createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *;`,
    [
      i.propertyId,
      i.unitId ?? null,
      i.title,
      i.description ?? null,
      i.category ?? 'tenant_request',
      i.priority ?? 'medium',
      i.status ?? 'open',
      i.assignee ?? null,
      i.scheduledFor ?? null,
      i.cost ?? 0,
      i.createdBy ?? null,
      i.updatedBy ?? null,
    ],
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error('Failed to create maintenance request');
  }
  return row;
};

const getMaintenanceById = async (id: string): Promise<Maintenance | null> => {
  const r = await query<Maintenance>(
    `SELECT * FROM ${MAINTENANCE_TABLE_NAME} WHERE id = $1 AND "deletedAt" IS NULL LIMIT 1;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const updateMaintenance = async (
  id: string,
  i: UpdateMaintenanceInput & { completedOn?: string | null },
): Promise<Maintenance | null> => {
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(i, k);
  const r = await query<Maintenance>(
    `UPDATE ${MAINTENANCE_TABLE_NAME} SET
       "unitId" = CASE WHEN $2::boolean THEN $3::uuid ELSE "unitId" END,
       title = COALESCE($4, title),
       description = CASE WHEN $5::boolean THEN $6 ELSE description END,
       category = COALESCE($7, category),
       priority = COALESCE($8, priority),
       status = COALESCE($9, status),
       assignee = CASE WHEN $10::boolean THEN $11 ELSE assignee END,
       "scheduledFor" = CASE WHEN $12::boolean THEN $13::date ELSE "scheduledFor" END,
       "completedOn" = CASE WHEN $14::boolean THEN $15::date ELSE "completedOn" END,
       cost = COALESCE($16, cost),
       "updatedBy" = COALESCE($17, "updatedBy"),
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [
      id,
      has('unitId'),
      i.unitId ?? null,
      i.title ?? null,
      has('description'),
      i.description ?? null,
      i.category ?? null,
      i.priority ?? null,
      i.status ?? null,
      has('assignee'),
      i.assignee ?? null,
      has('scheduledFor'),
      i.scheduledFor ?? null,
      has('completedOn'),
      i.completedOn ?? null,
      i.cost ?? null,
      i.updatedBy ?? null,
    ],
  );
  return r.rows[0] ?? null;
};

const deleteMaintenance = async (id: string): Promise<Maintenance | null> => {
  const r = await query<Maintenance>(
    `UPDATE ${MAINTENANCE_TABLE_NAME} SET "deletedAt" = NOW()
      WHERE id = $1 AND "deletedAt" IS NULL RETURNING *;`,
    [id],
  );
  return r.rows[0] ?? null;
};

const getAllMaintenance = async (o: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  priority?: string;
  propertyId?: string;
  ownerId?: string;
  propertyIds?: string[];
}): Promise<{ items: Maintenance[]; total: number }> => {
  const where: string[] = ['m."deletedAt" IS NULL', 'p."deletedAt" IS NULL'];
  const values: unknown[] = [];
  if (o.search) {
    values.push(`%${o.search.toLowerCase()}%`);
    where.push(
      `(LOWER(m.title) LIKE $${values.length} OR LOWER(COALESCE(m.assignee,'')) LIKE $${values.length})`,
    );
  }
  if (o.status) {
    values.push(o.status);
    where.push(`m.status = $${values.length}`);
  }
  if (o.priority) {
    values.push(o.priority);
    where.push(`m.priority = $${values.length}`);
  }
  if (o.propertyId) {
    values.push(o.propertyId);
    where.push(`m."propertyId" = $${values.length}`);
  }
  if (o.ownerId) {
    values.push(o.ownerId);
    where.push(`p."ownerId" = $${values.length}`);
  }
  if (o.propertyIds) {
    values.push(o.propertyIds);
    where.push(`m."propertyId" = ANY($${values.length}::uuid[])`);
  }
  values.push(o.limit ?? 20, o.offset ?? 0);
  const r = await query<Maintenance & { totalCount?: number }>(
    `SELECT m.*, p.title AS "propertyTitle", u."unitCode" AS "unitCode", COUNT(*) OVER() AS "totalCount"
       FROM ${MAINTENANCE_TABLE_NAME} m
       JOIN properties p ON p.id = m."propertyId"
       LEFT JOIN units u ON u.id = m."unitId"
      WHERE ${where.join(' AND ')}
      ORDER BY m."createdAt" DESC
      LIMIT $${values.length - 1} OFFSET $${values.length};`,
    values,
  );
  const items = r.rows.map((row) => {
    const { totalCount: _t, ...m } = row;
    return m;
  });
  return { items, total: r.rows[0]?.totalCount ?? 0 };
};

export {
  createMaintenance,
  deleteMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  updateMaintenance,
};
