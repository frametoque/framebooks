// src/app/(dashboard)/admin/users/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getUsersList({
  search = "",
  plan = "",
  status = "",
  role = "",
  banned = "",
  page = 1,
  limit = 15,
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
  await requireAdmin("view_users");

  const offset = (Math.max(1, page) - 1) * limit;
  const searchPattern = search ? `%${search.trim()}%` : null;

  // Base conditions
  const users = await sql`
    SELECT 
      u.id,
      u.email,
      u.full_name,
      u.company,
      u.role AS workspace_role,
      u.system_role,
      u.is_banned,
      u.banned_reason,
      u.created_at,
      u.last_login_at,
      u.tenant_id,
      t.name AS tenant_name,
      t.logo_url AS tenant_logo_url,
      t.plan_expires_at,
      t.payment_status,
      COALESCE(t.plan, 'Free') AS current_plan,
      COALESCE(s.status, 'active') AS subscription_status,
      s.id AS subscription_id,
      s.billing_interval,
      s.source AS subscription_source,
      s.current_period_end,
      COALESCE((
        SELECT SUM(p.amount) 
        FROM payments p 
        WHERE (p.user_id = u.id OR p.tenant_id = u.tenant_id) AND p.status = 'paid'
      ), 0) AS lifetime_paid,
      cp.coupon_code,
      cp.coupon_type,
      cp.coupon_value
    FROM admin_users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    LEFT JOIN LATERAL (
      SELECT id, status, billing_interval, source, current_period_end 
      FROM subscriptions 
      WHERE tenant_id = u.tenant_id 
      ORDER BY id DESC 
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT c.code AS coupon_code, c.type AS coupon_type, c.value AS coupon_value
      FROM coupon_redemptions cr
      JOIN coupons c ON cr.coupon_id = c.id
      WHERE cr.tenant_id = u.tenant_id
      ORDER BY cr.redeemed_at DESC
      LIMIT 1
    ) cp ON true
    WHERE u.deleted_at IS NULL
      AND (${searchPattern}::text IS NULL OR u.email ILIKE ${searchPattern} OR u.full_name ILIKE ${searchPattern} OR t.name ILIKE ${searchPattern})
      AND (${plan || null}::text IS NULL OR LOWER(t.plan) = LOWER(${plan}))
      AND (${status || null}::text IS NULL OR LOWER(s.status) = LOWER(${status}))
      AND (${role || null}::text IS NULL OR u.system_role = ${role})
      AND (${banned || null}::text IS NULL OR u.is_banned = (${banned === 'true'}))
    ORDER BY 
      CASE WHEN ${sortBy} = 'name' AND ${sortOrder} = 'asc' THEN u.full_name END ASC,
      CASE WHEN ${sortBy} = 'name' AND ${sortOrder} = 'desc' THEN u.full_name END DESC,
      CASE WHEN ${sortBy} = 'email' AND ${sortOrder} = 'asc' THEN u.email END ASC,
      CASE WHEN ${sortBy} = 'email' AND ${sortOrder} = 'desc' THEN u.email END DESC,
      CASE WHEN ${sortBy} = 'lifetime_paid' AND ${sortOrder} = 'desc' THEN 
        (SELECT SUM(p.amount) FROM payments p WHERE (p.user_id = u.id OR p.tenant_id = u.tenant_id) AND p.status = 'paid') 
      END DESC,
      CASE WHEN ${sortBy} = 'created_at' AND ${sortOrder} = 'asc' THEN u.created_at END ASC,
      u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalCountResult = await sql`
    SELECT COUNT(*) 
    FROM admin_users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    LEFT JOIN LATERAL (
      SELECT status 
      FROM subscriptions 
      WHERE tenant_id = u.tenant_id 
      ORDER BY id DESC 
      LIMIT 1
    ) s ON true
    WHERE u.deleted_at IS NULL
      AND (${searchPattern}::text IS NULL OR u.email ILIKE ${searchPattern} OR u.full_name ILIKE ${searchPattern} OR t.name ILIKE ${searchPattern})
      AND (${plan || null}::text IS NULL OR LOWER(t.plan) = LOWER(${plan}))
      AND (${status || null}::text IS NULL OR LOWER(s.status) = LOWER(${status}))
      AND (${role || null}::text IS NULL OR u.system_role = ${role})
      AND (${banned || null}::text IS NULL OR u.is_banned = (${banned === 'true'}))
  `;

  const totalCount = parseInt(totalCountResult[0].count);

  return {
    users: users.map(u => ({
      ...u,
      lifetime_paid: parseInt(u.lifetime_paid) || 0
    })),
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
  };
}

export async function banUser(userId: number, reason: string) {
  const actor = await requireAdmin("ban_users");

  const existing = await sql`SELECT id, email, is_banned, system_role FROM admin_users WHERE id = ${userId} LIMIT 1`;
  if (existing.length === 0) throw new Error("User not found");

  if (existing[0].system_role === 'super_admin' && actor.systemRole !== 'super_admin') {
    throw new Error("Cannot ban a Super Admin.");
  }

  await sql`
    UPDATE admin_users 
    SET is_banned = true, banned_at = NOW(), banned_reason = ${reason} 
    WHERE id = ${userId}
  `;

  await logAdminAction({
    actor,
    action: "BAN_USER",
    targetType: "user",
    targetId: userId,
    before: { is_banned: existing[0].is_banned },
    after: { is_banned: true, reason }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function unbanUser(userId: number) {
  const actor = await requireAdmin("ban_users");

  const existing = await sql`SELECT id, email, is_banned FROM admin_users WHERE id = ${userId} LIMIT 1`;
  if (existing.length === 0) throw new Error("User not found");

  await sql`
    UPDATE admin_users 
    SET is_banned = false, banned_at = NULL, banned_reason = NULL 
    WHERE id = ${userId}
  `;

  await logAdminAction({
    actor,
    action: "UNBAN_USER",
    targetType: "user",
    targetId: userId,
    before: { is_banned: existing[0].is_banned },
    after: { is_banned: false }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function softDeleteUser(userId: number) {
  const actor = await requireAdmin("delete_users");

  const existing = await sql`SELECT id, email, system_role, tenant_id FROM admin_users WHERE id = ${userId} LIMIT 1`;
  if (existing.length === 0) throw new Error("User not found");

  if (existing[0].system_role === 'super_admin') {
    throw new Error("Super Admin accounts cannot be deleted.");
  }

  const userEmail = existing[0].email;

  // Clean up non-financial records
  await sql`DELETE FROM user_notes WHERE user_id = ${userId}`.catch(() => {});
  await sql`DELETE FROM announcement_dismissals WHERE user_id = ${userId}`.catch(() => {});

  // Check if user has payments or subscriptions
  const payRows = await sql`SELECT id FROM payments WHERE user_id = ${userId} LIMIT 1`;
  const subRows = await sql`SELECT id FROM subscriptions WHERE user_id = ${userId} LIMIT 1`;

  if (payRows.length === 0 && subRows.length === 0) {
    await sql`DELETE FROM admin_users WHERE id = ${userId}`;
  } else {
    await sql`
      UPDATE admin_users 
      SET deleted_at = NOW(), tenant_id = NULL 
      WHERE id = ${userId}
    `;
  }

  await logAdminAction({
    actor,
    action: "DELETE_USER",
    targetType: "user",
    targetId: userId,
    before: { email: userEmail, deleted_at: null },
    after: { deleted_at: new Date() }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function adminDeleteUser({ userId, reason = "" }: { userId: number; reason?: string }) {
  return softDeleteUser(userId);
}

export async function addUserNote(userId: number, body: string) {
  const actor = await requireAdmin("view_users");

  if (!body.trim()) throw new Error("Note cannot be empty");

  await sql`
    INSERT INTO user_notes (user_id, author_id, author_email, author_name, body)
    VALUES (${userId}, ${String(actor.id)}, ${actor.email}, ${actor.name}, ${body.trim()})
  `;

  await logAdminAction({
    actor,
    action: "ADD_USER_NOTE",
    targetType: "user",
    targetId: userId,
    after: { note: body.trim() }
  });

  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}

export async function getUserDetails(userId: number) {
  await requireAdmin("view_users");

  const userRes = await sql`
    SELECT 
      u.*,
      t.name AS tenant_name,
      t.currency AS tenant_currency,
      COALESCE(t.plan, 'Free') AS tenant_plan,
      t.created_at AS tenant_created_at
    FROM admin_users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    WHERE u.id = ${userId}
    LIMIT 1
  `;

  if (userRes.length === 0) return null;
  const user = userRes[0];
  const tenantId = user.tenant_id;

  // Usage stats vs plan limits
  let usage = {
    invoices: 0,
    incomes: 0,
    expenses: 0,
    clients: 0,
    accounts: 0,
    team_members: 0,
  };

  if (tenantId) {
    const [invCount, incCount, expCount, clientCount, accCount, teamCount, tenantRows] = await Promise.all([
      sql`SELECT COUNT(*) FROM invoices WHERE tenant_id = ${tenantId}`,
      sql`SELECT COUNT(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`,
      sql`SELECT COUNT(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`,
      sql`SELECT COUNT(*) FROM admin_clients WHERE tenant_id = ${tenantId}`,
      sql`SELECT COUNT(*) FROM accounts WHERE tenant_id = ${tenantId}`,
      sql`SELECT COUNT(*) FROM admin_users WHERE tenant_id = ${tenantId}`,
      sql`SELECT plan, lifetime_invoices, lifetime_incomes, lifetime_expenses, lifetime_clients, lifetime_accounts FROM tenants WHERE id = ${tenantId}`,
    ]);

    const t = tenantRows[0] || {};
    const isFree = (t.plan || user.tenant_plan || 'Free').toLowerCase() === 'free';

    usage = {
      invoices: isFree ? Math.max(t.lifetime_invoices ?? 0, parseInt(invCount[0].count) || 0) : (parseInt(invCount[0].count) || 0),
      incomes: isFree ? Math.max(t.lifetime_incomes ?? 0, parseInt(incCount[0].count) || 0) : (parseInt(incCount[0].count) || 0),
      expenses: isFree ? Math.max(t.lifetime_expenses ?? 0, parseInt(expCount[0].count) || 0) : (parseInt(expCount[0].count) || 0),
      clients: isFree ? Math.max(t.lifetime_clients ?? 0, parseInt(clientCount[0].count) || 0) : (parseInt(clientCount[0].count) || 0),
      accounts: isFree ? Math.max(t.lifetime_accounts ?? 0, parseInt(accCount[0].count) || 0) : (parseInt(accCount[0].count) || 0),
      team_members: parseInt(teamCount[0].count) || 0,
    };
  }

  // Current plan details & limits
  const planRows = await sql`
    SELECT * FROM plans WHERE LOWER(name) = LOWER(${user.tenant_plan}) OR LOWER(key) = LOWER(${user.tenant_plan}) LIMIT 1
  `;
  const plan = planRows[0] || null;

  // Subscriptions & history
  const subscriptions = tenantId
    ? await sql`
        SELECT s.*, p.name AS plan_name, p.price_monthly, p.price_yearly
        FROM subscriptions s
        LEFT JOIN plans p ON s.plan_id = p.id
        WHERE s.tenant_id = ${tenantId}
        ORDER BY s.id DESC
      `
    : [];

  const subscriptionEvents = tenantId
    ? await sql`
        SELECT * FROM subscription_events
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `
    : [];

  // Payments
  const payments = await sql`
    SELECT * FROM payments 
    WHERE user_id = ${userId} OR (${tenantId !== null} AND tenant_id = ${tenantId})
    ORDER BY created_at DESC
  `;

  // Notes
  const notes = await sql`
    SELECT * FROM user_notes 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  // Lifetime paid sum
  const lifetimePaid = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  // Applied Coupons
  const appliedCoupons = tenantId
    ? await sql`
        SELECT cr.id AS redemption_id, cr.redeemed_at, c.id AS coupon_id, c.code, c.type, c.value, c.is_active
        FROM coupon_redemptions cr
        JOIN coupons c ON cr.coupon_id = c.id
        WHERE cr.tenant_id = ${tenantId}
        ORDER BY cr.redeemed_at DESC
      `
    : [];

  return {
    user,
    plan,
    usage,
    subscriptions,
    subscriptionEvents,
    payments,
    notes,
    lifetimePaid,
    appliedCoupon: appliedCoupons[0] || null,
    appliedCoupons,
  };
}

export async function getBusinessDetails(tenantId: number) {
  await requireAdmin("view_users");

  const tenantRes = await sql`
    SELECT * FROM tenants WHERE id = ${tenantId} LIMIT 1
  `;
  if (tenantRes.length === 0) return null;
  const tenant = tenantRes[0];

  const members = await sql`
    SELECT id, email, full_name, role, system_role, is_banned, created_at, last_login_at
    FROM admin_users 
    WHERE tenant_id = ${tenantId} AND deleted_at IS NULL
    ORDER BY 
      CASE WHEN LOWER(role) = 'owner' THEN 1 WHEN LOWER(role) = 'admin' THEN 2 ELSE 3 END,
      created_at ASC
  `;

  const [invCount, incCount, expCount, clientCount, accCount] = await Promise.all([
    sql`SELECT COUNT(*) FROM invoices WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM admin_clients WHERE tenant_id = ${tenantId}`,
    sql`SELECT COUNT(*) FROM accounts WHERE tenant_id = ${tenantId}`,
  ]);

  const isFreePlan = (tenant.plan || 'Free').toLowerCase() === 'free';
  const usage = {
    invoices: isFreePlan ? Math.max(tenant.lifetime_invoices ?? 0, parseInt(invCount[0].count) || 0) : (parseInt(invCount[0].count) || 0),
    incomes: isFreePlan ? Math.max(tenant.lifetime_incomes ?? 0, parseInt(incCount[0].count) || 0) : (parseInt(incCount[0].count) || 0),
    expenses: isFreePlan ? Math.max(tenant.lifetime_expenses ?? 0, parseInt(expCount[0].count) || 0) : (parseInt(expCount[0].count) || 0),
    clients: isFreePlan ? Math.max(tenant.lifetime_clients ?? 0, parseInt(clientCount[0].count) || 0) : (parseInt(clientCount[0].count) || 0),
    accounts: isFreePlan ? Math.max(tenant.lifetime_accounts ?? 0, parseInt(accCount[0].count) || 0) : (parseInt(accCount[0].count) || 0),
    team_members: members.length,
  };

  const planRows = await sql`
    SELECT * FROM plans 
    WHERE LOWER(name) = LOWER(${tenant.plan || 'Free'}) OR LOWER(key) = LOWER(${tenant.plan || 'Free'}) 
    LIMIT 1
  `;
  const plan = planRows[0] || null;

  const subscriptions = await sql`
    SELECT s.*, p.name AS plan_name, p.price_monthly, p.price_yearly
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    WHERE s.tenant_id = ${tenantId}
    ORDER BY s.id DESC
  `;
  const subscription = subscriptions[0] || null;

  const subscriptionEvents = await sql`
    SELECT * FROM subscription_events
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const payments = await sql`
    SELECT p.*, u.email AS user_email, u.full_name AS user_name
    FROM payments p
    LEFT JOIN admin_users u ON p.user_id = u.id
    WHERE p.tenant_id = ${tenantId}
    ORDER BY p.created_at DESC
  `;

  const lifetimePaid = payments
    .filter((p: any) => p.status === 'paid')
    .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const notes = await sql`
    SELECT * FROM user_notes 
    WHERE tenant_id = ${tenantId}
       OR (user_id IN (SELECT id FROM admin_users WHERE tenant_id = ${tenantId}))
    ORDER BY created_at DESC
  `;

  const activity = await sql`
    SELECT * FROM admin_audit_logs
    WHERE (target_type = 'tenant' AND target_id = ${String(tenantId)})
       OR (target_type = 'user' AND target_id IN (SELECT id::text FROM admin_users WHERE tenant_id = ${tenantId}))
    ORDER BY created_at DESC
    LIMIT 50
  `;

  const appliedCoupons = await sql`
    SELECT cr.id AS redemption_id, cr.redeemed_at, c.id AS coupon_id, c.code, c.type, c.value, c.is_active
    FROM coupon_redemptions cr
    JOIN coupons c ON cr.coupon_id = c.id
    WHERE cr.tenant_id = ${tenantId}
    ORDER BY cr.redeemed_at DESC
  `;

  return {
    tenant,
    members,
    usage,
    plan,
    subscription,
    subscriptions,
    subscriptionEvents,
    payments,
    lifetimePaid,
    notes,
    activity,
    appliedCoupon: appliedCoupons[0] || null,
    appliedCoupons,
  };
}

export async function addBusinessNote(tenantId: number, body: string) {
  const actor = await requireAdmin("view_users");
  if (!body.trim()) throw new Error("Note cannot be empty");

  const ownerRows = await sql`
    SELECT id FROM admin_users WHERE tenant_id = ${tenantId} ORDER BY CASE WHEN LOWER(role) = 'owner' THEN 1 ELSE 2 END LIMIT 1
  `;
  const representativeUserId = ownerRows[0]?.id || actor.id;

  await sql`
    INSERT INTO user_notes (user_id, tenant_id, author_id, author_email, author_name, body)
    VALUES (${representativeUserId}, ${tenantId}, ${String(actor.id)}, ${actor.email}, ${actor.name}, ${body.trim()})
  `;

  await logAdminAction({
    actor,
    action: "ADD_BUSINESS_NOTE",
    targetType: "tenant",
    targetId: tenantId,
    after: { note: body.trim() }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function adminAddBusinessMember({
  tenantId,
  email,
  fullName,
  role = "member",
}: {
  tenantId: number;
  email: string;
  fullName?: string;
  role: string;
}) {
  const actor = await requireAdmin("edit_users");

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error("Email address is required");

  // Check if tenant exists
  const tenantRows = await sql`SELECT id, name FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  if (tenantRows.length === 0) throw new Error("Business not found");
  const tenantName = tenantRows[0].name;

  // Check if user already exists
  const existingUser = await sql`SELECT id, email, full_name, role, tenant_id FROM admin_users WHERE LOWER(email) = ${cleanEmail} LIMIT 1`;

  let userId: number;
  if (existingUser.length > 0) {
    const existing = existingUser[0];
    userId = existing.id;
    await sql`
      UPDATE admin_users SET
        tenant_id = ${tenantId},
        role = ${role},
        full_name = COALESCE(NULLIF(${fullName?.trim() || ''}, ''), full_name),
        deleted_at = NULL,
        updated_at = NOW()
      WHERE id = ${userId}
    `;
  } else {
    const insertRes = await sql`
      INSERT INTO admin_users (email, full_name, role, tenant_id, system_role, created_at, updated_at)
      VALUES (
        ${cleanEmail},
        ${fullName?.trim() || cleanEmail.split('@')[0]},
        ${role},
        ${tenantId},
        'user',
        NOW(),
        NOW()
      )
      RETURNING id
    `;
    userId = insertRes[0].id;
  }

  await logAdminAction({
    actor,
    action: "ADD_BUSINESS_MEMBER",
    targetType: "user",
    targetId: userId,
    after: { tenantId, tenantName, email: cleanEmail, role }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function adminUpdateMemberRole({
  userId,
  tenantId,
  newRole,
}: {
  userId: number;
  tenantId: number;
  newRole: string;
}) {
  const actor = await requireAdmin("edit_users");

  const cleanRole = newRole.trim().toLowerCase();
  if (!cleanRole) throw new Error("Role is required");

  const userRows = await sql`SELECT id, email, full_name, role FROM admin_users WHERE id = ${userId} AND tenant_id = ${tenantId} LIMIT 1`;
  if (userRows.length === 0) throw new Error("Team member not found in this business");
  const before = userRows[0];

  await sql`
    UPDATE admin_users SET
      role = ${cleanRole},
      updated_at = NOW()
    WHERE id = ${userId} AND tenant_id = ${tenantId}
  `;

  await logAdminAction({
    actor,
    action: "UPDATE_MEMBER_ROLE",
    targetType: "user",
    targetId: userId,
    before: { role: before.role },
    after: { role: cleanRole, tenantId }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

export async function adminRemoveBusinessMember({
  userId,
  tenantId,
}: {
  userId: number;
  tenantId: number;
}) {
  const actor = await requireAdmin("edit_users");

  const userRows = await sql`SELECT id, email, full_name, role FROM admin_users WHERE id = ${userId} AND tenant_id = ${tenantId} LIMIT 1`;
  if (userRows.length === 0) throw new Error("Team member not found in this business");
  const user = userRows[0];

  // Remove business link
  await sql`
    UPDATE admin_users SET
      tenant_id = NULL,
      role = 'member',
      updated_at = NOW()
    WHERE id = ${userId} AND tenant_id = ${tenantId}
  `;

  await logAdminAction({
    actor,
    action: "REMOVE_BUSINESS_MEMBER",
    targetType: "user",
    targetId: userId,
    before: { tenantId, role: user.role },
    after: { tenantId: null, role: 'member' }
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/subscriptions");
  return { success: true };
}

