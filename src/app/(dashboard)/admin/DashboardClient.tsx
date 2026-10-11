// src/app/(dashboard)/admin/DashboardClient.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Receipt, 
  ArrowRight, 
  ChevronRight, 
  Clock, 
  Users, 
  Building2, 
  CreditCard,
  Calendar
} from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { Money, PlanBadge, formatLKR } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";

const PLAN_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];

export function DashboardClient({
  overviewData,
  analyticsData,
  currentRange,
  customFrom,
  customTo,
}: {
  overviewData: any;
  analyticsData: any;
  currentRange: string;
  customFrom?: string;
  customTo?: string;
}) {
  const router = useRouter();

  const { kpis: overviewKpis, charts, lists } = overviewData;
  const {
    kpis: analyticsKpis,
    billingIntervals,
    topSubscribers,
    recentPayments,
  } = analyticsData;

  const currentYear = new Date().getFullYear();
  const defaultFrom = `${currentYear - 1}-03-31`;
  const defaultTo = `${currentYear}-04-01`;

  const [fromDate, setFromDate] = useState(customFrom || defaultFrom);
  const [toDate, setToDate] = useState(customTo || defaultTo);

  useEffect(() => {
    if (customFrom) setFromDate(customFrom);
    if (customTo) setToDate(customTo);
  }, [customFrom, customTo]);

  const handleRangeChange = (range: string) => {
    if (range === "custom") {
      router.push(`/admin?range=custom&from=${fromDate}&to=${toDate}`);
    } else if (range === "lifetime") {
      router.push(`/admin?range=lifetime`);
    } else {
      router.push(`/admin?range=${range}`);
    }
  };

  const handleApplyCustomDates = (newFrom: string, newTo: string) => {
    setFromDate(newFrom);
    setToDate(newTo);
    router.push(`/admin?range=custom&from=${newFrom}&to=${newTo}`);
  };

  const ranges = [
    { key: "lifetime", label: "Lifetime" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
    { key: "12m", label: "12 months" },
    { key: "custom", label: "Custom Range" },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Chips & Quick Actions Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {ranges.map((r) => {
            const active = currentRange === r.key;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => handleRangeChange(r.key)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  active
                    ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                    : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-muted/50 shadow-2xs"
                }`}
              >
                {r.label}
              </button>
            );
          })}

          {/* Custom Date Pickers when Custom Range is active */}
          {currentRange === "custom" && (
            <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3.5 py-1.5 shadow-2xs text-xs">
              <Calendar className="w-3.5 h-3.5 text-brand-500 shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  handleApplyCustomDates(e.target.value, toDate);
                }}
                className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
                title="Start Date"
              />
              <span className="text-muted-foreground text-xs font-medium">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  handleApplyCustomDates(fromDate, e.target.value);
                }}
                className="bg-transparent text-foreground text-xs focus:outline-none cursor-pointer"
                title="End Date"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/payments"
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-xs"
          >
            <Receipt className="w-4 h-4" />
            <span>Payments</span>
          </Link>
        </div>
      </div>

      {/* Top Core KPIs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <AdminStatCard
          label="Monthly run rate (MRR)"
          value={overviewKpis.mrr}
          unit="LKR"
        />

        <AdminStatCard
          label="Active subscriptions"
          value={overviewKpis.activeSubscriptions}
          trend={`${overviewKpis.conversionRate}% conversion`}
          trendUp={true}
        />

        <AdminStatCard
          label="Total users"
          value={overviewKpis.totalUsers}
          trend={
            currentRange === "lifetime"
              ? "All time"
              : currentRange === "custom"
              ? `+${overviewKpis.newUsers} in range`
              : `+${overviewKpis.newUsers} signups`
          }
          trendUp={true}
        />

        <AdminStatCard
          label="Revenue Collected"
          value={analyticsKpis.totalCollected}
          unit="LKR"
          trend={`${analyticsKpis.paidCount} payments`}
          trendUp={true}
        />

        <AdminStatCard
          label="Pending review"
          value={overviewKpis.pendingCount}
          trend={overviewKpis.pendingTotal > 0 ? formatLKR(overviewKpis.pendingTotal) : "All clear"}
        />
      </div>

      {/* Visual Analytics & Plan Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="mb-6">
            <h3 className="text-base font-bold text-foreground">Revenue</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Historical payments processed per month</p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border/40" vertical={false} />
                <XAxis dataKey="label" stroke="currentColor" className="text-muted-foreground" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="currentColor" 
                  className="text-muted-foreground"
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(val) => val >= 1000000 ? `${val / 1000000}M` : `${val / 1000}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }}
                  formatter={(val: any) => [formatLKR(val), "Revenue"]}
                />
                <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Users by Plan Donut Chart & Billing Cycles */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Subscribers by Plan</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Platform users grouped by current tier</p>
          </div>
          <div className="h-[210px] w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.usersByPlan}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  stroke="none"
                >
                  {charts.usersByPlan.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderColor: 'hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    borderRadius: '16px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Billing Interval & Health Stats */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 bg-muted/30 border border-border rounded-2xl">
                <span className="text-base font-bold text-foreground block">{billingIntervals.monthly}</span>
                <span className="text-[10px] text-muted-foreground font-medium">Monthly billing</span>
              </div>
              <div className="p-2.5 bg-muted/30 border border-border rounded-2xl">
                <span className="text-base font-bold text-foreground block">{billingIntervals.yearly}</span>
                <span className="text-[10px] text-muted-foreground font-medium">Yearly billing</span>
              </div>
            </div>

            {/* Monthly Revenue by Plan */}
            {charts.revenueByPlan && charts.revenueByPlan.length > 0 && (
              <div className="pt-1 space-y-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Revenue this month · by plan
                </p>
                {charts.revenueByPlan.map((r: any, i: number) => {
                  const totalPlanRevenue = charts.revenueByPlan.reduce(
                    (sum: number, x: any) => sum + x.revenue, 0
                  );
                  const pct = totalPlanRevenue > 0
                    ? Math.round((r.revenue / totalPlanRevenue) * 100)
                    : 0;
                  return (
                    <div key={r.plan ?? i} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: PLAN_COLORS[i % PLAN_COLORS.length] }}
                      />
                      <span className="text-[11px] text-muted-foreground flex-1 truncate">
                        {r.plan ?? "Free"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1 bg-muted/50 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: PLAN_COLORS[i % PLAN_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-foreground tabular-nums">
                          {formatLKR(r.revenue)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {analyticsKpis.pastDueSubsCount > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                <span>Past Due:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {analyticsKpis.pastDueSubsCount} subscriptions
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top Paying Workspaces */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
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

      {/* Recent Subscription Payments to Platform */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
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

      {/* Actionable Lists: Pending Review Slips & Latest Signups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Slips */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Pending Review Slips</span>
            </h3>
            <Link href="/admin/payments?status=pending" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2.5">
            {lists.pendingPayments.length === 0 ? (
              <p className="text-muted-foreground text-xs py-8 text-center">No pending payments</p>
            ) : (
              lists.pendingPayments.map((p: any) => (
                <div key={p.id} className="p-3.5 bg-muted/30 border border-border/60 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground block">{p.tenant_name || p.user_email}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">{p.provider_reference || `PAY-${p.id}`}</span>
                  </div>
                  <div className="text-right">
                    <Money amount={p.amount} className="font-bold text-foreground block" />
                    <Link href={`/admin/payments/${p.id}`} className="text-brand-500 hover:underline font-semibold text-[11px] inline-flex items-center gap-0.5">
                      <span>Review</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Latest Signups */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-500" />
              <span>Latest Registered Users</span>
            </h3>
            <Link href="/admin/users" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="space-y-2.5">
            {lists.latestSignups.length === 0 ? (
              <p className="text-muted-foreground text-xs py-8 text-center">No signups yet</p>
            ) : (
              lists.latestSignups.map((u: any) => (
                <div key={u.id} className="p-3.5 bg-muted/30 border border-border/60 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-foreground hover:text-brand-500 block">
                      {u.full_name || u.email}
                    </Link>
                    <span className="text-muted-foreground text-[10px]">{u.email}</span>
                  </div>
                  {u.created_at ? (
                    <div className="text-right shrink-0">
                      <span className="font-medium text-foreground block text-xs">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-muted-foreground text-[10px] block">
                        {new Date(u.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">Unknown</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
