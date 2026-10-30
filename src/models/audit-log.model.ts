import { AUDIT_LOG_TABLE_NAME } from '../constants/database';
import { type Uuid } from '../utils/common';

export { AUDIT_LOG_TABLE_NAME };

export const auditEntityTypes = [
  'tenant',
  'lease',
  'invoice',
  'expense',
  'maintenance',
  'parking',
  'admin',
  'property',
  'floor',
  'unit',
  'request',
  'record',
] as const;
export type AuditEntityType = (typeof auditEntityTypes)[number];

// Field-level changes for an update: { field: { from, to } }.
export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export interface AuditLog {
  id: Uuid;
  actorId: Uuid | null;
  actorRole: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: Uuid | null;
  propertyId: Uuid | null;
  summary: string;
  changes: AuditChanges | null;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: AuditEntityType;
  entityId: string | null;
  propertyId: string | null;
  summary: string;
  changes: AuditChanges | null;
}

// Append-only history of who changed what, when. Rows are never updated or deleted by the app.
export const createAuditLogTableSql = `
CREATE TABLE IF NOT EXISTS ${AUDIT_LOG_TABLE_NAME} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId" UUID REFERENCES admins(id) ON DELETE SET NULL,
  "actorRole" VARCHAR(32),
  action VARCHAR(32) NOT NULL,
  "entityType" VARCHAR(32) NOT NULL,
  "entityId" UUID,
  "propertyId" UUID REFERENCES properties(id) ON DELETE SET NULL,
  summary VARCHAR(500) NOT NULL,
  changes JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const createAuditLogIndexesSql = [
  `CREATE INDEX IF NOT EXISTS audit_logs_property_created_idx ON ${AUDIT_LOG_TABLE_NAME} ("propertyId", "createdAt" DESC);`,
  `CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON ${AUDIT_LOG_TABLE_NAME} ("actorId");`,
  `CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON ${AUDIT_LOG_TABLE_NAME} ("createdAt" DESC);`,
];
