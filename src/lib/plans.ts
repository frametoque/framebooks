
import sql from "@/lib/db";
import { getTenantId } from "@/app/(dashboard)/user/actions/actions";
import { getTenantPlan } from "@/app/(dashboard)/user/actions/plan";

export type PlanType = 'Free' | 'Pro' | 'Pro Plus';

export async function checkLimit(
  resource: 'invoices' | 'quotations' | 'incomes' | 'expenses' | 'clients' | 'accounts' | 'team_members'
): Promise<{ allowed: boolean; limit: number; current: number; error?: string }> {
  const plan = await getTenantPlan();
  
  const limitsResult = await sql`SELECT * FROM plan_limits WHERE plan = ${plan}`;
  if (limitsResult.length === 0) {
    return { allowed: false, limit: 0, current: 0, error: "Plan limits not found in database." };
  }
  const dbLimits = limitsResult[0];
  
  let limit = 0;
  switch (resource) {
    case 'invoices': limit = dbLimits.max_invoices; break;
    case 'quotations': limit = dbLimits.max_quotations ?? (dbLimits.plan?.toLowerCase() === 'free' ? 50 : -1); break;
    case 'incomes': limit = dbLimits.max_incomes; break;
    case 'expenses': limit = dbLimits.max_expenses; break;
    case 'clients': limit = dbLimits.max_clients; break;
    case 'accounts': limit = dbLimits.max_accounts; break;
    case 'team_members': 
      limit = dbLimits.can_add_team_members === 1 ? -1 : 1;
      break;
  }
  
  if (limit === -1) {
    return { allowed: true, limit, current: 0 };
  }
  
  const tenantId = await getTenantId();
  if (!tenantId) return { allowed: false, limit, current: 0, error: "Unauthorized" };
  
  let current = 0;
  if (resource === 'team_members') {
    const res = await sql`SELECT COUNT(*) FROM admin_users WHERE tenant_id = ${tenantId} AND deleted_at IS NULL`;
    current = parseInt(res[0]?.count || 0);
  } else {
    // Universal lifetime usage tracking: deleting records never decreases lifetime counter
    const tenantRows = await sql`
      SELECT 
        lifetime_invoices, 
        lifetime_quotations,
        lifetime_incomes, 
        lifetime_expenses, 
        lifetime_clients, 
        lifetime_accounts 
      FROM tenants 
      WHERE id = ${tenantId}
    `;
    const t = tenantRows[0] || {};

    switch (resource) {
      case 'invoices': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM invoices WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_invoices ?? 0, count);
        break;
      }
      case 'quotations': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM admin_quotations WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_quotations ?? 0, count);
        break;
      }
      case 'incomes': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_incomes ?? 0, count);
        break;
      }
      case 'expenses': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_expenses ?? 0, count);
        break;
      }
      case 'clients': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM admin_clients WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_clients ?? 0, count);
        break;
      }
      case 'accounts': {
        const count = parseInt((await sql`SELECT COUNT(*) FROM accounts WHERE tenant_id = ${tenantId}`)[0]?.count || 0);
        current = Math.max(t.lifetime_accounts ?? 0, count);
        break;
      }
    }
  }
  
  if (current >= limit) {
    return { 
      allowed: false, 
      limit, 
      current, 
      error: `LIMIT_EXCEEDED: You have reached the lifetime limit of ${limit} ${resource} for your ${plan} plan. Deleting previous entries does not reset your usage quota. Please upgrade to Pro for unlimited access.` 
    };
  }
  
  return { allowed: true, limit, current };
}

export async function incrementLifetimeUsage(
  tenantId: number | string,
  resource: 'invoices' | 'quotations' | 'incomes' | 'expenses' | 'clients' | 'accounts'
) {
  const tid = Number(tenantId);
  if (!tid || isNaN(tid)) return;

  try {
    switch (resource) {
      case 'invoices':
        await sql`UPDATE tenants SET lifetime_invoices = COALESCE(lifetime_invoices, 0) + 1 WHERE id = ${tid}`;
        break;
      case 'quotations':
        await sql`UPDATE tenants SET lifetime_quotations = COALESCE(lifetime_quotations, 0) + 1 WHERE id = ${tid}`;
        break;
      case 'incomes':
        await sql`UPDATE tenants SET lifetime_incomes = COALESCE(lifetime_incomes, 0) + 1 WHERE id = ${tid}`;
        break;
      case 'expenses':
        await sql`UPDATE tenants SET lifetime_expenses = COALESCE(lifetime_expenses, 0) + 1 WHERE id = ${tid}`;
        break;
      case 'clients':
        await sql`UPDATE tenants SET lifetime_clients = COALESCE(lifetime_clients, 0) + 1 WHERE id = ${tid}`;
        break;
      case 'accounts':
        await sql`UPDATE tenants SET lifetime_accounts = COALESCE(lifetime_accounts, 0) + 1 WHERE id = ${tid}`;
        break;
    }
  } catch (err) {
    console.error(`Failed to increment lifetime ${resource} for tenant ${tid}:`, err);
  }
}
