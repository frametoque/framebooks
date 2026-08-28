
import sql from "@/lib/db";
import { getTenantId } from "@/app/(dashboard)/user/actions/actions";
import { getTenantPlan } from "@/app/(dashboard)/user/actions/plan";

export type PlanType = 'Free' | 'Pro' | 'Pro Plus';

export async function checkLimit(
  resource: 'invoices' | 'incomes' | 'expenses' | 'clients' | 'accounts' | 'team_members'
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
  switch (resource) {
    case 'invoices':
      current = parseInt((await sql`SELECT COUNT(*) FROM invoices WHERE tenant_id = ${tenantId}`)[0].count);
      break;
    case 'incomes':
      current = parseInt((await sql`SELECT COUNT(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`)[0].count);
      break;
    case 'expenses':
      current = parseInt((await sql`SELECT COUNT(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`)[0].count);
      break;
    case 'clients':
      current = parseInt((await sql`SELECT COUNT(*) FROM admin_clients WHERE tenant_id = ${tenantId}`)[0].count);
      break;
    case 'accounts':
      current = parseInt((await sql`SELECT COUNT(*) FROM accounts WHERE tenant_id = ${tenantId}`)[0].count);
      break;
  }
  
  if (current >= limit) {
    return { 
      allowed: false, 
      limit, 
      current, 
      error: `LIMIT_EXCEEDED: You have reached the maximum limit of ${limit} ${resource} for your ${plan} plan.` 
    };
  }
  
  return { allowed: true, limit, current };
}
