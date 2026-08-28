"use server";
import { requirePermission } from "./rbac";
import sql from "@/lib/db";
import { auth } from '@/lib/auth';
import { logSystemAction } from "@/lib/logger";

export async function getRoles() {
  const { error: rbacError, context } = await requirePermission('team', 'manage');
  if (rbacError || !context) throw new Error(rbacError || "Unauthorized");

  const { tenantId } = context;

  // Fetch base roles
  const baseRoles = await sql`SELECT role, granular_permissions FROM role_permissions`;
  
  // Default fallback if table is empty
  const defaultRoles = [
    {
      role: "Admin",
      granular_permissions: {
        invoices: { read: true, insert: true, update: true, delete: true },
        incomes: { read: true, insert: true, update: true, delete: true },
        expenses: { read: true, insert: true, update: true, delete: true },
        clients: { read: true, insert: true, update: true, delete: true },
        accounts: { read: true, insert: true, update: true, delete: true },
        inventory: { read: true, insert: true, update: true, delete: true },
        settings: { manage: true },
        team: { manage: true },
        export: { data: true },
      }
    },
    {
      role: "Editor",
      granular_permissions: {
        invoices: { read: true, insert: true, update: true, delete: false },
        incomes: { read: true, insert: true, update: true, delete: false },
        expenses: { read: true, insert: true, update: true, delete: false },
        clients: { read: true, insert: true, update: true, delete: false },
        accounts: { read: true, insert: false, update: false, delete: false },
        inventory: { read: true, insert: true, update: true, delete: false },
      }
    },
    {
      role: "Viewer",
      granular_permissions: {
        invoices: { read: true, insert: false, update: false, delete: false },
        incomes: { read: true, insert: false, update: false, delete: false },
        expenses: { read: true, insert: false, update: false, delete: false },
        clients: { read: true, insert: false, update: false, delete: false },
        accounts: { read: true, insert: false, update: false, delete: false },
        inventory: { read: true, insert: false, update: false, delete: false },
      }
    }
  ];

  const effectiveBaseRoles = baseRoles.length > 0 ? baseRoles : defaultRoles;

  // Fetch tenant custom overrides
  const customRoles = await sql`SELECT role, granular_permissions FROM tenant_roles WHERE tenant_id = ${tenantId}`;

  // Merge them. Custom roles override base roles.
  const rolesMap = new Map();
  for (const r of effectiveBaseRoles) {
    let perms = r.granular_permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch (e) {}
    }
    rolesMap.set(r.role.toLowerCase(), { ...r, granular_permissions: perms, isCustom: false });
  }

  for (const r of customRoles) {
    let perms = r.granular_permissions;
    if (typeof perms === 'string') {
      try { perms = JSON.parse(perms); } catch (e) {}
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
