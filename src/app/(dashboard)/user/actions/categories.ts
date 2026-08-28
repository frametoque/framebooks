"use server";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import {  auth  } from '@/lib/auth';
import { logSystemAction } from "@/lib/logger";

async function getTenantId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  const userRows = await sql`SELECT tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
  if (!userRows || userRows.length === 0) {
    const defaultTenant = await sql`SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`;
    if (defaultTenant.length > 0) return defaultTenant[0].id;
    throw new Error("No tenant found for user");
  }
  return userRows[0].tenant_id;
}

export async function getCategories() {
  const tenantId = await getTenantId();
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
