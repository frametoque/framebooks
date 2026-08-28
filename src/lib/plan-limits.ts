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
  
  // Get tenant's plan
  const tenantRes = await sql`SELECT plan FROM tenants WHERE id = ${tenantId}`;
  if (tenantRes.length === 0) throw new Error("Tenant not found");
  
  const plan = (tenantRes[0].plan || 'Free') as PlanTier;
  const limit = PLAN_LIMITS[plan][resourceType];
  
  if (limit === Infinity) return true;
  
  let currentCount = 0;
  
  switch (resourceType) {
    case 'maxInvoices': {
      const res = await sql`SELECT count(*) FROM invoices WHERE tenant_id = ${tenantId}`;
      currentCount = parseInt(res[0].count);
      break;
    }
    case 'maxIncomes': {
      const res = await sql`SELECT count(*) FROM admin_incomes WHERE tenant_id = ${tenantId}`;
      currentCount = parseInt(res[0].count);
      break;
    }
    case 'maxExpenses': {
      const res = await sql`SELECT count(*) FROM admin_expenses WHERE tenant_id = ${tenantId}`;
      currentCount = parseInt(res[0].count);
      break;
    }
    case 'maxClients': {
      const res = await sql`SELECT count(*) FROM admin_clients WHERE tenant_id = ${tenantId}`;
      currentCount = parseInt(res[0].count);
      break;
    }
    case 'maxAccounts': {
      const res = await sql`SELECT count(*) FROM accounts WHERE tenant_id = ${tenantId}`;
      currentCount = parseInt(res[0].count);
      break;
    }
  }
  
  if (currentCount >= limit) {
    throw new Error(`Plan limit reached for ${resourceType}. Please upgrade your plan.`);
  }
  
  return true;
}
