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
  const userRows = await sql`SELECT tenant_id, role FROM admin_users WHERE clerk_id = ${userId}`;
  
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
 * Reusable server-side permission guard.
 * Returns an error string if unauthorized, or the context if successful.
 */
export async function requirePermission(resource: ResourceType, action: ActionType) {
  const { userId, role, tenantId } = await getUserContext();
  
  if (!userId || !tenantId) {
    return { error: "Unauthorized", context: null };
  }

  if (!(await hasPermission(role, resource, action, tenantId))) {
    return { error: "Insufficient permissions to perform this action.", context: null };
  }

  return { error: null, context: { userId, role, tenantId, sql: neon(process.env.DATABASE_URL!) } };
}
