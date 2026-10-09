// src/app/(dashboard)/admin/OverviewClient.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Users, 
  Repeat, 
  Clock, 
  ArrowRight,
  TrendingUp,
  Receipt
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

export function OverviewClient({
  data,
  currentRange,
}: {
  data: any;
  currentRange: string;
  }) {
  const router = useRouter();
  const { kpis, charts, lists } = data;

  const handleRangeChange = (range: string) => {
    router.push(`/admin?range=${range}`);
  };

  const ranges = [
    { key: "7d", label: "7 days" },
    { key: "30d", label: "30 days" },
    { key: "90d", label: "90 days" },
    { key: "12m", label: "12 months" },
  ];

  return (
    <div className="space-y-6">
      {/* Top of Page: KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminStatCard
          label="Monthly run rate"
          value={kpis.mrr}
          unit="LKR"
          icon={TrendingUp}
          iconBg="bg-emerald-100/80 dark:bg-emerald-400/10"
          iconColor="text-emerald-700 dark:text-emerald-400"
        />

        <AdminStatCard
          label="Active subscriptions"
          value={kpis.activeSubscriptions}
          icon={Repeat}
          iconBg="bg-blue-100/80 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
          trend={`${kpis.conversionRate} conversion`}
          trendUp={true}
        />

        <AdminStatCard
          label="Total users"
          value={kpis.totalUsers}
          icon={Users}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
          trend={`+${kpis.newUsers} signups`}
          trendUp={true}
        />

        <AdminStatCard
          label="Pending review"
          value={kpis.pendingCount}
          icon={Clock}
          iconBg="bg-amber-100/80 dark:bg-amber-400/10"
          iconColor="text-amber-700 dark:text-amber-400"
          trend={kpis.pendingTotal > 0 ? `${formatLKR(kpis.pendingTotal)}` : "All clear"}
        />
      </div>

      {/* Filter Chips Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {ranges.map((r) => {
            const active = currentRange === r.key;
            return (
              <button
                key={r.key}
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Over Time Bar Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs">
          <div className="mb-6">
            <h3 className="text-base font-bold text-foreground">Revenue</h3>
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

        {/* Users by Plan Donut Chart */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">Subscribers by plan</h3>
          </div>
          <div className="h-[220px] w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.usersByPlan}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
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
        </div>
      </div>

      {/* Actionable Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Slips */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Pending review</span>
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
              <span>Latest signups</span>
            </h3>
            <Link href="/admin/subscriptions" className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
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
                  <PlanBadge plan={u.plan} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
