// src/app/(dashboard)/admin/subscriptions/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getSubscriptionsList({
  search = "",
  plan = "",
  status = "",
  interval = "",
  page = 1,
  limit = 15,
}: {
  search?: string;
  plan?: string;
  status?: string;
  interval?: string;
  page?: number;
  limit?: number;
}) {
  await requireAdmin("view_subscriptions");

  const offset = (Math.max(1, page) - 1) * limit;
  const searchPattern = search ? `%${search.trim()}%` : null;

  const subscriptions = await sql`
    SELECT 
      s.*,
      p.name AS plan_name,
      p.key AS plan_key,
      p.price_monthly,
      p.price_yearly,
      t.name AS tenant_name,
      u.email AS user_email,
      u.full_name AS user_name
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    LEFT JOIN tenants t ON s.tenant_id = t.id
    LEFT JOIN admin_users u ON s.user_id = u.id
    WHERE (${searchPattern}::text IS NULL OR t.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u.full_name ILIKE ${searchPattern})
      AND (${plan || null}::text IS NULL OR p.key = ${plan} OR LOWER(p.name) = LOWER(${plan}))
      AND (${status || null}::text IS NULL OR s.status = ${status})
      AND (${interval || null}::text IS NULL OR s.billing_interval = ${interval})
    ORDER BY s.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalCountResult = await sql`
    SELECT COUNT(*)
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    LEFT JOIN tenants t ON s.tenant_id = t.id
    LEFT JOIN admin_users u ON s.user_id = u.id
    WHERE (${searchPattern}::text IS NULL OR t.name ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u.full_name ILIKE ${searchPattern})
      AND (${plan || null}::text IS NULL OR p.key = ${plan} OR LOWER(p.name) = LOWER(${plan}))
      AND (${status || null}::text IS NULL OR s.status = ${status})
      AND (${interval || null}::text IS NULL OR s.billing_interval = ${interval})
  `;

  const totalCount = parseInt(totalCountResult[0].count);

  return {
    subscriptions,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
  };
}

export async function checkDowngradeEligibility(tenantId: number, targetPlanKey: string) {
  await requireAdmin("view_subscriptions");

  const planRows = await sql`SELECT * FROM plans WHERE key = ${targetPlanKey} LIMIT 1`;
  if (planRows.length === 0) throw new Error("Plan not found");
  const targetPlan = planRows[0];
  const limits = targetPlan.limits || {};

  const [invCount, incCount, expCount, clientCount, accCount, teamCount] = await Promise.all([
    sql`SELECT COUNT(*) FROM invoices WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_clients WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM accounts WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_users WHERE tenant_id = ${tenantId}`,
  ]);

  const currentUsage = {
    invoices: parseInt(invCount[0].count) || 0,
    incomes: parseInt(incCount[0].count) || 0,
    expenses: parseInt(expCount[0].count) || 0,
    clients: parseInt(clientCount[0].count) || 0,
    accounts: parseInt(accCount[0].count) || 0,
    team_members: parseInt(teamCount[0].count) || 0,
  };

  const exceeded: Array<{ resource: string; current: number; max: number }> = [];

  Object.entries(limits).forEach(([resource, maxLimit]: [string, any]) => {
    const usageVal = (currentUsage as any)[resource] || 0;
    if (typeof maxLimit === "number" && maxLimit !== -1 && usageVal > maxLimit) {
      exceeded.push({ resource, current: usageVal, max: maxLimit });
    }
  });

  return {
    isEligible: exceeded.length === 0,
    exceeded,
    currentUsage,
    targetPlan,
  };
}

export async function changeSubscriptionPlan({
  subscriptionId,
  newPlanKey,
  interval,
  effectiveNow,
  isComp,
  customEndDate,
  reason,
  overrideLimits = false,
}: {
  subscriptionId: number;
  newPlanKey: string;
  interval: "monthly" | "yearly";
  effectiveNow: boolean;
  isComp: boolean;
  customEndDate?: string;
  reason: string;
  overrideLimits?: boolean;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  if (!reason.trim()) throw new Error("A reason is required for plan changes.");

  const subRows = await sql`
    SELECT s.*, p.key AS current_plan_key, p.name AS current_plan_name
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.id = ${subscriptionId}
    LIMIT 1
  `;
  if (subRows.length === 0) throw new Error("Subscription not found");
  const sub = subRows[0];

  const targetPlanRows = await sql`SELECT * FROM plans WHERE key = ${newPlanKey} LIMIT 1`;
  if (targetPlanRows.length === 0) throw new Error("Target plan not found");
  const targetPlan = targetPlanRows[0];

  // If downgrading, verify limits unless explicitly overridden
  if (!overrideLimits && sub.tenant_id) {
    const check = await checkDowngradeEligibility(sub.tenant_id, newPlanKey);
    if (!check.isEligible) {
      throw new Error(`LIMIT_EXCEEDED: Tenant exceeds limits for ${newPlanKey}: ${JSON.stringify(check.exceeded)}`);
    }
  }

  // Calculate new period end date
  let newEndDate = customEndDate ? new Date(customEndDate) : null;
  if (!newEndDate) {
    const base = effectiveNow ? new Date() : (sub.current_period_end ? new Date(sub.current_period_end) : new Date());
    newEndDate = new Date(base);
    if (interval === "yearly") {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    } else {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }
  }

  // Update subscription record
  await sql`
    UPDATE subscriptions SET
      plan_id = ${targetPlan.id},
      billing_interval = ${interval},
      current_period_end = ${newEndDate},
      status = 'active',
      source = ${isComp ? 'admin_comp' : 'admin'},
      updated_at = NOW()
    WHERE id = ${subscriptionId}
  `;

  // Also update tenant's active plan and expiration in tenants table
  if (sub.tenant_id) {
    await sql`
      UPDATE tenants SET
        plan = ${targetPlan.name},
        plan_expires_at = ${newEndDate}
      WHERE id = ${sub.tenant_id}
    `;
  }

  // Record subscription event audit
  await sql`
    INSERT INTO subscription_events (
      subscription_id, tenant_id, from_plan, to_plan, reason, changed_by, effective_at, proration_note
    )
    VALUES (
      ${subscriptionId},
      ${sub.tenant_id},
      ${sub.current_plan_name || sub.current_plan_key},
      ${targetPlan.name},
      ${reason},
      ${actor.email},
      NOW(),
      ${isComp ? "Comped by Admin" : "Standard Admin Update"}
    )
  `;

  await logAdminAction({
    actor,
    action: "CHANGE_SUBSCRIPTION_PLAN",
    targetType: "subscription",
    targetId: subscriptionId,
    before: { plan: sub.current_plan_name, interval: sub.billing_interval },
    after: { plan: targetPlan.name, interval, reason, isComp }
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function createManualSubscription({
  tenantId,
  planKey,
  interval,
  periodEnd,
  createPayment = false,
  paymentAmount,
  paymentMethod = "bank_transfer",
  paymentRef,
}: {
  tenantId: number;
  planKey: string;
  interval: "monthly" | "yearly";
  periodEnd?: string;
  createPayment?: boolean;
  paymentAmount?: number;
  paymentMethod?: string;
  paymentRef?: string;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  const planRows = await sql`SELECT * FROM plans WHERE key = ${planKey} LIMIT 1`;
  if (planRows.length === 0) throw new Error("Plan not found");
  const plan = planRows[0];

  const endDate = periodEnd ? new Date(periodEnd) : (() => {
    const d = new Date();
    if (interval === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    return d;
  })();

  const ownerRows = await sql`SELECT id FROM admin_users WHERE tenant_id = ${tenantId} LIMIT 1`;
  const userId = ownerRows.length > 0 ? ownerRows[0].id : null;

  // Insert subscription
  const subRows = await sql`
    INSERT INTO subscriptions (
      tenant_id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, source
    )
    VALUES (
      ${tenantId}, ${userId}, ${plan.id}, 'active', ${interval}, NOW(), ${endDate}, 'manual'
    )
    RETURNING id
  `;
  const subId = subRows[0].id;

  // Sync tenant table
  await sql`
    UPDATE tenants SET plan = ${plan.name}, plan_expires_at = ${endDate} WHERE id = ${tenantId}
  `;

  // Optional payment record creation
  if (createPayment && paymentAmount) {
    await sql`
      INSERT INTO payments (
        tenant_id, user_id, subscription_id, plan_id, amount, currency, method, provider, provider_reference, status, notes, paid_at
      )
      VALUES (
        ${tenantId}, ${userId}, ${subId}, ${plan.id}, ${paymentAmount}, 'LKR', ${paymentMethod}, 'manual', ${paymentRef || `MAN-${Date.now()}`}, 'paid', 'Manual payment recorded with subscription', NOW()
      )
    `;
  }

  await logAdminAction({
    actor,
    action: "CREATE_MANUAL_SUBSCRIPTION",
    targetType: "subscription",
    targetId: subId,
    after: { tenantId, plan: plan.name, interval, endDate }
  });

  revalidatePath("/admin/subscriptions");
  return { success: true };
}
