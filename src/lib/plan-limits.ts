import postgres from "postgres";
const neon = postgres;

export type PlanTier = 'Free' | 'Pro' | 'Pro Plus';

export const PLAN_LIMITS = {
  Free: {
    maxInvoices: 100,
    maxIncomes: 100,
    maxExpenses: 100,
    maxClients: 50,
    maxAccounts: 2,
  },
  Pro: {
    maxInvoices: Infinity,
    maxIncomes: Infinity,
    maxExpenses: Infinity,
    maxClients: Infinity,
    maxAccounts: 2,
  },
  'Pro Plus': {
    maxInvoices: Infinity,
    maxIncomes: Infinity,
    maxExpenses: Infinity,
    maxClients: Infinity,
    maxAccounts: Infinity,
  }
};

export async function checkPlanLimit(tenantId: number, resourceType: keyof typeof PLAN_LIMITS['Free']) {
  const sql = neon(process.env.DATABASE_URL!);
  
  // Get tenant's plan & lifetime usage
  const tenantRes = await sql`
    SELECT plan, lifetime_invoices, lifetime_incomes, lifetime_expenses, lifetime_clients, lifetime_accounts 
    FROM tenants WHERE id = ${tenantId}
  `;
  if (tenantRes.length === 0) throw new Error("Tenant not found");
  
  const t = tenantRes[0];
  const plan = (t.plan || 'Free') as PlanTier;
  const limit = PLAN_LIMITS[plan][resourceType];
  
  if (limit === Infinity) return true;
  
  let currentCount = 0;
  
  switch (resourceType) {
    case 'maxInvoices': {
      const res = await sql`SELECT count(*) FROM invoices WHERE tenant_id = ${tenantId}`;
      currentCount = Math.max(t.lifetime_invoices ?? 0, parseInt(res[0].count));
      break;
    }
    case 'maxIncomes': {
      const res = await sql`SELECT count(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`;
      currentCount = Math.max(t.lifetime_incomes ?? 0, parseInt(res[0].count));
      break;
    }
    case 'maxExpenses': {
      const res = await sql`SELECT count(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`;
      currentCount = Math.max(t.lifetime_expenses ?? 0, parseInt(res[0].count));
      break;
    }
    case 'maxClients': {
      const res = await sql`SELECT count(*) FROM admin_clients WHERE tenant_id = ${tenantId}`;
      currentCount = Math.max(t.lifetime_clients ?? 0, parseInt(res[0].count));
      break;
    }
    case 'maxAccounts': {
      const res = await sql`SELECT count(*) FROM accounts WHERE tenant_id = ${tenantId}`;
      currentCount = Math.max(t.lifetime_accounts ?? 0, parseInt(res[0].count));
      break;
    }
  }
  
  if (currentCount >= limit) {
    throw new Error(`Plan lifetime limit reached for ${resourceType}. Deleting older records does not restore quota. Please upgrade your plan.`);
  }
  
  return true;
}
