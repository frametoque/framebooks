import {  auth  } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export type Role = string;
export type ResourceType = 'invoices' | 'incomes' | 'expenses' | 'clients' | 'accounts' | 'inventory' | 'settings' | 'team' | 'export' | 'billing';
export type ActionType = 'read' | 'insert' | 'update' | 'delete' | 'manage' | 'data';

/**
 * Gets the current user's role and tenant ID.
 */
export async function getUserContext() {
  const { userId } = await auth();
  if (!userId) return { userId: null, role: null, tenantId: null };

  const sql = neon(process.env.DATABASE_URL!);
  const userRows = await sql`SELECT tenant_id, role FROM admin_users WHERE id = ${Number(userId) || 0}`;
  
  if (userRows.length === 0) {
    return { userId, role: null, tenantId: null };
  }

  return {
    userId,
    tenantId: userRows[0].tenant_id,
    role: userRows[0].role as Role
  };
}

/**
 * Checks if the given role has permission for the specified resource and action.
 */
export async function hasPermission(role: Role | null, resource: ResourceType, action: ActionType, tenantId: number | null = null): Promise<boolean> {
  if (!role) return false;
  
  // Owner has full access to everything
  if (role.toLowerCase() === 'owner') return true;
  
  // Billing is owner-only, not in DB
  if (resource === 'billing') {
    return role.toLowerCase() === 'owner';
  }

  const sql = neon(process.env.DATABASE_URL!);
  let result;
  
  if (tenantId) {
    result = await sql`SELECT granular_permissions FROM tenant_roles WHERE LOWER(role) = LOWER(${role}) AND tenant_id = ${tenantId}`;
  } else {
    result = [];
  }

  if (!result || result.length === 0) {
    result = await sql`SELECT granular_permissions FROM role_permissions WHERE LOWER(role) = LOWER(${role})`;
  }

  if (result.length === 0) return false;

  let perms = result[0].granular_permissions;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch(e) {}
  }
  if (!perms || typeof perms !== 'object') return false;

  const resourcePerms = perms[resource];
  if (!resourcePerms) return false;

  return resourcePerms[action] === true;
}

/**
 * Checks whether the tenant's grace period has expired (read-only mode active).
 */
export async function checkTenantReadOnly(tenantId: number | string | null): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const tenantRows = await sql`SELECT plan, plan_expires_at FROM tenants WHERE id = ${tenantId} LIMIT 1`;
    if (tenantRows.length === 0) return false;

    const tenant = tenantRows[0];
    if (!tenant.plan || tenant.plan.toLowerCase() === "free") return false;

    let expires = tenant.plan_expires_at;
    if (!expires) {
      const subRows = await sql`
        SELECT current_period_end 
        FROM subscriptions 
        WHERE tenant_id = ${tenantId} AND current_period_end IS NOT NULL 
        ORDER BY id DESC LIMIT 1
      `;
      if (subRows.length > 0 && subRows[0].current_period_end) {
        expires = subRows[0].current_period_end;
      }
    }

    if (!expires) return false;

    const settingsRows = await sql`SELECT value FROM platform_settings WHERE key = 'grace_period_days' LIMIT 1`;
    const graceDays = settingsRows.length > 0 && settingsRows[0].value != null ? Number(settingsRows[0].value) || 7 : 7;

    const expiresAt = new Date(expires);
    const now = new Date();
    const graceEnd = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

    return now > graceEnd;
  } catch (err) {
    console.error("Error checking tenant read-only state:", err);
    return false;
  }
}

/**
 * Reusable server-side permission guard.
 * Returns an error string if unauthorized, or the context if successful.
 */
export async function requirePermission(resource: ResourceType, action: ActionType) {
  const { userId, role, tenantId } = await getUserContext();
  
  if (!userId || !tenantId) {
    return { error: "Unauthorized", context: null };
  }

  // Block mutation actions (add/insert, update/edit, delete, manage) if workspace is in read-only mode after grace period!
  // 'read' action is completely allowed so users can view everything.
  // 'billing' resource is allowed so workspace owner can pay and renew.
  if (action !== 'read' && resource !== 'billing') {
    const isReadOnly = await checkTenantReadOnly(tenantId);
    if (isReadOnly) {
      return { 
        error: "Your subscription and grace period have expired. Your workspace is currently in read-only mode. Please renew your subscription to create, edit, or delete records.", 
        context: null 
      };
    }
  }

  if (!(await hasPermission(role, resource, action, tenantId))) {
    return { error: "Insufficient permissions to perform this action.", context: null };
  }

  return { error: null, context: { userId, role, tenantId, sql: neon(process.env.DATABASE_URL!) } };
}
