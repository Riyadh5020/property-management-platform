import { query } from '../config/database';
import { EXPENSE_TABLE_NAME } from '../constants/database';
import {
  MAINTENANCE_TABLE_NAME,
  type CreateMaintenanceInput,
  type Maintenance,
  type ReviewMaintenanceInput,
  type UpdateMaintenanceInput,
} from '../models/maintenance.model';

const createMaintenance = async (i: CreateMaintenanceInput): Promise<Maintenance> => {
  const r = await query<Maintenance>(
    `INSERT INTO ${MAINTENANCE_TABLE_NAME}
      ("propertyId","unitId",title,description,category,priority,status,assignee,
       "scheduledFor",cost,"approvalStatus","createdBy","updatedBy")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *;`,
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
      i.approvalStatus ?? 'approved',
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

// Records the owner's decision. Only a still-pending request can be reviewed, so two reviews can't race.
const reviewMaintenance = async (
  id: string,
  i: ReviewMaintenanceInput & { reviewedBy: string | null },
): Promise<Maintenance | null> => {
  const has = (k: string): boolean => Object.prototype.hasOwnProperty.call(i, k);
  const r = await query<Maintenance>(
    `UPDATE ${MAINTENANCE_TABLE_NAME} SET
       "approvalStatus" = $2::varchar,
       "ownerNote" = $3,
       "reviewedBy" = $4::uuid,
       "reviewedAt" = NOW(),
       status = CASE WHEN $2::varchar = 'rejected' THEN 'cancelled' ELSE status END,
       priority = COALESCE($5, priority),
       assignee = CASE WHEN $6::boolean THEN $7 ELSE assignee END,
       "scheduledFor" = CASE WHEN $8::boolean THEN $9::date ELSE "scheduledFor" END,
       cost = COALESCE($10, cost),
       "updatedBy" = $4::uuid,
       "updatedAt" = NOW()
     WHERE id = $1 AND "deletedAt" IS NULL AND "approvalStatus" = 'pending' RETURNING *;`,
    [
      id,
      i.decision,
      i.note ?? null,
      i.reviewedBy,
      i.priority ?? null,
      has('assignee'),
      i.assignee ?? null,
      has('scheduledFor'),
      i.scheduledFor ?? null,
      i.cost ?? null,
    ],
  );
  return r.rows[0] ?? null;
};

// Creates the matching expense for a completed request and links it, in one atomic statement.
// The row lock plus the "expenseId" IS NULL check mean at most one expense is ever created.
const attachCompletionExpense = async (
  id: string,
  actorId: string | null,
): Promise<Maintenance | null> => {
  const r = await query<Maintenance>(
    `WITH target AS (
       SELECT id, "propertyId", title, cost, "completedOn"
         FROM ${MAINTENANCE_TABLE_NAME}
        WHERE id = $1 AND "deletedAt" IS NULL AND status = 'completed'
          AND cost > 0 AND "expenseId" IS NULL
        FOR UPDATE
     ), created AS (
       INSERT INTO ${EXPENSE_TABLE_NAME}
         ("propertyId", title, category, amount, "expenseDate", status, notes, "createdBy", "updatedBy")
       SELECT "propertyId", LEFT('Maintenance: ' || title, 255), 'maintenance', cost,
              COALESCE("completedOn", CURRENT_DATE), 'paid',
              'Created automatically when the maintenance request was completed.', $2::uuid, $2::uuid
         FROM target
       RETURNING id
     )
     UPDATE ${MAINTENANCE_TABLE_NAME} m
        SET "expenseId" = created.id, "updatedAt" = NOW()
       FROM created
      WHERE m.id = $1
     RETURNING m.*;`,
    [id, actorId],
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
  approvalStatus?: string;
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
  if (o.approvalStatus) {
    values.push(o.approvalStatus);
    where.push(`m."approvalStatus" = $${values.length}`);
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
  attachCompletionExpense,
  createMaintenance,
  deleteMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  reviewMaintenance,
  updateMaintenance,
};
