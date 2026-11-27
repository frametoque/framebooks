// src/app/(dashboard)/admin/subscriptions/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";
import { grantPosAddon, revokePosAddon } from "@/lib/pos/entitlement";

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

export async function getWorkspacesAndSubscriptionsList({
  search = "",
  plan = "",
  status = "",
  role = "",
  banned = "",
  page = 1,
  limit = 20,
  sortBy = "created_at",
  sortOrder = "desc",
}: {
  search?: string;
  plan?: string;
  status?: string;
  role?: string;
  banned?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}) {
  await requireAdmin("view_subscriptions");

  const offset = (Math.max(1, page) - 1) * limit;
  const searchPattern = search ? `%${search.trim()}%` : null;

  // 1. All tenants with their latest subscription, latest coupon, and owner user
  const tenants = await sql`
    SELECT 
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.logo_url AS tenant_logo_url,
      COALESCE(t.plan, 'Free') AS current_plan,
      t.payment_status,
      t.plan_expires_at,
      t.owner_email,
      t.created_at,
      s.id AS subscription_id,
      COALESCE(s.status, 'active') AS subscription_status,
      s.billing_interval,
      s.source AS subscription_source,
      s.current_period_end,
      cp.coupon_code,
      cp.coupon_type,
      cp.coupon_value,
      u.id AS id,
      COALESCE(u.email, t.owner_email) AS email,
      COALESCE(u.full_name, t.name) AS full_name,
      COALESCE(u.role, 'owner') AS workspace_role,
      u.system_role,
      u.is_banned,
      COALESCE((
        SELECT SUM(p.amount) 
        FROM payments p 
        WHERE p.tenant_id = t.id AND p.status = 'paid'
      ), 0) AS lifetime_paid,
      EXISTS (
        SELECT 1 
        FROM tenant_addons 
        WHERE tenant_id = t.id AND addon_key = 'pos' AND status = 'active' 
          AND (expires_at IS NULL OR expires_at > NOW())
      ) AS pos_active
    FROM tenants t
    LEFT JOIN LATERAL (
      SELECT id, status, billing_interval, source, current_period_end 
      FROM subscriptions 
      WHERE tenant_id = t.id 
      ORDER BY id DESC 
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT c.code AS coupon_code, c.type AS coupon_type, c.value AS coupon_value
      FROM coupon_redemptions cr
      JOIN coupons c ON cr.coupon_id = c.id
      WHERE cr.tenant_id = t.id
      ORDER BY cr.redeemed_at DESC
      LIMIT 1
    ) cp ON true
    LEFT JOIN LATERAL (
      SELECT id, email, full_name, role, system_role, is_banned
      FROM admin_users 
      WHERE (tenant_id = t.id AND role = 'owner')
         OR (email IS NOT NULL AND t.owner_email IS NOT NULL AND LOWER(email) = LOWER(t.owner_email))
      ORDER BY CASE WHEN LOWER(email) = LOWER(t.owner_email) THEN 0 ELSE 1 END
      LIMIT 1
    ) u ON true
    WHERE (${searchPattern}::text IS NULL OR t.name ILIKE ${searchPattern} OR t.owner_email ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR u.full_name ILIKE ${searchPattern})
      AND (${plan || null}::text IS NULL OR LOWER(t.plan) = LOWER(${plan}))
      AND (${status || null}::text IS NULL OR LOWER(s.status) = LOWER(${status}))
  `;

  // 2. Additional members who have active tenant_id matching one of the tenants
  const tenantIds = tenants.map((t: any) => t.tenant_id).filter(Boolean);
  const matchedUserIds = tenants.map((t: any) => t.id).filter(Boolean);
  let additionalMembers: any[] = [];
  if (tenantIds.length > 0) {
    additionalMembers = await sql`
      SELECT 
        u.tenant_id,
        t.name AS tenant_name,
        t.logo_url AS tenant_logo_url,
        COALESCE(t.plan, 'Free') AS current_plan,
        t.payment_status,
        t.plan_expires_at,
        t.owner_email,
        u.created_at,
        NULL::integer AS subscription_id,
        'active'::text AS subscription_status,
        NULL::text AS billing_interval,
        NULL::text AS subscription_source,
        NULL::timestamp AS current_period_end,
        NULL::text AS coupon_code,
        NULL::text AS coupon_type,
        NULL::numeric AS coupon_value,
        u.id AS id,
        u.email,
        u.full_name,
        COALESCE(u.role, 'member') AS workspace_role,
        u.system_role,
        u.is_banned,
        0::numeric AS lifetime_paid,
        EXISTS (
          SELECT 1 
          FROM tenant_addons 
          WHERE tenant_id = t.id AND addon_key = 'pos' AND status = 'active' 
            AND (expires_at IS NULL OR expires_at > NOW())
        ) AS pos_active
      FROM admin_users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE u.tenant_id = ANY(${tenantIds})
        AND u.deleted_at IS NULL
        AND (${matchedUserIds.length > 0 ? sql`u.id != ALL(${matchedUserIds})` : sql`true`})
    `;
  }

  // Combine tenants and additional members (only actual workspaces)
  const allRows = [...tenants, ...additionalMembers];

  // Map to distinct workspaces for pagination count
  const uniqueKeys = new Set(allRows.map((r: any) => r.tenant_id).filter(Boolean));
  const totalCount = uniqueKeys.size;

  return {
    users: allRows,
    totalCount,
    totalPages: Math.ceil(totalCount / limit) || 1,
    page,
  };
}

