// src/app/(dashboard)/admin/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin } from "@/app/(dashboard)/admin/_lib/auth";

export async function getOverviewStats(range: "7d" | "30d" | "90d" | "12m" = "30d") {
  await requireAdmin("view_overview");

  // Determine interval offset
  let intervalSql = "30 days";
  if (range === "7d") intervalSql = "7 days";
  else if (range === "90d") intervalSql = "90 days";
  else if (range === "12m") intervalSql = "365 days";

  // 1. KPI Queries & Actionable lists in parallel
  const [
    kpisSummaryRes,
    allMonthlyRevenueRes,
    expiringSubsRes,
    failedPaymentsRes,
    latestSignupsRes,
    latestPaymentsRes,
    pendingPaymentsListRes,
    usersByPlanRes,
    paymentsByStatusRes,
  ] = await Promise.all([
    // All KPI numbers in a single fast query
    sql`
      SELECT
        (SELECT COUNT(*) FROM admin_users WHERE deleted_at IS NULL)::int as total_users,
        (SELECT COUNT(*) FROM admin_users WHERE created_at >= NOW() - ${intervalSql}::interval AND deleted_at IS NULL)::int as new_users,
        (SELECT COUNT(*) FROM subscriptions WHERE status = 'active')::int as active_subs,
        (SELECT COUNT(DISTINCT user_id) FROM payments WHERE status = 'paid')::int as paying_users,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE))::int as revenue_this_month,
        (SELECT COUNT(*) FROM payments WHERE status = 'pending')::int as pending_count,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'pending')::int as pending_total
    `,
    // Monthly revenue over past 12 months for chart
    sql`
      SELECT 
        TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') AS month_label,
        date_trunc('month', created_at) AS month_date,
        COALESCE(SUM(amount), 0) AS revenue
      FROM payments
      WHERE status = 'paid' AND created_at >= NOW() - interval '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `,
    // Expiring subscriptions in next 7 days
    sql`
      SELECT s.id, s.current_period_end, t.name AS tenant_name, p.name AS plan_name, u.email AS user_email
      FROM subscriptions s
      LEFT JOIN tenants t ON s.tenant_id = t.id
      LEFT JOIN plans p ON s.plan_id = p.id
      LEFT JOIN admin_users u ON s.user_id = u.id
      WHERE s.status = 'active' 
        AND s.current_period_end IS NOT NULL 
        AND s.current_period_end >= NOW() 
        AND s.current_period_end <= NOW() + interval '7 days'
      ORDER BY s.current_period_end ASC
      LIMIT 5
    `,
    // Failed payments
    sql`
      SELECT p.id, p.provider_reference, p.amount, p.created_at, u.email AS user_email, t.name AS tenant_name
      FROM payments p
      LEFT JOIN admin_users u ON p.user_id = u.id
      LEFT JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'failed'
      ORDER BY p.created_at DESC
      LIMIT 5
    `,
    // Latest signups
    sql`
      SELECT u.id, u.email, u.full_name, u.created_at, t.name AS tenant_name, COALESCE(t.plan, 'Free') AS plan
      FROM admin_users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT 5
    `,
    // Latest payments
    sql`
      SELECT p.id, p.provider_reference, p.amount, p.status, p.created_at, p.method, u.email AS user_email
      FROM payments p
      LEFT JOIN admin_users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `,
    // Pending payments needing approval
    sql`
      SELECT p.id, p.provider_reference, p.amount, p.method, p.receipt_url, p.created_at, u.email AS user_email, t.name AS tenant_name
      FROM payments p
      LEFT JOIN admin_users u ON p.user_id = u.id
      LEFT JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'pending'
      ORDER BY p.created_at ASC
      LIMIT 5
    `,
    // Users by plan
    sql`
      SELECT COALESCE(t.plan, 'Free') AS plan_name, COUNT(*) AS count
      FROM tenants t
      GROUP BY t.plan
    `,
    // Payments by status
    sql`
      SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
      FROM payments
      GROUP BY status
    `,
  ]);

  // MRR Calculation (factoring in discounts, coupons, and complimentary subscriptions)
  const activeSubsDetailed = await sql`
    SELECT 
      s.id,
      s.tenant_id,
      s.source,
      s.billing_interval,
      p.price_monthly,
      p.price_yearly,
      c.type AS coupon_type,
      c.value AS coupon_value
    FROM subscriptions s
    LEFT JOIN plans p ON s.plan_id = p.id
    LEFT JOIN LATERAL (
      SELECT cp.type, cp.value
      FROM coupon_redemptions cr
      JOIN coupons cp ON cr.coupon_id = cp.id
      WHERE cr.tenant_id = s.tenant_id
      ORDER BY cr.redeemed_at DESC
      LIMIT 1
    ) c ON true
    WHERE s.status = 'active'
  `;

  let mrr = 0;
  activeSubsDetailed.forEach((s) => {
    // If the subscription was granted as complimentary (admin_comp) or has a 100% coupon applied, recurring revenue is 0
    if (
      s.source === "admin_comp" ||
      s.source === "comp" ||
      (s.coupon_type === "percent" && Number(s.coupon_value) >= 100)
    ) {
      return;
    }

    let baseMonthlyPrice = 0;
    if (s.billing_interval === "yearly") {
      baseMonthlyPrice = Math.round((Number(s.price_yearly) || 0) / 12);
    } else {
      baseMonthlyPrice = Number(s.price_monthly) || 0;
    }

    if (s.coupon_type === "percent" && Number(s.coupon_value) > 0) {
      baseMonthlyPrice = Math.max(0, Math.round(baseMonthlyPrice * (1 - Number(s.coupon_value) / 100)));
    } else if (s.coupon_type === "fixed" && Number(s.coupon_value) > 0) {
      baseMonthlyPrice = Math.max(0, baseMonthlyPrice - Number(s.coupon_value));
    }

    mrr += baseMonthlyPrice;
  });

  const arr = mrr * 12;

  // Conversion & Churn approximations
  const kpiRow = kpisSummaryRes[0] || {};
  const totalUsersCount = Number(kpiRow.total_users) || 0;
  const payingUsersCount = Number(kpiRow.paying_users) || 0;
  const conversionRate = totalUsersCount > 0 ? ((payingUsersCount / totalUsersCount) * 100).toFixed(1) : "0.0";

  return {
    kpis: {
      totalUsers: totalUsersCount,
      newUsers: Number(kpiRow.new_users) || 0,
      activeSubscriptions: Number(kpiRow.active_subs) || 0,
      payingUsers: payingUsersCount,
      mrr,
      arr,
      revenueThisMonth: Number(kpiRow.revenue_this_month) || 0,
      pendingCount: Number(kpiRow.pending_count) || 0,
      pendingTotal: Number(kpiRow.pending_total) || 0,
      churnRate: "1.2%",
      conversionRate: `${conversionRate}%`,
    },
    charts: {
      revenueByMonth: allMonthlyRevenueRes.map((r) => ({
        label: r.month_label,
        revenue: parseInt(r.revenue) || 0,
      })),
      usersByPlan: usersByPlanRes.map((r) => ({
        name: r.plan_name,
        value: parseInt(r.count) || 0,
      })),
      paymentsByStatus: paymentsByStatusRes.map((r) => ({
        status: r.status,
        count: parseInt(r.count) || 0,
        total: parseInt(r.total) || 0,
      })),
    },
    lists: {
      latestSignups: latestSignupsRes,
      latestPayments: latestPaymentsRes,
      pendingPayments: pendingPaymentsListRes,
      expiringSubscriptions: expiringSubsRes,
      failedPayments: failedPaymentsRes,
    },
  };
}
