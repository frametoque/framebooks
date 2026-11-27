"use server";
import { requirePermission } from "./rbac";
import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, any>> = {
  super_admin: {
    invoices: { read: true, insert: true, update: true, delete: true, customize: true },
    incomes: { read: true, insert: true, update: true, delete: true },
    expenses: { read: true, insert: true, update: true, delete: true },
    clients: { read: true, insert: true, update: true, delete: true },
    accounts: { read: true, insert: true, update: true, delete: true },
    inventory: { read: true, insert: true, update: true, delete: true },
    pos: { use: true, refund: true, discount: true, void: true, reports_view: false },
    stock: { view: false, manage: true },
    settings: { manage: true, appearance: true },
    team: { manage: true },
    export: { data: true },
  },
  admin: {
    invoices: { read: true, insert: true, update: true, delete: true, customize: true },
    incomes: { read: true, insert: true, update: true, delete: true },
    expenses: { read: true, insert: true, update: true, delete: true },
    clients: { read: true, insert: true, update: true, delete: true },
    accounts: { read: true, insert: true, update: true, delete: true },
    inventory: { read: true, insert: true, update: true, delete: true },
    pos: { use: false, refund: false, discount: true, void: false, reports_view: true },
    stock: { view: true, manage: false },
    settings: { manage: true, appearance: true },
    team: { manage: true },
    export: { data: false },
  },
  editor: {
    invoices: { read: true, insert: true, update: true, delete: true, customize: false },
    incomes: { read: true, insert: true, update: true, delete: true },
    expenses: { read: true, insert: true, update: true, delete: true },
    clients: { read: true, insert: true, update: true, delete: true },
    accounts: { read: true, insert: true, update: true, delete: true },
    inventory: { read: true, insert: true, update: true, delete: true },
    pos: { use: false, refund: false, discount: false, void: false, reports_view: true },
    stock: { view: true, manage: false },
    settings: { manage: false, appearance: false },
    team: { manage: false },
    export: { data: false },
  },
  accountant: {
    invoices: { read: true, insert: true, update: true, delete: false, customize: false },
    incomes: { read: true, insert: true, update: true, delete: false },
    expenses: { read: true, insert: true, update: true, delete: false },
    clients: { read: true, insert: true, update: true, delete: false },
    accounts: { read: true, insert: true, update: true, delete: false },
    inventory: { read: true, insert: false, update: false, delete: false },
    pos: { use: true, refund: true, discount: true, void: false, reports_view: true },
    stock: { view: true, manage: false },
    settings: { manage: false, appearance: false },
    team: { manage: false },
    export: { data: true },
  },
  cashier: {
    invoices: { read: false, insert: false, update: false, delete: false, customize: false },
    incomes: { read: false, insert: false, update: false, delete: false },
    expenses: { read: false, insert: false, update: false, delete: false },
    clients: { read: false, insert: false, update: false, delete: false },
    accounts: { read: false, insert: false, update: false, delete: false },
    inventory: { read: false, insert: false, update: false, delete: false },
    pos: { use: true, refund: false, discount: false, void: false, reports_view: false },
    stock: { view: true, manage: false },
    settings: { manage: false, appearance: false },
    team: { manage: false },
    export: { data: false },
  },
  viewer: {
    invoices: { read: true, insert: false, update: false, delete: false, customize: false },
    incomes: { read: true, insert: false, update: false, delete: false },
    expenses: { read: true, insert: false, update: false, delete: false },
    clients: { read: true, insert: false, update: false, delete: false },
    accounts: { read: true, insert: false, update: false, delete: false },
    inventory: { read: true, insert: false, update: false, delete: false },
    pos: { use: false, refund: false, discount: false, void: false, reports_view: true },
    stock: { view: true, manage: false },
    settings: { manage: false, appearance: false },
    team: { manage: false },
    export: { data: false },
  },
};

