// src/app/(dashboard)/admin/analytics/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin } from "@/app/(dashboard)/admin/_lib/auth";

export async function getPlatformAnalytics() {
  await requireAdmin("view_analytics");

  // 1. Funnel metrics
      const [signupsRes, createdInvoiceRes, upgradedRes] = await Promise.all([
        sql`SELECT COUNT(*) FROM admin_users WHERE deleted_at IS NULL`,
        sql`SELECT COUNT(DISTINCT tenant_id) FROM invoices`,
        sql`SELECT COUNT(DISTINCT tenant_id) FROM subscriptions WHERE plan_id > 1 AND status = 'active'`,
      ]);

      const signups = parseInt(signupsRes[0].count) || 0;
      const createdInvoice = parseInt(createdInvoiceRes[0].count) || 0;
      const upgraded = parseInt(upgradedRes[0].count) || 0;

      // 2. Feature Adoption stats
      const [quotationsRes, inventoryRes, multiAccountRes] = await Promise.all([
        sql`SELECT COUNT(DISTINCT tenant_id) FROM admin_quotations`,
        sql`SELECT COUNT(DISTINCT tenant_id) FROM admin_inventory`,
        sql`SELECT COUNT(DISTINCT tenant_id) FROM accounts GROUP BY tenant_id HAVING COUNT(*) > 1`,
      ]);

      const featureAdoption = {
        quotationsUsed: parseInt(quotationsRes[0]?.count) || 0,
        inventoryUsed: parseInt(inventoryRes[0]?.count) || 0,
        multiAccountsUsed: multiAccountRes.length,
      };

      // 3. Top businesses by transaction volume
      const topBusinesses = await sql`
        SELECT t.id, t.name, COALESCE(t.plan, 'Free') AS plan,
          (SELECT COUNT(*) FROM invoices i WHERE i.tenant_id = t.id) AS invoice_count,
          COALESCE((SELECT SUM(amount) FROM admin_incomes inc WHERE inc.tenant_id = t.id), 0) AS total_income
        FROM tenants t
        ORDER BY total_income DESC
        LIMIT 6
      `;

      // 4. Monthly cohort activity (last 6 months)
      const cohorts = await sql`
        SELECT 
          TO_CHAR(date_trunc('month', created_at), 'Mon YYYY') AS cohort_month,
          COUNT(*) AS signups_count,
          COUNT(CASE WHEN last_login_at >= NOW() - interval '30 days' THEN 1 END) AS active_recently
        FROM admin_users
        WHERE created_at >= NOW() - interval '6 months'
        GROUP BY date_trunc('month', created_at)
        ORDER BY date_trunc('month', created_at) DESC
      `;

      return {
        funnel: {
          signups,
          createdInvoice,
          upgraded,
          invRate: signups > 0 ? Math.round((createdInvoice / signups) * 100) : 0,
          upgRate: signups > 0 ? Math.round((upgraded / signups) * 100) : 0,
        },
        featureAdoption,
        topBusinesses: topBusinesses.map(b => ({
          ...b,
          invoice_count: parseInt(b.invoice_count) || 0,
          total_income: parseInt(b.total_income) || 0,
          total_volume: parseInt(b.total_income) || 0,
        })),
        cohorts: cohorts.map(c => ({
          ...c,
          signups_count: parseInt(c.signups_count) || 0,
          active_recently: parseInt(c.active_recently) || 0,
        })),
      };
}
