export type PlanRecommendation = 'Free' | 'Pro' | 'Pro Plus';

export interface PlanLimits {
  invoices: number; // lifetime
  clients: number;
  accounts: number;
}

export const planLimits = {
  Free: { invoices: 50, clients: 50, accounts: 2 },
  Pro: { invoices: Infinity, clients: Infinity, accounts: 2 },
  ProPlus: { invoices: Infinity, clients: Infinity, accounts: Infinity }
};

export function recommendPlan(
  invoices: number,
  clients: number,
  accounts: number,
  needsInventory: boolean,
  needsAdvancedReports: boolean,
  needsAuditLogs: boolean
): { plan: PlanRecommendation; reason: string } {
  if (needsAuditLogs || needsInventory || accounts > planLimits.Pro.accounts) {
    return {
      plan: 'Pro Plus',
      reason: needsInventory 
        ? 'Inventory management is exclusively available on the Pro Plus plan.'
        : needsAuditLogs 
          ? 'System audit logs are exclusively available on the Pro Plus plan.'
          : 'You need more than 2 bank/cash accounts, which requires Pro Plus.'
    };
  }

  if (needsAdvancedReports || invoices > planLimits.Free.invoices || clients > planLimits.Free.clients) {
    return {
      plan: 'Pro',
      reason: needsAdvancedReports
        ? 'Advanced reports are available on the Pro plan.'
        : invoices > planLimits.Free.invoices
          ? `You need more than ${planLimits.Free.invoices} invoices (Free plan includes up to ${planLimits.Free.invoices} lifetime invoices).`
          : `You manage more than ${planLimits.Free.clients} clients.`
    };
  }

  return {
    plan: 'Free',
    reason: 'Your current needs fit within the lifetime limits of our Free plan.'
  };
}
