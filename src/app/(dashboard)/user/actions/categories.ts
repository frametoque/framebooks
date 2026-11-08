"use server";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { deduplicateCategories, canonicalizeCategory } from "@/lib/categoryUtils";

export async function getCategories(type?: 'expense' | 'income' | 'all') {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  let rows;
  if (type && type !== 'all') {
    rows = await sql`
      SELECT name 
      FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND (type = ${type} OR type = 'all')
      ORDER BY name ASC
    `;
  } else {
    rows = await sql`
      SELECT name 
      FROM tenant_categories 
      WHERE tenant_id = ${tenantId}
      ORDER BY name ASC
    `;
  }
  const rawList = rows.map((r: any) => r.name);
  return deduplicateCategories(rawList).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function createCategory(name: string, type: 'expense' | 'income' | 'all' = 'expense') {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  const trimmed = name?.trim();
  if (!trimmed) return;

  const canonical = canonicalizeCategory(trimmed);
  
  // Case-insensitive check to avoid duplicate variations
  const existing = await sql`
    SELECT id FROM tenant_categories 
    WHERE tenant_id = ${tenantId} 
      AND LOWER(name) = LOWER(${trimmed})
      AND (type = ${type} OR type = 'all' OR ${type} = 'all')
    LIMIT 1
  `;
  if (existing.length > 0) return;

  await sql`
    INSERT INTO tenant_categories (tenant_id, name, type)
    VALUES (${tenantId}, ${canonical}, ${type})
    ON CONFLICT (tenant_id, name, type) DO NOTHING
  `;
}

export async function deleteCategory(name: string, type?: 'expense' | 'income' | 'all') {
  const { error: rbacError } = await requirePermission('settings', 'manage');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  const trimmed = name?.trim();
  if (!trimmed) return;

  if (type && type !== 'all') {
    await sql`
      DELETE FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND LOWER(name) = LOWER(${trimmed}) AND (type = ${type} OR type = 'all')
    `;
  } else {
    await sql`
      DELETE FROM tenant_categories 
      WHERE tenant_id = ${tenantId} AND LOWER(name) = LOWER(${trimmed})
    `;
  }
}
