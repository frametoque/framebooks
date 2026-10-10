// src/app/(dashboard)/admin/analytics/AnalyticsClient.tsx
"use client";

import React from "react";
import Link from "next/link";
import { 
  Building2, 
  Users, 
  TrendingUp, 
  CreditCard,
  Repeat,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Money, PlanBadge, StatusPill } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";

export function AnalyticsClient({ data }: { data: any }) {
  const { 
    kpis, 
    funnel, 
    planDistribution, 
    billingIntervals, 
    paymentsByMethod, 
    topSubscribers, 
    recentPayments,
    cohorts 
  } = data;

  return (
    <div className="space-y-8">
      {/* Privacy Notice Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-foreground">Tenant Privacy & Security Enforced</span>
            <p className="text-muted-foreground mt-0.5">
              Admin analytics only display platform SaaS metrics (subscriptions, revenue, payment health, and account growth). Customer invoices, quotations, inventory, and banking records are strictly isolated.
            </p>
          </div>
        </div>
        <Link 
          href="/admin/subscriptions" 
          className="shrink-0 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
        >
          <span>Manage Subscriptions</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Top Financial & SaaS KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Monthly Recurring (MRR)"
          value={kpis.mrr}
          unit="LKR"
          icon={TrendingUp}
          iconBg="bg-emerald-500/15 dark:bg-emerald-400/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
          trend={`ARR: LKR ${(kpis.arr || 0).toLocaleString()}`}
          trendUp={true}
        />

        <AdminStatCard
          label="Paid Subscriptions"
          value={kpis.activePaidSubsCount}
          unit={`/ ${kpis.totalWorkspaces} orgs`}
          icon={Repeat}
          iconBg="bg-blue-500/15 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
          trend={`${funnel.paidConversionRate}% conversion rate`}
          trendUp={funnel.paidConversionRate > 0}
        />

        <AdminStatCard
          label="Revenue Collected"
          value={kpis.totalCollected}
          unit="LKR"
          icon={CreditCard}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
          trend={`${kpis.paidCount} successful payments`}
          trendUp={true}
        />

        <AdminStatCard
          label="Pending Verifications"
          value={kpis.pendingCount}
          unit="payments"
          icon={Clock}
          iconBg={kpis.pendingCount > 0 ? "bg-amber-500/15 dark:bg-amber-400/10" : "bg-muted/40"}
          iconColor={kpis.pendingCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}
          trend={kpis.totalPending > 0 ? `LKR ${kpis.totalPending.toLocaleString()} awaiting approval` : "All payments verified"}
          trendUp={false}
        />
      </div>

      {/* SaaS Subscription Conversion Funnel */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-base font-bold text-foreground">SaaS Subscription Funnel</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Lifecycle conversion from registration to paid software subscriber.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-500/20">
            {funnel.paidConversionRate}% Overall Paid Conversion
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Step 1: Registered Accounts */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Step 1</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Registered Users</h4>
              <span className="text-3xl font-extrabold text-foreground mt-3 block">{funnel.registeredUsers}</span>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Total platform accounts
            </div>
          </div>

          {/* Step 2: Workspaces Created */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Step 2</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Workspaces Created</h4>
              <span className="text-3xl font-extrabold text-foreground mt-3 block">{funnel.workspacesCreated}</span>
            </div>
            <div className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold">
              {funnel.workspaceRate}% of user accounts
            </div>
          </div>

          {/* Step 3: Active Workspaces */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Step 3</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Active Workspaces</h4>
              <span className="text-3xl font-extrabold text-foreground mt-3 block">{funnel.activeWorkspaces}</span>
            </div>
            <div className="mt-3 text-xs text-purple-600 dark:text-purple-400 font-semibold">
              {funnel.activeRate}% active in 30 days
            </div>
          </div>

          {/* Step 4: Paid Subscribers */}
          <div className="p-5 rounded-2xl bg-muted/40 border border-border flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Step 4</span>
              <h4 className="text-sm font-semibold text-foreground mt-0.5">Paid Subscribers</h4>
              <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-3 block">
                {funnel.paidSubscribers}
              </span>
            </div>
            <div className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {funnel.paidConversionRate}% paid customer rate
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Plan Distribution & Top Subscribers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Plans & Billing Intervals Breakdown */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-foreground">Subscription Plans</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Active subscriptions by tier</p>
          </div>

          {/* Plans list */}
          <div className="space-y-4">
            {planDistribution.map((p: any) => {
              const totalActive = kpis.activeSubsCount || 1;
              const pct = Math.round((p.count / totalActive) * 100);
              return (
                <div key={p.planName} className="p-4 rounded-2xl bg-muted/40 border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlanBadge plan={p.planName} />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {p.count} {p.count === 1 ? "org" : "orgs"}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-foreground">
                      {p.isPaid ? `LKR ${p.mrr.toLocaleString()} /mo` : "Free Tier"}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        p.planName.toLowerCase().includes("plus")
                          ? "bg-emerald-500"
                          : p.planName.toLowerCase().includes("pro")
                          ? "bg-blue-500"
                          : "bg-purple-500"
                      }`}
                      style={{ width: `${Math.max(pct, 5)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{pct}% of active workspaces</span>
                    {p.isPaid && <span>MRR Contribution</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Billing Interval & Health Stats */}
          <div className="pt-4 border-t border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Billing Cycles</h4>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-muted/30 border border-border rounded-2xl">
                <span className="text-lg font-bold text-foreground block">{billingIntervals.monthly}</span>
                <span className="text-[11px] text-muted-foreground font-medium">Monthly billing</span>
              </div>
              <div className="p-3 bg-muted/30 border border-border rounded-2xl">
                <span className="text-lg font-bold text-foreground block">{billingIntervals.yearly}</span>
                <span className="text-[11px] text-muted-foreground font-medium">Yearly billing</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 text-muted-foreground">
              <span>Past Due / Flagged:</span>
              <span className={`font-bold ${kpis.pastDueSubsCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {kpis.pastDueSubsCount} subscriptions
              </span>
            </div>
          </div>
        </div>

        {/* Top Subscribers by Framebooks Software Spend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground">Top Paying Workspaces</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Workspaces ranked by subscription payments made to Framebooks
              </p>
            </div>
            <Link 
              href="/admin/subscriptions" 
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <span>View all workspaces</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="pb-3">Workspace</th>
                  <th className="pb-3">Current Plan</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Renewal</th>
                  <th className="pb-3 text-right">Subscription Paid</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {topSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No workspace subscriptions recorded yet
                    </td>
                  </tr>
                ) : (
                  topSubscribers.map((b: any) => (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="truncate max-w-[160px] sm:max-w-[200px]">{b.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5">
                        <PlanBadge plan={b.plan} />
                      </td>
                      <td className="py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          b.sub_status === "active"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}>
                          {b.sub_status === "active" ? "Active" : "Past Due"}
                        </span>
                      </td>
                      <td className="py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                        {b.current_period_end ? (
                          new Date(b.current_period_end).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        ) : (
                          "Lifetime / None"
                        )}
                      </td>
                      <td className="py-3.5 text-right font-bold text-foreground whitespace-nowrap">
                        {b.total_paid_to_platform > 0 ? (
                          <Money amount={b.total_paid_to_platform} />
                        ) : (
                          <span className="text-muted-foreground text-xs font-normal">0 LKR</span>
                        )}
                      </td>
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/businesses/${b.id}`}
                          className="px-3 py-1 rounded-full border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors inline-flex items-center gap-1"
                        >
                          <span>Manage</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cash Flow & Platform Payment Methods */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Methods Mix */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-foreground">Payment Methods</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Breakdown of subscription payment channels</p>

          <div className="space-y-3 pt-2">
            {paymentsByMethod.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No payment methods recorded yet</p>
            ) : (
              paymentsByMethod.map((m: any) => (
                <div key={m.method} className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-foreground capitalize">
                      {m.method.replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {m.count} successful transaction{m.count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="text-right">
                    <Money amount={m.total_amount} className="font-bold text-foreground block text-sm" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Subscription Payments to Platform */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Subscription Payments</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Payments processed for Framebooks subscription plans
              </p>
            </div>
            <Link 
              href="/admin/payments" 
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
            >
              <span>View all payments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="pb-3">Payer / Workspace</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Date</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No subscription payments recorded yet
                    </td>
                  </tr>
                ) : (
                  recentPayments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-semibold text-foreground">
                        <div>
                          <span>{p.tenant_name || p.user_email}</span>
                          <span className="block text-[10px] text-muted-foreground font-mono">
                            {p.provider_reference || `PAY-${p.id}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <PlanBadge plan={p.plan_name || "Pro"} />
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          p.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : p.status === "pending"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="py-3 text-right font-bold text-foreground">
                        <Money amount={p.amount} />
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
