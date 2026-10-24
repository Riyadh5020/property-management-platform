import { query } from '../config/database';

export interface DashboardScope {
  role: 'superAdmin' | 'owner' | 'manager';
  adminId: string;
}

// Returns a SQL condition on properties alias "p" plus its params.
const propertyScope = (scope: DashboardScope): { sql: string; params: unknown[] } => {
  if (scope.role === 'superAdmin') {
    return { sql: 'TRUE', params: [] };
  }
  if (scope.role === 'owner') {
    return { sql: 'p."ownerId" = $1', params: [scope.adminId] };
  }
  return {
    sql: `p.id IN (SELECT "propertyId" FROM manager_properties
                    WHERE "managerId" = $1 AND "deletedAt" IS NULL)`,
    params: [scope.adminId],
  };
};

const getDashboardStats = async (
  scope: DashboardScope,
): Promise<{
  totals: { properties: number; floors: number; units: number; managers: number };
  unitsByStatus: { status: string; count: number }[];
  expiringSubscriptions: unknown[];
  pendingRequests: { property: number; floor: number } | null;
}> => {
  const { sql: scopeSql, params } = propertyScope(scope);

  const counts = await query<{ properties: number; floors: number; units: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM properties p WHERE p."deletedAt" IS NULL AND ${scopeSql}) AS properties,
       (SELECT COUNT(*)::int FROM floors f JOIN properties p ON p.id = f."propertyId"
         WHERE f."deletedAt" IS NULL AND p."deletedAt" IS NULL AND ${scopeSql}) AS floors,
       (SELECT COUNT(*)::int FROM units u JOIN floors f ON f.id = u."floorId"
         JOIN properties p ON p.id = f."propertyId"
         WHERE u."deletedAt" IS NULL AND f."deletedAt" IS NULL AND p."deletedAt" IS NULL AND ${scopeSql}) AS units`,
    params,
  );

  const unitsByStatus = await query<{ status: string; count: number }>(
    `SELECT u.status, COUNT(*)::int AS count
       FROM units u JOIN floors f ON f.id = u."floorId"
       JOIN properties p ON p.id = f."propertyId"
      WHERE u."deletedAt" IS NULL AND f."deletedAt" IS NULL AND p."deletedAt" IS NULL AND ${scopeSql}
      GROUP BY u.status`,
    params,
  );

  let managers = 0;
  if (scope.role === 'superAdmin') {
    const r = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admins WHERE role = 'manager' AND "deletedAt" IS NULL`,
    );
    managers = r.rows[0]?.count ?? 0;
  } else if (scope.role === 'owner') {
    const r = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM admins
        WHERE role = 'manager' AND "ownerId" = $1 AND "deletedAt" IS NULL`,
      [scope.adminId],
    );
    managers = r.rows[0]?.count ?? 0;
  }

  let expiring: unknown[] = [];
  let pendingRequests: { property: number; floor: number } | null = null;

  if (scope.role !== 'manager') {
    const e = await query(
      `SELECT p.id, p.title, p."subscriptionEndsAt", sp.name AS "planName",
              CEIL(EXTRACT(EPOCH FROM (p."subscriptionEndsAt" - NOW())) / 86400)::int AS "daysLeft"
         FROM properties p
         LEFT JOIN subscription_plans sp ON sp.id = p."planId"
        WHERE p."deletedAt" IS NULL AND ${scopeSql}
          AND p."subscriptionEndsAt" IS NOT NULL
          AND p."subscriptionEndsAt" < NOW() + INTERVAL '30 days'
        ORDER BY p."subscriptionEndsAt" ASC
        LIMIT 10`,
      params,
    );
    expiring = e.rows;

    const ownerFilter = scope.role === 'owner' ? `AND "ownerId" = $1` : '';
    const reqParams = scope.role === 'owner' ? [scope.adminId] : [];
    const pr = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM property_requests WHERE status = 'pending' ${ownerFilter}`,
      reqParams,
    );
    const fr = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM floor_requests WHERE status = 'pending' ${ownerFilter}`,
      reqParams,
    );
    pendingRequests = { property: pr.rows[0]?.count ?? 0, floor: fr.rows[0]?.count ?? 0 };
  }

  return {
    totals: { ...(counts.rows[0] ?? { properties: 0, floors: 0, units: 0 }), managers },
    unitsByStatus: unitsByStatus.rows,
    expiringSubscriptions: expiring,
    pendingRequests,
  };
};
const getReportStats = async (
  scope: DashboardScope,
): Promise<{
  properties: {
    id: string;
    title: string;
    floors: number;
    units: number;
    occupied: number;
    vacant: number;
    reserved: number;
    maintenance: number;
    rentRoll: number;
    occupiedRent: number;
  }[];
}> => {
  const { sql: scopeSql, params } = propertyScope(scope);

  const result = await query<{
    id: string;
    title: string;
    floors: number;
    units: number;
    occupied: number;
    vacant: number;
    reserved: number;
    maintenance: number;
    rentRoll: number;
    occupiedRent: number;
  }>(
    `SELECT p.id, p.title,
            COUNT(DISTINCT f.id)::int AS floors,
            COUNT(u.id)::int AS units,
            COUNT(u.id) FILTER (WHERE u.status = 'occupied')::int AS occupied,
            COUNT(u.id) FILTER (WHERE u.status = 'vacant')::int AS vacant,
            COUNT(u.id) FILTER (WHERE u.status = 'reserved')::int AS reserved,
            COUNT(u.id) FILTER (WHERE u.status = 'maintenance')::int AS maintenance,
            COALESCE(SUM(u.rent), 0) AS "rentRoll",
            COALESCE(SUM(u.rent) FILTER (WHERE u.status = 'occupied'), 0) AS "occupiedRent"
       FROM properties p
       LEFT JOIN floors f ON f."propertyId" = p.id AND f."deletedAt" IS NULL
       LEFT JOIN units u ON u."floorId" = f.id AND u."deletedAt" IS NULL
      WHERE p."deletedAt" IS NULL AND ${scopeSql}
      GROUP BY p.id, p.title
      ORDER BY p.title`,
    params,
  );

  return { properties: result.rows };
};
export { getDashboardStats, getReportStats };
