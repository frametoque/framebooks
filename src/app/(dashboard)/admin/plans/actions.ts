// src/app/(dashboard)/admin/plans/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath, revalidateTag } from "next/cache";

export async function getPlansWithStats() {
  await requireAdmin("view_plans");

  const plans = await sql`
    SELECT 
      p.*,
      COALESCE((
        SELECT COUNT(*) 
        FROM tenants t 
        WHERE LOWER(t.plan) = LOWER(p.name) OR LOWER(t.plan) = LOWER(p.key)
      ), 0) AS tenant_count,
      COALESCE((
        SELECT COUNT(*) 
        FROM subscriptions s 
        WHERE s.plan_id = p.id AND s.status = 'active'
      ), 0) AS active_sub_count
    FROM plans p
    ORDER BY p.sort_order ASC
  `;

  return plans.map(p => ({
    ...p,
    tenant_count: parseInt(p.tenant_count) || 0,
    active_sub_count: parseInt(p.active_sub_count) || 0,
  }));
}

export async function createPlan({
  name,
  key,
  description,
  priceMonthly,
  priceYearly,
  isPopular = false,
  isActive = true,
  sortOrder,
  limits,
  features,
}: {
  name: string;
  key?: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isPopular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  limits: any;
  features: any;
}) {
  const actor = await requireAdmin("edit_plans");

  const cleanName = name.trim();
  if (!cleanName) throw new Error("Plan name is required");
  if (priceMonthly < 0 || priceYearly < 0) throw new Error("Prices cannot be negative");

  // Generate unique plan key/slug
  let cleanKey = (key || cleanName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  if (!cleanKey) cleanKey = `plan_${Date.now()}`;

  // Check if key already exists
  const existingKey = await sql`SELECT id FROM plans WHERE key = ${cleanKey} LIMIT 1`;
  if (existingKey.length > 0) {
    cleanKey = `${cleanKey}_${Date.now().toString().slice(-4)}`;
  }

  // Determine sort order
  let calculatedSortOrder = sortOrder;
  if (!calculatedSortOrder) {
    const maxOrder = await sql`SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM plans`;
    calculatedSortOrder = (maxOrder[0]?.max_sort || 0) + 1;
  }

  const defaultLimits = {
    invoices: limits?.invoices ?? 50,
    quotations: limits?.quotations ?? 50,
    incomes: limits?.incomes ?? 100,
    expenses: limits?.expenses ?? 100,
    clients: limits?.clients ?? 50,
    accounts: limits?.accounts ?? 2,
    team_members: limits?.team_members ?? 0,
  };

  const defaultFeatures = {
    inventory: !!features?.inventory,
    advanced_reports: !!features?.advanced_reports,
    two_factor: !!features?.two_factor,
    audit_logs: !!features?.audit_logs,
  };

  // Insert plan into plans table
  const rows = await sql`
    INSERT INTO plans (
      key, name, description, price_monthly, price_yearly, currency,
      is_active, is_popular, sort_order, limits, features, created_at, updated_at
    )
    VALUES (
      ${cleanKey},
      ${cleanName},
      ${description || ""},
      ${priceMonthly},
      ${priceYearly},
      'LKR',
      ${isActive},
      ${isPopular},
      ${calculatedSortOrder},
      ${sql.json(defaultLimits)},
      ${sql.json(defaultFeatures)},
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  const newPlanId = rows[0].id;

  // Sync plan_limits table
  await sql`
    INSERT INTO plan_limits (
      plan, max_invoices, max_quotations, max_incomes, max_expenses, max_clients, max_accounts,
      can_add_team_members, has_inventory, has_advanced_stats
    ) VALUES (
      ${cleanName},
      ${defaultLimits.invoices ?? -1},
      ${defaultLimits.quotations ?? -1},
      ${defaultLimits.incomes ?? -1},
      ${defaultLimits.expenses ?? -1},
      ${defaultLimits.clients ?? -1},
      ${defaultLimits.accounts ?? -1},
      ${defaultLimits.team_members === 0 ? 0 : 1},
      ${defaultFeatures.inventory ? 1 : 0},
      ${defaultFeatures.advanced_reports ? 1 : 0}
    )
    ON CONFLICT (plan) DO UPDATE SET
      max_invoices = EXCLUDED.max_invoices,
      max_quotations = EXCLUDED.max_quotations,
      max_incomes = EXCLUDED.max_incomes,
      max_expenses = EXCLUDED.max_expenses,
      max_clients = EXCLUDED.max_clients,
      max_accounts = EXCLUDED.max_accounts,
      can_add_team_members = EXCLUDED.can_add_team_members,
      has_inventory = EXCLUDED.has_inventory,
      has_advanced_stats = EXCLUDED.has_advanced_stats
  `.catch((err) => {
    console.error("Failed to sync plan_limits for new plan:", err);
  });

  await logAdminAction({
    actor,
    action: "CREATE_PLAN",
    targetType: "plan",
    targetId: newPlanId,
    after: {
      name: cleanName,
      key: cleanKey,
      priceMonthly,
      priceYearly,
      isPopular,
      isActive,
      limits: defaultLimits,
      features: defaultFeatures,
    },
  });

  try { (revalidateTag as any)("plans-all"); } catch {}
  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/user/settings");

  return { success: true, id: newPlanId };
}

export async function updatePlan({
  id,
  name,
  description,
  priceMonthly,
  priceYearly,
  isPopular,
  isActive,
  sortOrder,
  limits,
  features,
  applyToExisting = false,
}: {
  id: number;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isPopular: boolean;
  isActive: boolean;
  sortOrder?: number;
  limits: any;
  features: any;
  applyToExisting?: boolean;
}) {
  const actor = await requireAdmin("edit_plans");

  const existingRows = await sql`SELECT * FROM plans WHERE id = ${id} LIMIT 1`;
  if (existingRows.length === 0) throw new Error("Plan not found");
  const before = existingRows[0];

  // Update plan record
  await sql`
    UPDATE plans SET
      name = ${name},
      description = ${description},
      price_monthly = ${priceMonthly},
      price_yearly = ${priceYearly},
      is_popular = ${isPopular},
      is_active = ${isActive},
      sort_order = COALESCE(${sortOrder}, sort_order),
      limits = ${sql.json(limits)},
      features = ${sql.json(features)},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  // Sync plan_limits table for backward compatibility with checkLimit()
  await sql`
    INSERT INTO plan_limits (
      plan, max_invoices, max_quotations, max_incomes, max_expenses, max_clients, max_accounts,
      can_add_team_members, has_inventory, has_advanced_stats
    ) VALUES (
      ${name},
      ${limits.invoices ?? -1},
      ${limits.quotations ?? -1},
      ${limits.incomes ?? -1},
      ${limits.expenses ?? -1},
      ${limits.clients ?? -1},
      ${limits.accounts ?? -1},
      ${limits.team_members === 0 ? 0 : 1},
      ${features.inventory ? 1 : 0},
      ${features.advanced_reports ? 1 : 0}
    )
    ON CONFLICT (plan) DO UPDATE SET
      max_invoices = EXCLUDED.max_invoices,
      max_quotations = EXCLUDED.max_quotations,
      max_incomes = EXCLUDED.max_incomes,
      max_expenses = EXCLUDED.max_expenses,
      max_clients = EXCLUDED.max_clients,
      max_accounts = EXCLUDED.max_accounts,
      can_add_team_members = EXCLUDED.can_add_team_members,
      has_inventory = EXCLUDED.has_inventory,
      has_advanced_stats = EXCLUDED.has_advanced_stats
  `.catch(() => {});

  if (before.name !== name) {
    await sql`
      UPDATE plan_limits SET
        plan = ${name}
      WHERE LOWER(plan) = LOWER(${before.name})
    `.catch(() => {});
  }

  await logAdminAction({
    actor,
    action: "UPDATE_PLAN",
    targetType: "plan",
    targetId: id,
    before,
    after: {
      name,
      priceMonthly,
      priceYearly,
      isPopular,
      isActive,
      limits,
      features,
      applyToExisting,
    }
  });

  try { (revalidateTag as any)("plans-all"); } catch {}
  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/user/settings");
  return { success: true };
}

export async function togglePlanActive(id: number, isActive: boolean) {
  const actor = await requireAdmin("edit_plans");

  await sql`UPDATE plans SET is_active = ${isActive}, updated_at = NOW() WHERE id = ${id}`;

  await logAdminAction({
    actor,
    action: isActive ? "ACTIVATE_PLAN" : "DEACTIVATE_PLAN",
    targetType: "plan",
    targetId: id,
    after: { is_active: isActive }
  });

  try { (revalidateTag as any)("plans-all"); } catch {}
  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/user/settings");
  return { success: true };
}

export async function deletePlan(id: number) {
  const actor = await requireAdmin("edit_plans");

  const existingRows = await sql`SELECT * FROM plans WHERE id = ${id} LIMIT 1`;
  if (existingRows.length === 0) throw new Error("Plan not found");
  const plan = existingRows[0];

  // Check if any business is using this plan
  const tenantsInUse = await sql`
    SELECT COUNT(*) as count 
    FROM tenants 
    WHERE LOWER(plan) = LOWER(${plan.name}) OR LOWER(plan) = LOWER(${plan.key})
  `;

  if (parseInt(tenantsInUse[0]?.count || "0") > 0) {
    throw new Error(`Cannot delete "${plan.name}" because ${tenantsInUse[0].count} business(es) are currently using it. Please deactivate the plan instead.`);
  }

  await sql`DELETE FROM plans WHERE id = ${id}`;
  await sql`DELETE FROM plan_limits WHERE LOWER(plan) = LOWER(${plan.name}) OR LOWER(plan) = LOWER(${plan.key})`.catch(() => {});

  await logAdminAction({
    actor,
    action: "DELETE_PLAN",
    targetType: "plan",
    targetId: id,
    before: plan
  });

  try { (revalidateTag as any)("plans-all"); } catch {}
  revalidatePath("/admin/plans");
  revalidatePath("/");
  revalidatePath("/user/settings");
  return { success: true };
}
