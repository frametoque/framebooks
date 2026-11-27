import { auth } from '@/lib/auth';
import sql from "@/lib/db";
import { getPosAddonStatus } from "@/lib/pos/entitlement";

export type Role = string;
export type ResourceType = 
  | 'invoices' 
  | 'incomes' 
  | 'expenses' 
  | 'clients' 
  | 'accounts' 
  | 'inventory' 
  | 'settings' 
  | 'team' 
  | 'export' 
  | 'billing'
  | 'pos'
  | 'stock';

export type ActionType = 
  | 'read' 
  | 'insert' 
  | 'update' 
  | 'delete' 
  | 'manage' 
  | 'data' 
  | 'appearance' 
  | 'customize' 
  | 'invoice_customization'
  | 'use'
  | 'refund'
  | 'discount'
  | 'void'
  | 'reports_view'
  | 'view';

export type PosPermission = 
  | 'pos.use' 
  | 'pos.refund' 
  | 'pos.discount' 
  | 'pos.void' 
  | 'pos.reports.view' 
  | 'stock.view' 
  | 'stock.manage';

/**
 * Gets the current user's role and tenant ID.
 */
export async function getUserContext() {
  const { userId, session } = await auth();
  if (!userId && !session?.user?.email) return { userId: null, role: null, tenantId: null };

  const email = session?.user?.email?.trim().toLowerCase();
  const numId = Number(userId) || 0;
  const safeId = (numId > 0 && numId < 2147483647) ? numId : 0;

  const userRows = await sql`
    SELECT id, tenant_id, role 
    FROM admin_users 
    WHERE (id = ${safeId} AND ${safeId} > 0)
       OR (email IS NOT NULL AND LOWER(email) = ${email || ''})
    LIMIT 1
  `;
  
  if (userRows.length === 0) {
    return { userId, role: null, tenantId: null };
  }

  return {
    userId: String(userRows[0].id),
    tenantId: userRows[0].tenant_id,
    role: userRows[0].role as Role
  };
}

/**
 * Fetch permissions payload for role.
 */
export async function getRolePermissionsObject(role: Role | null, tenantId: number | null = null): Promise<Record<string, any> | null> {
  if (!role) return null;
  const lowerRole = role.toLowerCase();
  if (lowerRole === 'owner' || lowerRole === 'super admin' || lowerRole === 'super_admin') return null; // full bypass

  let result;
  if (tenantId) {
    result = await sql`SELECT granular_permissions FROM tenant_roles WHERE LOWER(role) = LOWER(${role}) AND tenant_id = ${tenantId}`;
  } else {
    result = [];
  }

  if (!result || result.length === 0) {
    result = await sql`SELECT granular_permissions FROM role_permissions WHERE LOWER(role) = LOWER(${role})`;
  }

  if (result.length === 0) {
    if (lowerRole === 'cashier') {
      return {
        pos: { use: true, refund: false, discount: false, void: false, reports_view: false },
        stock: { view: false, manage: false },
      };
    }
    if (lowerRole === 'admin') return null; // full bypass
    return {};
  }

  let perms = result[0].granular_permissions;
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms); } catch {}
  }
  return perms && typeof perms === 'object' ? perms : {};
}

/**
 * Checks if the given role has permission for the specified resource and action.
 */
export async function hasPermission(
  role: Role | null, 
  resource: ResourceType, 
  action: ActionType, 
  tenantId: number | null = null
): Promise<boolean> {
  if (!role) return false;
  
  const lowerRole = role.toLowerCase();

  // Owner and Super Admin have full access to everything
  if (lowerRole === 'owner' || lowerRole === 'super admin' || lowerRole === 'super_admin') return true;
  
  // Billing is owner-only, not in DB
  if (resource === 'billing') {
    return lowerRole === 'owner';
  }

  // POS Access Rule: Cashier and all roles above cashier have access to POS
  // Roles hierarchy: super_admin, owner, admin, accountant, editor, member, cashier
  if (resource === 'pos' && action === 'use') {
    const posRoles = ['super_admin', 'super admin', 'owner', 'admin', 'accountant', 'editor', 'member', 'cashier'];
    if (posRoles.includes(lowerRole)) return true;
  }

  // Stock viewing for POS terminal catalog loading
  if (resource === 'stock' && (action === 'view' || action === 'read')) {
    const stockViewRoles = ['super_admin', 'super admin', 'owner', 'admin', 'accountant', 'editor', 'member', 'cashier'];
    if (stockViewRoles.includes(lowerRole)) return true;
  }

  // Built-in cashier role defaults
  if (lowerRole === 'cashier') {
    if (resource === 'pos' && action === 'use') return true;
    if (resource !== 'pos' && resource !== 'stock') return false;
  }

  const perms = await getRolePermissionsObject(role, tenantId);
  if (perms === null) {
    // Admin full bypass
    if (lowerRole === 'admin') return true;
    return false;
  }

  const resourcePerms = perms[resource];

  if (resource === 'settings' && action === 'appearance') {
    if (resourcePerms && (resourcePerms.manage === true || resourcePerms.appearance === true)) return true;
  }

  // Invoice layout customization permission check
  if (
    (resource === 'invoices' && (action === 'customize' || action === 'invoice_customization')) ||
    (resource === 'settings' && (action === 'customize' || action === 'invoice_customization'))
  ) {
    if (perms.invoices?.customize === true) return true;
    if (perms.invoices?.invoice_customization === true) return true;
    if (perms.settings?.invoice_customization === true) return true;
    if (perms.settings?.customize === true) return true;
    if (perms.invoices?.customize === false || perms.settings?.invoice_customization === false) return false;
    if (perms.settings?.manage === true) return true;
    if (lowerRole === 'admin') return true;
    return false;
  }

  // Stock permissions mapping: stock.view maps to stock.view or inventory.read; stock.manage maps to stock.manage or inventory.update
  if (resource === 'stock') {
    if (action === 'view' || action === 'read') {
      if (resourcePerms?.view === true || resourcePerms?.read === true || perms.inventory?.read === true) return true;
    }
    if (action === 'manage' || action === 'update') {
      if (resourcePerms?.manage === true || resourcePerms?.update === true || perms.inventory?.update === true) return true;
    }
  }

  if (!resourcePerms) return false;
  return resourcePerms[action] === true;
}

