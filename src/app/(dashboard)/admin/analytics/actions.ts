// src/app/(dashboard)/admin/analytics/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin } from "@/app/(dashboard)/admin/_lib/auth";

export async function getPlatformAnalytics() {
  await requireAdmin("view_analytics");

  // 1. Account & Workspace SaaS Counts
  const [
    usersCountRes,
    tenantsCountRes,
    activeTenantsRes,
    plansRes,
    allSubsRes,
  ] = await Promise.all([
    sql`SELECT COUNT(*) FROM admin_users WHERE deleted_at IS NULL`,
    sql`SELECT COUNT(*) FROM tenants`,
    sql`
      SELECT COUNT(DISTINCT tenant_id) 
      FROM admin_users 
      WHERE last_login_at >= NOW() - interval '30 days' AND tenant_id IS NOT NULL AND deleted_at IS NULL
    `,
    sql`SELECT id, name, key, price_monthly, price_yearly, is_active FROM plans ORDER BY sort_order ASC, id ASC`,
    sql`
      SELECT 
        s.id,
        s.tenant_id,
        s.status,
        s.billing_interval,
        s.current_period_end,
        p.id AS plan_id,
        p.name AS plan_name,
        p.key AS plan_key,
        COALESCE(p.price_monthly, 0) AS price_monthly,
        COALESCE(p.price_yearly, 0) AS price_yearly
      FROM subscriptions s
      LEFT JOIN plans p ON s.plan_id = p.id
    `,
  ]);

  const totalUsers = parseInt(usersCountRes[0]?.count) || 0;
  const totalWorkspaces = parseInt(tenantsCountRes[0]?.count) || 0;
  const activeWorkspaces = parseInt(activeTenantsRes[0]?.count) || 0;

  // Calculate MRR, ARR, and Plan Distribution
  let mrr = 0;
  let activePaidSubsCount = 0;
  const planStatsMap = new Map<string, { planName: string; count: number; mrr: number; isPaid: boolean }>();
  let monthlySubsCount = 0;
  let yearlySubsCount = 0;
  let activeSubsCount = 0;
  let pastDueSubsCount = 0;
  let canceledSubsCount = 0;

  // Initialize plans
  plansRes.forEach((p: any) => {
    planStatsMap.set(p.name, {
      planName: p.name,
      count: 0,
      mrr: 0,
      isPaid: (p.price_monthly > 0 || p.price_yearly > 0),
    });
  });

  allSubsRes.forEach((sub: any) => {
    const isSubActive = sub.status === "active";
    if (isSubActive) {
      activeSubsCount++;
      const monthlyRate = sub.billing_interval === "yearly"
        ? Math.round(sub.price_yearly / 12)
        : sub.price_monthly;

      if (monthlyRate > 0) {
        mrr += monthlyRate;
        activePaidSubsCount++;
      }

      if (sub.billing_interval === "yearly") {
        yearlySubsCount++;
      } else {
        monthlySubsCount++;
      }
    } else if (sub.status === "past_due") {
      pastDueSubsCount++;
    } else if (sub.status === "canceled") {
      canceledSubsCount++;
    }

    const planName = sub.plan_name || "Free";
    if (planStatsMap.has(planName)) {
      const cur = planStatsMap.get(planName)!;
      if (isSubActive) {
        cur.count++;
        cur.mrr += sub.billing_interval === "yearly" ? Math.round(sub.price_yearly / 12) : sub.price_monthly;
      }
    } else {
      planStatsMap.set(planName, {
        planName,
        count: isSubActive ? 1 : 0,
        mrr: isSubActive ? (sub.billing_interval === "yearly" ? Math.round(sub.price_yearly / 12) : sub.price_monthly) : 0,
        isPaid: (sub.price_monthly > 0 || sub.price_yearly > 0),
      });
    }
  });

  const arr = mrr * 12;

  // 2. Payments Analytics (SaaS Subscription Payments)
  const [
    paymentsSummaryRes,
    paymentsByMethodRes,
    monthlyRevenueRes,
    recentPaymentsRes,
    topSubscribersRes,
  ] = await Promise.all([
    sql`
      SELECT 
        COUNT(*) AS total_count,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS total_collected,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS total_pending,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed_count,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) AS total_failed,
        COUNT(CASE WHEN status IN ('refunded', 'partially_refunded') THEN 1 END) AS refunded_count,
        COALESCE(SUM(CASE WHEN status IN ('refunded', 'partially_refunded') THEN amount ELSE 0 END), 0) AS total_refunded
      FROM payments
    `,
    sql`
      SELECT 
        COALESCE(method, 'bank_transfer') AS method,
        COUNT(*) AS count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM payments
      WHERE status = 'paid'
      GROUP BY method
      ORDER BY total_amount DESC
    `,
    sql`
      SELECT 
        TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') AS month_label,
        date_trunc('month', created_at) AS month_date,
        COALESCE(SUM(amount), 0) AS revenue,
        COUNT(*) AS count
      FROM payments
      WHERE status = 'paid' AND created_at >= NOW() - interval '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `,
    sql`
      SELECT 
        p.id,
        p.amount,
        p.status,
        p.method,
        p.provider_reference,
        p.created_at,
        t.name AS tenant_name,
        t.id AS tenant_id,
        u.email AS user_email,
        pl.name AS plan_name
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN admin_users u ON p.user_id = u.id
      LEFT JOIN plans pl ON p.plan_id = pl.id
      ORDER BY p.created_at DESC
      LIMIT 6
    `,
    sql`
      SELECT 
        t.id,
        t.name,
        COALESCE(t.plan, 'Free') AS plan,
        t.plan_expires_at,
        COALESCE(sub.status, 'active') AS sub_status,
        COALESCE(sub.billing_interval, 'monthly') AS billing_interval,
        COALESCE(sub.current_period_end, t.plan_expires_at) AS current_period_end,
        COALESCE(p_stats.total_paid, 0) AS total_paid_to_platform,
        COALESCE(p_stats.payments_count, 0) AS payments_count
      FROM tenants t
      LEFT JOIN (
        SELECT DISTINCT ON (tenant_id) tenant_id, status, billing_interval, current_period_end
        FROM subscriptions
        ORDER BY tenant_id, id DESC
      ) sub ON sub.tenant_id = t.id
      LEFT JOIN (
        SELECT tenant_id, SUM(amount) AS total_paid, COUNT(*) AS payments_count
        FROM payments
        WHERE status = 'paid'
        GROUP BY tenant_id
      ) p_stats ON p_stats.tenant_id = t.id
      ORDER BY total_paid_to_platform DESC, t.id ASC
      LIMIT 8
    `,
  ]);

  const pSum = paymentsSummaryRes[0] || {};
  const totalCollected = parseInt(pSum.total_collected) || 0;
  const totalPending = parseInt(pSum.total_pending) || 0;
  const totalFailed = parseInt(pSum.total_failed) || 0;
  const totalRefunded = parseInt(pSum.total_refunded) || 0;
  const paidCount = parseInt(pSum.paid_count) || 0;
  const pendingCount = parseInt(pSum.pending_count) || 0;

  // ARPU (Average Revenue per Paid Workspace)
  const arpu = activePaidSubsCount > 0 ? Math.round(mrr / activePaidSubsCount) : 0;

  // 3. User Signups & Cohorts (Platform growth)
  const cohorts = await sql`
    SELECT 
      TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') AS cohort_month,
      COUNT(*) AS signups_count,
      COUNT(CASE WHEN last_login_at >= NOW() - interval '30 days' THEN 1 END) AS active_recently
    FROM admin_users
    WHERE created_at >= NOW() - interval '6 months' AND deleted_at IS NULL
    GROUP BY date_trunc('month', created_at)
    ORDER BY date_trunc('month', created_at) DESC
  `;

  return {
    kpis: {
      mrr,
      arr,
      arpu,
      totalCollected,
      totalPending,
      totalFailed,
      totalRefunded,
      paidCount,
      pendingCount,
      activePaidSubsCount,
      totalWorkspaces,
      activeSubsCount,
      pastDueSubsCount,
      canceledSubsCount,
    },
    funnel: {
      registeredUsers: totalUsers,
      workspacesCreated: totalWorkspaces,
      activeWorkspaces,
      paidSubscribers: activePaidSubsCount,
      workspaceRate: totalUsers > 0 ? Math.round((totalWorkspaces / totalUsers) * 100) : 0,
      activeRate: totalWorkspaces > 0 ? Math.round((activeWorkspaces / totalWorkspaces) * 100) : 0,
      paidConversionRate: totalWorkspaces > 0 ? Math.round((activePaidSubsCount / totalWorkspaces) * 100) : 0,
    },
    planDistribution: Array.from(planStatsMap.values()),
    billingIntervals: {
      monthly: monthlySubsCount,
      yearly: yearlySubsCount,
    },
    paymentsByMethod: paymentsByMethodRes.map((m: any) => ({
      method: m.method,
      count: parseInt(m.count) || 0,
      total_amount: parseInt(m.total_amount) || 0,
    })),
    monthlyRevenueTrend: monthlyRevenueRes.map((r: any) => ({
      month: r.month_label,
      revenue: parseInt(r.revenue) || 0,
      count: parseInt(r.count) || 0,
    })),
    topSubscribers: topSubscribersRes.map((b: any) => ({
      id: b.id,
      name: b.name,
      plan: b.plan,
      plan_expires_at: b.plan_expires_at,
      sub_status: b.sub_status,
      billing_interval: b.billing_interval,
      current_period_end: b.current_period_end,
      total_paid_to_platform: parseInt(b.total_paid_to_platform) || 0,
      payments_count: parseInt(b.payments_count) || 0,
    })),
    recentPayments: recentPaymentsRes.map((p: any) => ({
      id: p.id,
      amount: parseInt(p.amount) || 0,
      status: p.status,
      method: p.method,
      provider_reference: p.provider_reference,
      created_at: p.created_at,
      tenant_name: p.tenant_name,
      tenant_id: p.tenant_id,
      user_email: p.user_email,
      plan_name: p.plan_name,
    })),
    cohorts: cohorts.map((c: any) => ({
      cohort_month: c.cohort_month,
      signups_count: parseInt(c.signups_count) || 0,
      active_recently: parseInt(c.active_recently) || 0,
    })),
  };
}