export async function checkDowngradeEligibility(tenantId: number, targetPlanKey: string) {
  await requireAdmin("view_subscriptions");

  if (!tenantId || !targetPlanKey) {
    return {
      isEligible: true,
      exceeded: [],
      currentUsage: {
        invoices: 0,
        incomes: 0,
        expenses: 0,
        clients: 0,
        accounts: 0,
        team_members: 0,
      },
      targetPlan: null,
    };
  }

  const planRows = await sql`
    SELECT * FROM plans 
    WHERE key = ${targetPlanKey} OR LOWER(name) = LOWER(${targetPlanKey}) 
    LIMIT 1
  `;
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

export async function getTenantPosStatusAction(tenantId: number) {
  await requireAdmin("view_subscriptions");
  const rows = await sql`
    SELECT status, expires_at 
    FROM tenant_addons 
    WHERE tenant_id = ${tenantId} AND addon_key = 'pos' 
    LIMIT 1
  `;
  if (rows.length === 0) return { active: false, status: 'none' };
  const r = rows[0];
  const isExpired = r.expires_at ? new Date(r.expires_at) < new Date() : false;
  return {
    active: r.status === 'active' && !isExpired,
    status: isExpired ? 'suspended' : r.status,
  };
}

export async function changeSubscriptionPlan({
  subscriptionId,
  tenantId,
  newPlanKey,
  interval,
  effectiveNow,
  isComp,
  customEndDate,
  reason,
  overrideLimits = false,
  enablePos,
}: {
  subscriptionId?: number;
  tenantId?: number;
  newPlanKey: string;
  interval: "monthly" | "yearly";
  effectiveNow: boolean;
  isComp: boolean;
  customEndDate?: string;
  reason: string;
  overrideLimits?: boolean;
  enablePos?: boolean;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  if (!reason?.trim()) throw new Error("A reason is required for plan changes.");

  // Look up subscription if ID was provided
  let sub: any = null;
  if (subscriptionId && Number(subscriptionId) > 0) {
    const subRows = await sql`
      SELECT s.*, p.key AS current_plan_key, p.name AS current_plan_name
      FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.id = ${Number(subscriptionId)}
      LIMIT 1
    `;
    if (subRows.length > 0) {
      sub = subRows[0];
    }
  }

  // Fallback to finding subscription by tenantId
  const effectiveTenantId = tenantId || sub?.tenant_id;
  if (!sub && effectiveTenantId) {
    const subRows = await sql`
      SELECT s.*, p.key AS current_plan_key, p.name AS current_plan_name
      FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
      WHERE s.tenant_id = ${effectiveTenantId}
      ORDER BY s.id DESC
      LIMIT 1
    `;
    if (subRows.length > 0) {
      sub = subRows[0];
    }
  }

  if (!sub && !effectiveTenantId) {
    throw new Error("Subscription or workspace not found");
  }

  // Verify workspace exists
  let tenant: any = null;
  if (effectiveTenantId) {
    const tenantRows = await sql`SELECT * FROM tenants WHERE id = ${effectiveTenantId} LIMIT 1`;
    if (tenantRows.length > 0) {
      tenant = tenantRows[0];
    }
  }

  // Target plan lookup
  const targetPlanRows = await sql`
    SELECT * FROM plans 
    WHERE key = ${newPlanKey} OR LOWER(name) = LOWER(${newPlanKey}) 
    LIMIT 1
  `;
  if (targetPlanRows.length === 0) throw new Error("Target plan not found");
  const targetPlan = targetPlanRows[0];

  // If downgrading, verify limits unless explicitly overridden
  if (!overrideLimits && effectiveTenantId) {
    const check = await checkDowngradeEligibility(effectiveTenantId, newPlanKey);
    if (!check.isEligible) {
      throw new Error(`LIMIT_EXCEEDED: Tenant exceeds limits for ${newPlanKey}: ${JSON.stringify(check.exceeded)}`);
    }
  }

  // Calculate new period end date
  let newEndDate: Date | null = customEndDate ? new Date(customEndDate) : null;
  if (!newEndDate || isNaN(newEndDate.getTime())) {
    const base = effectiveNow ? new Date() : (sub?.current_period_end ? new Date(sub.current_period_end) : new Date());
    newEndDate = new Date(base);
    if (interval === "yearly") {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    } else {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }
  }

  let activeSubId: number;

  if (sub) {
    // Update existing subscription record
    await sql`
      UPDATE subscriptions SET
        plan_id = ${targetPlan.id},
        billing_interval = ${interval},
        current_period_end = ${newEndDate},
        status = 'active',
        source = ${isComp ? 'admin_comp' : 'admin'},
        updated_at = NOW()
      WHERE id = ${sub.id}
    `;
    activeSubId = sub.id;
  } else {
    // Create new subscription record if workspace didn't have one
    const userRows = await sql`
      SELECT id FROM admin_users 
      WHERE tenant_id = ${effectiveTenantId} AND deleted_at IS NULL
      ORDER BY (CASE WHEN role = 'owner' THEN 1 ELSE 2 END), id ASC 
      LIMIT 1
    `;
    const ownerUserId = userRows[0]?.id || null;

    const newSubRows = await sql`
      INSERT INTO subscriptions (
        tenant_id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, source, created_at, updated_at
      )
      VALUES (
        ${effectiveTenantId},
        ${ownerUserId},
        ${targetPlan.id},
        'active',
        ${interval},
        NOW(),
        ${newEndDate},
        ${isComp ? 'admin_comp' : 'admin'},
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    activeSubId = newSubRows[0].id;
  }

  // Also update tenant's active plan and expiration in tenants table
  if (effectiveTenantId) {
    await sql`
      UPDATE tenants SET
        plan = ${targetPlan.name},
        plan_expires_at = ${newEndDate}
      WHERE id = ${effectiveTenantId}
    `;

    // Handle POS Add-on activation / deactivation if requested
    if (typeof enablePos === "boolean") {
      if (enablePos) {
        await grantPosAddon(effectiveTenantId);
      } else {
        await revokePosAddon(effectiveTenantId);
      }
    }
  }

  // Record subscription event audit
  const fromPlan = sub?.current_plan_name || sub?.current_plan_key || tenant?.plan || 'Free';
  await sql`
    INSERT INTO subscription_events (
      subscription_id, tenant_id, from_plan, to_plan, reason, changed_by, effective_at, proration_note
    )
    VALUES (
      ${activeSubId},
      ${effectiveTenantId || null},
      ${fromPlan},
      ${targetPlan.name},
      ${reason.trim()},
      ${actor?.email || 'admin'},
      NOW(),
      ${isComp ? "Comped by Admin" : "Standard Admin Update"}
    )
  `;

  await logAdminAction({
    actor,
    action: "CHANGE_SUBSCRIPTION_PLAN",
    targetType: "subscription",
    targetId: activeSubId,
    before: { plan: fromPlan, interval: sub?.billing_interval || 'monthly' },
    after: { plan: targetPlan.name, interval, reason: reason.trim(), isComp }
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  if (effectiveTenantId) {
    revalidatePath(`/admin/businesses/${effectiveTenantId}`);
  }
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

export async function adminRevokeTenantCoupon({
  tenantId,
  reason = "Coupon removed by admin to require payment",
  expireImmediately = true,
}: {
  tenantId: number;
  reason?: string;
  expireImmediately?: boolean;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  const redemptions = await sql`
    SELECT cr.id AS redemption_id, cr.coupon_id, c.code, c.value, c.type
    FROM coupon_redemptions cr
    JOIN coupons c ON cr.coupon_id = c.id
    WHERE cr.tenant_id = ${tenantId}
    ORDER BY cr.redeemed_at DESC
  `;

  if (redemptions.length === 0) {
    throw new Error("No applied coupon found for this business.");
  }

  const redemption = redemptions[0];

  // 1. Delete all coupon redemptions for this tenant
  await sql`DELETE FROM coupon_redemptions WHERE tenant_id = ${tenantId}`;
  
  // 2. Decrement redeemed_count on the coupon
  await sql`UPDATE coupons SET redeemed_count = GREATEST(0, redeemed_count - 1) WHERE id = ${redemption.coupon_id}`;

  // 3. Update subscription if it was comped or has long expiration
  const subRows = await sql`
    SELECT s.*, p.name AS plan_name, p.key AS plan_key
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.tenant_id = ${tenantId}
    ORDER BY s.id DESC
    LIMIT 1
  `;

  if (subRows.length > 0) {
    const sub = subRows[0];
    const newEndDate = expireImmediately ? new Date() : (sub.current_period_end ? new Date(sub.current_period_end) : new Date());

    await sql`
      UPDATE subscriptions SET
        source = 'standard',
        status = ${expireImmediately ? 'past_due' : 'active'},
        current_period_end = ${newEndDate},
        updated_at = NOW()
      WHERE id = ${sub.id}
    `;

    if (expireImmediately) {
      await sql`
        UPDATE tenants SET
          plan_expires_at = ${newEndDate}
        WHERE id = ${tenantId}
      `;
    }

    // Record subscription event
    await sql`
      INSERT INTO subscription_events (
        subscription_id, tenant_id, from_plan, to_plan, reason, changed_by, effective_at, proration_note
      ) VALUES (
        ${sub.id},
        ${tenantId},
        ${sub.plan_name || 'Current'},
        ${sub.plan_name || 'Current'},
        ${reason},
        ${actor.email},
        NOW(),
        ${`Revoked coupon ${redemption.code} (${redemption.value}% off). Subscription set to ${expireImmediately ? 'past_due (Payment Required)' : 'standard billing'}.`}
      )
    `;
  } else {
    if (expireImmediately) {
      await sql`
        UPDATE tenants SET
          plan_expires_at = NOW()
        WHERE id = ${tenantId}
      `;
    }
  }

  await logAdminAction({
    actor,
    action: "REVOKE_COUPON",
    targetType: "tenant",
    targetId: tenantId,
    before: { coupon_code: redemption.code, discount: `${redemption.value}%` },
    after: { coupon_code: null, payment_required: true, reason }
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/businesses/${tenantId}`);
  return { success: true, removedCoupon: redemption.code };
}

export async function applyTenantCoupon({
  tenantId,
  couponCode,
  reason = "",
}: {
  tenantId: number;
  couponCode: string;
  reason?: string;
}) {
  const actor = await requireAdmin("manage_subscriptions");
  const cleanCode = couponCode.trim().toUpperCase();
  if (!cleanCode) throw new Error("Coupon code is required");

  const couponRows = await sql`
    SELECT * FROM coupons 
    WHERE UPPER(code) = ${cleanCode} AND is_active = true 
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_to IS NULL OR valid_to > NOW())
    AND (max_redemptions IS NULL OR redeemed_count <= max_redemptions)
    LIMIT 1
  `;
  if (couponRows.length === 0) {
    throw new Error("Invalid or inactive coupon code.");
  }
  const coupon = couponRows[0];

  // 1. Record redemption in coupon_redemptions
  await sql`DELETE FROM coupon_redemptions WHERE tenant_id = ${tenantId}`;
  await sql`
    INSERT INTO coupon_redemptions (coupon_id, tenant_id, redeemed_at)
    VALUES (${coupon.id}, ${tenantId}, NOW())
  `;
  await sql`
    UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${coupon.id}
  `;

  // 2. Attach to subscriptions table
  const subRows = await sql`SELECT id FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY id DESC LIMIT 1`;
  if (subRows.length > 0) {
    await sql`
      UPDATE subscriptions 
      SET coupon_code = ${coupon.code}, updated_at = NOW() 
      WHERE id = ${subRows[0].id}
    `;
  } else {
    const t = await sql`SELECT plan FROM tenants WHERE id = ${tenantId} LIMIT 1`;
    const planName = t[0]?.plan || "Free";
    const pRows = await sql`SELECT id FROM plans WHERE LOWER(name) = LOWER(${planName}) LIMIT 1`;
    const planId = pRows[0]?.id || 1;
    await sql`
      INSERT INTO subscriptions (
        tenant_id, plan_id, status, billing_interval,
        current_period_start, current_period_end, coupon_code, created_at, updated_at
      ) VALUES (
        ${tenantId}, ${planId}, 'active', 'monthly',
        NOW(), NOW() + interval '30 days', ${coupon.code}, NOW(), NOW()
      )
    `;
  }

  // 3. Log admin action
  await logAdminAction({
    actor,
    action: "APPLY_COUPON",
    targetType: "tenant",
    targetId: tenantId,
    after: { coupon_code: coupon.code, value: coupon.value, type: coupon.type, reason },
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/businesses/${tenantId}`);
  revalidatePath("/user/settings");
  revalidatePath("/user/settings/billing");

  return { success: true, coupon };
}

export async function adminToggleTenantPaymentStatus({
  tenantId,
  paymentStatus,
  reason = "",
}: {
  tenantId: number;
  paymentStatus: "pending_payment" | "paid";
  reason?: string;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  const tenantRows = await sql`SELECT id, name, plan, payment_status FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  if (tenantRows.length === 0) throw new Error("Business not found");
  const tenant = tenantRows[0];

  const prevStatus = tenant.payment_status || "paid";

  // Ensure column exists & update tenants
  await sql`UPDATE tenants SET payment_status = ${paymentStatus} WHERE id = ${tenantId}`;

  // Update subscription table status
  const subRows = await sql`
    SELECT id, status, plan_id 
    FROM subscriptions 
    WHERE tenant_id = ${tenantId} 
    ORDER BY id DESC 
    LIMIT 1
  `;

  if (subRows.length > 0) {
    const sub = subRows[0];
    const newSubStatus = paymentStatus === "pending_payment" ? "past_due" : "active";
    await sql`
      UPDATE subscriptions 
      SET status = ${newSubStatus}, updated_at = NOW() 
      WHERE id = ${sub.id}
    `;

    // Record subscription event
    await sql`
      INSERT INTO subscription_events (
        subscription_id, tenant_id, from_plan, to_plan, reason, changed_by, effective_at, proration_note
      ) VALUES (
        ${sub.id},
        ${tenantId},
        ${tenant.plan || 'Current'},
        ${tenant.plan || 'Current'},
        ${reason || (paymentStatus === 'pending_payment' ? 'Admin flagged business as pending payment' : 'Admin cleared pending payment')},
        ${actor.email},
        NOW(),
        ${paymentStatus === 'pending_payment' ? 'Pending Payment: Workspace set to View-Only mode' : 'Payment Cleared: Full workspace access restored'}
      )
    `;
  }

  // Audit log
  await logAdminAction({
    actor,
    action: paymentStatus === "pending_payment" ? "SET_PENDING_PAYMENT" : "SET_PAID_STATUS",
    targetType: "tenant",
    targetId: tenantId,
    before: { payment_status: prevStatus },
    after: { payment_status: paymentStatus, reason: reason || undefined },
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/businesses/${tenantId}`);
  revalidatePath("/user");

  return { success: true, paymentStatus };
}

export async function adminDeleteBusiness({
  tenantId,
  confirmName,
  reason = "",
}: {
  tenantId: number;
  confirmName: string;
  reason?: string;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  const tenantRows = await sql`SELECT id, name, plan FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  if (tenantRows.length === 0) throw new Error("Business workspace not found");
  const tenant = tenantRows[0];

  if (confirmName.trim().toLowerCase() !== tenant.name.trim().toLowerCase()) {
    throw new Error(`Business name confirmation does not match. Expected "${tenant.name}"`);
  }

  // Find associated users
  const memberRows = await sql`SELECT id, email FROM admin_users WHERE tenant_id = ${tenantId}`;
  const memberEmails = memberRows.map((m: any) => m.email);

  // Safely cascade delete workspace records
  try {
    // 1. Line items if tables exist
    await sql`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE tenant_id = ${tenantId})`.catch(() => {});
    await sql`DELETE FROM quotation_items WHERE quotation_id IN (SELECT id FROM admin_quotations WHERE tenant_id = ${tenantId})`.catch(() => {});

    // 2. Core entities
    await sql`DELETE FROM invoices WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_quotations WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_incomes WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_expenses WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_scheduled_expenses WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_clients WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_inventory WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM admin_transfers WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM accounts WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM audit_logs WHERE tenant_id = ${tenantId}`.catch(() => {});

    // 3. Billing & subscriptions
    await sql`DELETE FROM coupon_redemptions WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM subscription_events WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM payments WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM subscriptions WHERE tenant_id = ${tenantId}`.catch(() => {});
    await sql`DELETE FROM user_notes WHERE tenant_id = ${tenantId}`.catch(() => {});

    // 4. Unlink team members so their user records are preserved, but unlinked from the deleted workspace
    await sql`UPDATE admin_users SET tenant_id = NULL, role = 'owner' WHERE tenant_id = ${tenantId}`.catch(() => {});

    // 5. Delete tenant
    await sql`DELETE FROM tenants WHERE id = ${tenantId}`;
  } catch (err: any) {
    console.error("Error during adminDeleteBusiness:", err);
    throw new Error(`Failed to delete business: ${err.message}`);
  }

  // Audit log
  await logAdminAction({
    actor,
    action: "DELETE_BUSINESS",
    targetType: "tenant",
    targetId: tenantId,
    before: { name: tenant.name, plan: tenant.plan, member_count: memberRows.length, members: memberEmails },
    after: { deleted: true, reason: reason || "Deleted by admin" },
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath("/admin");

  return { success: true, deletedName: tenant.name };
}

export async function adminUpdateBusinessRenewalDate({
  tenantId,
  renewalDate,
  reason = "",
}: {
  tenantId: number;
  renewalDate: string | null;
  reason?: string;
}) {
  const actor = await requireAdmin("manage_subscriptions");

  const tenantRows = await sql`SELECT id, name, plan, plan_expires_at FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  if (tenantRows.length === 0) throw new Error("Business not found");
  const tenant = tenantRows[0];
  const prevDate = tenant.plan_expires_at;

  const parsedDate = renewalDate ? new Date(renewalDate).toISOString() : null;

  // 1. Update tenants table
  await sql`
    UPDATE tenants 
    SET plan_expires_at = ${parsedDate} 
    WHERE id = ${tenantId}
  `;

  // 2. Update latest subscription if exists
  await sql`
    UPDATE subscriptions 
    SET current_period_end = ${parsedDate}, updated_at = NOW() 
    WHERE tenant_id = ${tenantId} 
    AND id = (SELECT id FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY id DESC LIMIT 1)
  `;

  // 3. Log audit event
  await logAdminAction({
    actor,
    action: "UPDATE_RENEWAL_DATE",
    targetType: "tenant",
    targetId: tenantId,
    before: { plan_expires_at: prevDate },
    after: { plan_expires_at: parsedDate, reason }
  });

  revalidatePath(`/admin/businesses/${tenantId}`);
  revalidatePath("/admin/subscriptions");
  revalidatePath("/admin/users");
  revalidatePath("/user");

  return { success: true, planExpiresAt: parsedDate };
}


