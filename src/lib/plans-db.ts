// src/lib/plans-db.ts
import sql, { cachedQuery } from "@/lib/db";
import { plans as fallbackPlans } from "@/data/landing/content";

export interface DBPlan {
  id: number;
  key: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  is_active: boolean;
  is_popular: boolean;
  sort_order: number;
  limits: {
    invoices: number;
    incomes: number;
    expenses: number;
    clients: number;
    accounts: number;
    team_members: number;
  };
  features: {
    inventory: boolean;
    advanced_reports: boolean;
    two_factor: boolean;
    audit_logs: boolean;
  };
}

/**
 * Single source of truth for plans, cached for performance with revalidation tag.
 * Automatically falls back to local static constants if DB is unreachable.
 */
export async function getActivePlans(): Promise<DBPlan[]> {
  try {
    return await cachedQuery(
      async () => {
        const rows = await sql`
          SELECT * FROM plans WHERE is_active = true ORDER BY sort_order ASC
        `;
        if (rows.length === 0) throw new Error("No plans in database");
        return (rows as unknown) as DBPlan[];
      },
      ["plans-all"],
      3600
    );
  } catch (err) {
    console.warn("Falling back to static plan definitions:", err);
    // Format fallback data
    return [
      {
        id: 1,
        key: 'free',
        name: 'Free',
        description: 'For solo entrepreneurs & micro-businesses getting started.',
        price_monthly: 0,
        price_yearly: 0,
        currency: 'LKR',
        is_active: true,
        is_popular: false,
        sort_order: 1,
        limits: { invoices: 50, incomes: 100, expenses: 100, clients: 50, accounts: 2, team_members: 0 },
        features: { inventory: false, advanced_reports: false, two_factor: false, audit_logs: false }
      },
      {
        id: 2,
        key: 'pro',
        name: 'Pro',
        description: 'Advanced tools to manage finances and grow faster.',
        price_monthly: 2500,
        price_yearly: 25000,
        currency: 'LKR',
        is_active: true,
        is_popular: true,
        sort_order: 2,
        limits: { invoices: -1, incomes: -1, expenses: -1, clients: -1, accounts: 2, team_members: 0 },
        features: { inventory: false, advanced_reports: true, two_factor: true, audit_logs: false }
      },
      {
        id: 3,
        key: 'pro_plus',
        name: 'Pro Plus',
        description: 'For Power Users and large teams',
        price_monthly: 5000,
        price_yearly: 50000,
        currency: 'LKR',
        is_active: true,
        is_popular: false,
        sort_order: 3,
        limits: { invoices: -1, incomes: -1, expenses: -1, clients: -1, accounts: -1, team_members: -1 },
        features: { inventory: true, advanced_reports: true, two_factor: true, audit_logs: true }
      }
    ];
  }
}

export async function getLandingPlansFormatted() {
  const dbPlans = await getActivePlans();
  return dbPlans.map((p) => {
    const limits = p.limits || {} as any;
    const features = p.features || {} as any;

    return {
      name: p.name,
      description: p.description,
      monthlyPrice: p.price_monthly,
      yearlyPrice: p.price_yearly,
      features: [
        { label: 'Invoices Limit', value: limits.invoices === -1 ? 'Unlimited' : String(limits.invoices ?? 50), icon: 'MdCallMade' },
        { label: 'Income Limit', value: limits.incomes === -1 ? 'Unlimited' : String(limits.incomes ?? 100), icon: 'MdCallMade' },
        { label: 'Expense Limit', value: limits.expenses === -1 ? 'Unlimited' : String(limits.expenses ?? 100), icon: 'MdCallMade' },
        { label: 'Client Limit', value: limits.clients === -1 ? 'Unlimited' : String(limits.clients ?? 50), icon: 'MdGroup' },
        { label: 'Bank Accounts', value: limits.accounts === -1 ? 'Unlimited' : String(limits.accounts ?? 2), icon: 'MdAccountBalance' },
        { label: 'Team Members', value: limits.team_members === -1 ? 'Unlimited' : (limits.team_members > 0 ? String(limits.team_members) : 'No'), icon: 'MdGroup' },
        { label: 'Inventory Management', value: features.inventory ? 'Yes' : 'No', icon: 'MdCheck' },
        { label: 'Advanced Reports', value: features.advanced_reports ? 'Yes' : 'No', icon: 'MdCheck' },
        { label: 'Security Level', value: features.audit_logs ? 'Max + Audit Logs' : (features.two_factor ? 'High + 2FA' : 'Standard'), icon: 'MdCheck' },
      ],
      highlight: p.key === 'pro_plus',
      badge: p.is_popular ? 'POPULAR' : null,
    };
  });
}
