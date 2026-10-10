"use server";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import { getTenantId } from "./actions";

export async function getCategories() {
  const tenantId = await getTenantId();
  if (!tenantId) return [];
  const rows = await sql`
    SELECT name 
    FROM tenant_categories 
    WHERE tenant_id = ${tenantId}
    ORDER BY name ASC
  `;
  return rows.map((r: any) => r.name);
}

export async function createCategory(name: string) {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  if (!name || name.trim() === '') return;
  
  await sql`
    INSERT INTO tenant_categories (tenant_id, name, type)
    VALUES (${tenantId}, ${name.trim()}, 'all')
    ON CONFLICT (tenant_id, name) DO NOTHING
  `;
}

export async function deleteCategory(name: string) {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  await sql`
    DELETE FROM tenant_categories 
    WHERE tenant_id = ${tenantId} AND name = ${name}
  `;
}
