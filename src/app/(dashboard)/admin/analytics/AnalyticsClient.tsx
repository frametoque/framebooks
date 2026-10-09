// src/app/(dashboard)/admin/analytics/AnalyticsClient.tsx
"use client";

import React from "react";
import { 
  FileText, 
  Boxes, 
  Building2, 
  Users, 
  ArrowRight,
  TrendingUp,
  CreditCard
} from "lucide-react";
import { Money, PlanBadge } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";

export function AnalyticsClient({ data }: { data: any }) {
  const { funnel, featureAdoption, topBusinesses } = data;

  return (
    <div className="space-y-6">
      {/* Conversion Funnel */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-foreground">Conversion funnel</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Step 1: Sign up */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step 1</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Registered</h4>
              <span className="text-3xl font-extrabold text-foreground mt-3 block">{funnel.signups}</span>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">100% of accounts</div>
          </div>

          {/* Step 2: Created First Invoice */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step 2</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">First invoice</h4>
              <span className="text-3xl font-extrabold text-foreground mt-3 block">{funnel.createdInvoice}</span>
            </div>
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold">
              {funnel.invRate}% active
            </div>
          </div>

          {/* Step 3: Upgraded to Paid */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Step 3</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Paid subscriber</h4>
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3 block">
                {funnel.upgraded}
              </span>
            </div>
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {funnel.upgRate}% converted
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature Adoption Matrix */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-foreground">Feature adoption</h3>

          <div className="space-y-3 pt-1">
            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                <span className="text-sm font-semibold text-foreground">Quotations</span>
              </div>
              <span className="font-bold text-base text-foreground">{featureAdoption.quotationsUsed}</span>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Boxes className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-semibold text-foreground">Inventory</span>
              </div>
              <span className="font-bold text-base text-foreground">{featureAdoption.inventoryUsed}</span>
            </div>

            <div className="p-4 rounded-2xl bg-muted/40 border border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-purple-500" />
                <span className="text-sm font-semibold text-foreground">Accounts</span>
              </div>
              <span className="font-bold text-base text-foreground">{featureAdoption.multiAccountsUsed}</span>
            </div>
          </div>
        </div>

        {/* Top Businesses by Volume */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-foreground">Top businesses</h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="pb-3">Workspace</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Invoices</th>
                  <th className="pb-3 text-right">Lifetime volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {topBusinesses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      No businesses yet
                    </td>
                  </tr>
                ) : (
                  topBusinesses.map((b: any) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-semibold text-foreground">
                        {b.name}
                      </td>
                      <td className="py-3">
                        <PlanBadge plan={b.plan} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {b.invoice_count}
                      </td>
                      <td className="py-3 text-right font-bold text-foreground">
                        <Money amount={b.total_volume} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