export const DEFAULT_ROLES = [
  { role: "Super Admin", granular_permissions: DEFAULT_ROLE_PERMISSIONS.super_admin },
  { role: "Admin", granular_permissions: DEFAULT_ROLE_PERMISSIONS.admin },
  { role: "Editor", granular_permissions: DEFAULT_ROLE_PERMISSIONS.editor },
  { role: "Accountant", granular_permissions: DEFAULT_ROLE_PERMISSIONS.accountant },
  { role: "Cashier", granular_permissions: DEFAULT_ROLE_PERMISSIONS.cashier },
  { role: "Viewer", granular_permissions: DEFAULT_ROLE_PERMISSIONS.viewer },
];

export async function ensureDefaultRolePermissions() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(50) UNIQUE NOT NULL,
        granular_permissions JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    for (const r of DEFAULT_ROLES) {
      await sql`
        INSERT INTO role_permissions (role, granular_permissions, updated_at)
        VALUES (${r.role}, ${JSON.stringify(r.granular_permissions)}::jsonb, NOW())
        ON CONFLICT (role) DO UPDATE SET
          granular_permissions = EXCLUDED.granular_permissions,
          updated_at = NOW()
      `;
    }

    // Clean up temporary custom overrides for standard roles so they serve as native defaults
    await sql`
      DELETE FROM tenant_roles 
      WHERE LOWER(role) IN ('super admin', 'super_admin', 'admin', 'editor')
    `.catch(() => {});
  } catch (err) {
    console.warn("[ensureDefaultRolePermissions] Notice:", err);
  }
}

export async function getRoles() {
  const { error: rbacError, context } = await requirePermission('team', 'manage');
  if (rbacError || !context) throw new Error(rbacError || "Unauthorized");

  const { tenantId } = context;

  await ensureDefaultRolePermissions();

  // Fetch base roles from DB
  const baseRoles = await sql`SELECT role, granular_permissions FROM role_permissions`;
  const effectiveBaseRoles = baseRoles.length > 0 ? baseRoles : DEFAULT_ROLES;

  // Fetch tenant custom overrides
  const customRoles = await sql`SELECT role, granular_permissions FROM tenant_roles WHERE tenant_id = ${tenantId}`;

  // Merge them. Custom roles override base roles.
  const rolesMap = new Map();
  for (const r of effectiveBaseRoles) {
    let perms = r.granular_permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch {}
    }
    rolesMap.set(r.role.toLowerCase(), { ...r, granular_permissions: perms, isCustom: false });
  }

  // Ensure all standard DEFAULT_ROLES exist
  for (const defRole of DEFAULT_ROLES) {
    const key = defRole.role.toLowerCase();
    if (!rolesMap.has(key)) {
      rolesMap.set(key, { ...defRole, isCustom: false });
    }
  }

  for (const r of customRoles) {
    let perms = r.granular_permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch {}
    }
    rolesMap.set(r.role.toLowerCase(), { ...r, granular_permissions: perms, isCustom: true });
  }

  // Never allow owner to be configured
  rolesMap.delete('owner');

  return Array.from(rolesMap.values());
}

export async function saveRole(roleData: any) {
  const { error: rbacError, context } = await requirePermission('team', 'manage');
  if (rbacError || !context) throw new Error(rbacError || "Unauthorized");

  const { tenantId } = context;
  
  // Protect owner
  if (roleData.role.toLowerCase() === 'owner') {
    throw new Error("Owner role cannot be modified.");
  }

  await sql`
    INSERT INTO tenant_roles (
      tenant_id, role, granular_permissions
    ) VALUES (
      ${tenantId}, ${roleData.role}, ${JSON.stringify(roleData.granular_permissions)}::jsonb
    )
    ON CONFLICT (tenant_id, role) DO UPDATE SET
      granular_permissions = EXCLUDED.granular_permissions
  `;

  await logSystemAction(`Updated permissions for role: ${roleData.role}`);
  return { success: true };
}

export async function deleteRole(roleName: string) {
  const { error: rbacError, context } = await requirePermission('team', 'manage');
  if (rbacError || !context) throw new Error(rbacError || "Unauthorized");

  const { tenantId } = context;

  // Don't allow deleting base roles this way, just their custom overrides
  await sql`DELETE FROM tenant_roles WHERE tenant_id = ${tenantId} AND LOWER(role) = LOWER(${roleName})`;

  await logSystemAction(`Deleted custom role override: ${roleName}`);
  return { success: true };
}
