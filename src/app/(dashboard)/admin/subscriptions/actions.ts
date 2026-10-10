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


