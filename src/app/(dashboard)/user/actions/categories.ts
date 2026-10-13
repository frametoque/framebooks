"use server";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import { getTenantId } from "./actions";

export async function getCategories(type?: 'expense' | 'income' | 'all') {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  if (type && type !== 'all') {
    const rows = await sql`
      SELECT name 
      FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND (type = ${type} OR type = 'all')
      ORDER BY name ASC
    `;
    return rows.map((r: any) => r.name);
  }

  const rows = await sql`
    SELECT name 
    FROM tenant_categories 
    WHERE tenant_id = ${tenantId}
    ORDER BY name ASC
  `;
  return rows.map((r: any) => r.name);
}

export async function createCategory(name: string, type: 'expense' | 'income' | 'all' = 'expense') {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  if (!name || name.trim() === '') return;
  
  await sql`
    INSERT INTO tenant_categories (tenant_id, name, type)
    VALUES (${tenantId}, ${name.trim()}, ${type})
    ON CONFLICT (tenant_id, name, type) DO NOTHING
  `;
}

export async function deleteCategory(name: string, type?: 'expense' | 'income' | 'all') {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  if (type && type !== 'all') {
    await sql`
      DELETE FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND name = ${name} AND (type = ${type} OR type = 'all')
    `;
  } else {
    await sql`
      DELETE FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND name = ${name}
    `;
  }
}