/**
 * Convenience helper to check dotted permissions like 'pos.use' or 'stock.manage'.
 */
export async function hasGranularPermission(
  role: Role | null,
  permission: PosPermission,
  tenantId: number | null = null
): Promise<boolean> {
  switch (permission) {
    case 'pos.use':
      return hasPermission(role, 'pos', 'use', tenantId);
    case 'pos.refund':
      return hasPermission(role, 'pos', 'refund', tenantId);
    case 'pos.discount':
      return hasPermission(role, 'pos', 'discount', tenantId);
    case 'pos.void':
      return hasPermission(role, 'pos', 'void', tenantId);
    case 'pos.reports.view':
      return hasPermission(role, 'pos', 'reports_view', tenantId);
    case 'stock.view':
      return hasPermission(role, 'stock', 'view', tenantId);
    case 'stock.manage':
      return hasPermission(role, 'stock', 'manage', tenantId);
    default:
      return false;
  }
}

/**
 * Checks if a user's permissions contain ONLY POS permissions.
 * STRICT RULE: if true, user is auto-redirected to /pos and blocked from /user/*.
 */
export async function isCashierOnlyUser(role: Role | null, tenantId: number | null = null): Promise<boolean> {
  if (!role) return false;
  const lowerRole = role.toLowerCase();

  // Owners, Admins, Super Admins, Accountants, Editors, Members are general workspace users, not cashier-only
  if (['owner', 'super admin', 'super_admin', 'admin', 'accountant', 'editor', 'member'].includes(lowerRole)) {
    return false;
  }

  const perms = await getRolePermissionsObject(role, tenantId);
  if (!perms) return false;

  // Check if user has ANY general ERP access
  const erpResources = ['invoices', 'incomes', 'expenses', 'clients', 'accounts', 'inventory', 'settings', 'team', 'export'];
  for (const res of erpResources) {
    const rPerm = perms[res];
    if (rPerm && typeof rPerm === 'object') {
      for (const key of Object.keys(rPerm)) {
        if (rPerm[key] === true) {
          return false; // has broader permission
        }
      }
    }
  }

  // Must have at least pos.use to be a cashier
  const hasPos = perms.pos?.use === true || lowerRole === 'cashier';
  return hasPos;
}

/**
 * Checks whether the tenant's workspace is in read-only mode (e.g. pending payment or grace period expired).
 */
export async function checkTenantReadOnly(tenantId: number | string | null): Promise<boolean> {
  if (!tenantId) return false;
  try {
    const tenantRows = await sql`SELECT plan, plan_expires_at, payment_status FROM tenants WHERE id = ${tenantId} LIMIT 1`;
    if (tenantRows.length === 0) return false;

    const tenant = tenantRows[0];

    // 1. Explicit admin pending payment flag
    if (tenant.payment_status === "pending_payment") {
      return true;
    }

    // 2. Check subscription status
    const subRows = await sql`
      SELECT status, current_period_end 
      FROM subscriptions 
      WHERE tenant_id = ${tenantId} 
      ORDER BY id DESC LIMIT 1
    `;
    if (subRows.length > 0 && subRows[0].status === "past_due") {
      return true;
    }

    if (!tenant.plan || tenant.plan.toLowerCase() === "free") return false;

    let expires = tenant.plan_expires_at;
    if (!expires && subRows.length > 0 && subRows[0].current_period_end) {
      expires = subRows[0].current_period_end;
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

  // Block mutation actions if workspace is in read-only mode
  if (action !== 'read' && action !== 'view' && action !== 'use' && resource !== 'billing') {
    const isReadOnly = await checkTenantReadOnly(tenantId);
    if (isReadOnly) {
      return { 
        error: "Your workspace is currently restricted to view-only mode due to a pending payment or expired subscription. Creating, editing, or deleting records is disabled.", 
        context: null 
      };
    }
  }

  // Viewers can ONLY read data
  if (role && role.toLowerCase() === 'viewer') {
    if (action !== 'read' && action !== 'view' && action !== 'reports_view') {
      return {
        error: "Permission denied: Viewers have view-only access and cannot record, edit, or delete data.",
        context: null
      };
    }
  }

  if (!(await hasPermission(role, resource, action, tenantId))) {
    return { error: "Insufficient permissions to perform this action.", context: null };
  }

  return { error: null, context: { userId, role, tenantId, sql } };
}

/**
 * POS-specific guard checking both POS Add-on entitlement and user permission.
 */
export async function requirePosPermission(permission: PosPermission) {
  const { userId, role, tenantId } = await getUserContext();

  if (!userId || !tenantId) {
    return { error: "Unauthorized", context: null };
  }

  // Check tenant entitlement for POS add-on
  const addonStatus = await getPosAddonStatus(tenantId);
  if (!addonStatus.hasAddon) {
    return {
      error: "Tenant does not have an active POS add-on subscription.",
      context: null,
    };
  }

  const allowed = await hasGranularPermission(role, permission, tenantId);
  if (!allowed) {
    return {
      error: `Insufficient permissions: missing '${permission}' permission.`,
      context: null,
    };
  }

  return { error: null, context: { userId, role, tenantId, sql } };
}
