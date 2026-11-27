"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui/Loader";
import Link from "next/link";
import { Receipt, Folder, CheckSquare, Droplets, ArrowRight } from "lucide-react";
import { MdAccountBalance, MdAccountBalanceWallet, MdTrendingUp, MdErrorOutline, MdCallMade, MdCallReceived, MdInsertDriveFile, MdGroup, MdRemoveRedEye, MdCalendarToday, MdLocationOn, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdCheck, MdPointOfSale } from "react-icons/md";
import { motion, Variants } from "framer-motion";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { getDashboardData } from "../actions/actions";
import { useAdminDateRange } from "../context/AdminDateRangeContext";
import ExpenseBreakdownWidget from "../components/ExpenseBreakdownWidget";
import TopClientsWidget from "../components/TopClientsWidget";
import AnimatedNumber from "../components/AnimatedNumber";
import AutoFitStatNumber from "../components/AutoFitStatNumber";
import GettingStartedCard from "../components/GettingStartedCard";
import { getClientTenantInfo } from "@/lib/tenant/clientTenantInfo";
import { useAccentTheme } from "@/lib/theme/useAccentTheme";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `${num} LKR`;
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function DashboardPage() {
  const { accent } = useAccentTheme();
  const { startDate, endDate } = useAdminDateRange();
  const [data, setData] = useState<any>(null);
  const [tenantInfo, setTenantInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [isProcessingInvite, setIsProcessingInvite] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{title: string, message: string, type: 'success' | 'error', onDismiss?: () => void} | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Fetch invitations asynchronously without blocking dashboard render
        fetch("/api/team/invitations/pending")
          .then((r) => (r.ok ? r.json() : null))
          .then((inv) => {
            if (!cancelled && inv?.pending) {
              setPendingInvitations(inv.pending);
            }
          })
          .catch(() => null);

        // Fetch tenant info (deduplicated client-side with layout request)
        getClientTenantInfo()
          .then((info) => {
            if (!cancelled && info) {
              setTenantInfo(info);
            }
          })
          .catch(() => null);

        const res = await getDashboardData(startDate, endDate);
        if (cancelled) return;
        setData(res);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (!loading && !data) {
    if (typeof window !== "undefined") {
      window.location.href = "/onboarding";
    }
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Skeleton Stats Cards (Row 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i} 
              className={`bg-card border border-border rounded-3xl p-4 sm:p-5 xl:p-6 flex items-center gap-3.5 animate-pulse shadow-xs min-w-0 ${
                i === 4 ? "sm:col-span-2 lg:col-span-2 xl:col-span-1" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-black/5 dark:bg-card shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <div className="h-3.5 bg-black/5 dark:bg-card rounded-full w-20" />
                <div className="h-7 bg-black/10 dark:bg-white/10 rounded-full w-28" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Stats Cards (Row 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-3 animate-pulse shadow-xs min-w-0">
              <div className="h-3.5 bg-black/5 dark:bg-card rounded-full w-28" />
              <div className="h-7 bg-black/10 dark:bg-white/10 rounded-full w-32" />
            </div>
          ))}
        </div>

        {/* Skeleton Analytics Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse shadow-xs">
              <div className="p-3 rounded-2xl bg-black/5 dark:bg-card w-12 h-12" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-black/5 dark:bg-card rounded-full w-24" />
                <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Skeleton Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 animate-pulse space-y-6 shadow-xs">
            <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-40" />
            <div className="h-[280px] bg-black/5 dark:bg-card rounded-2xl" />
          </div>
          <div className="bg-card border border-border rounded-3xl p-6 animate-pulse space-y-6 shadow-xs">
            <div className="h-6 bg-black/10 dark:bg-white/10 rounded-full w-40" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-black/5 dark:bg-card rounded-2xl border border-border" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { 
      label: "Available Funds", 
      value: formatLKR(data.totalAssets || 0), 
      subtext: (data.totalAfterDebts !== undefined && data.totalAfterDebts > data.totalAssets) ? `After Debts: ${formatLKR(data.totalAfterDebts)}` : (data.totalCapital > 0 ? `Total Capital: ${formatLKR(data.totalCapital)}` : undefined), 
      icon: MdAccountBalance, 
      color: "text-blue-700 dark:text-blue-400", 
      bg: "bg-blue-100/70 dark:bg-blue-400/10",
      href: "/user/accounts"
    },
    { 
      label: "Total Income", 
      value: formatLKR(data.totalIncome), 
      icon: MdAccountBalanceWallet, 
      color: "text-emerald-700 dark:text-green-400", 
      bg: "bg-emerald-100/70 dark:bg-green-400/10",
      href: "/user/income"
    },
    { 
      label: "Total Expenses", 
      value: formatLKR(data.totalExpenses), 
      icon: Receipt, 
      color: "text-red-700 dark:text-red-400", 
      bg: "bg-red-100/70 dark:bg-red-400/10",
      href: "/user/expenses"
    },
    { 
      label: "Net Profit", 
      value: formatLKR(data.netProfit), 
      icon: MdTrendingUp, 
      color: "text-brand-800 dark:text-brand-400", 
      bg: "bg-brand-500/15 dark:bg-brand-400/10"
      // Net Profit has no link
    },
  ];

  const analyticsStats: any[] = [];

  const handleRespondInvite = async (invitationId: number, action: 'accept' | 'decline') => {
    setIsProcessingInvite(invitationId.toString());
    try {
      const res = await fetch('/api/team/invitations/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId, action }),
      });
      const data = await res.json();
      if (res.ok) {
        if (action === 'accept') {
          setModalMessage({
            title: "Success",
            message: "Invitation accepted! You are now part of the new team.",
            type: "success",
            onDismiss: () => window.location.reload()
          });
        } else {
          setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
        }
      } else {
        setModalMessage({
          title: "Error",
          message: data.error || "Failed to process invitation.",
          type: "error"
        });
      }
    } catch (e: any) {
      setModalMessage({
        title: "Error",
        message: "An unexpected error occurred.",
        type: "error"
      });
    } finally {
      setIsProcessingInvite(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {pendingInvitations.length > 0 && (
        <div className="space-y-3 mb-6">
          {pendingInvitations.map(invite => (
            <div key={invite.id} className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
                  <MdGroup className="w-5 h-5 text-brand-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Team Invitation</h3>
                  <p className="text-sm text-gray-300">You have been invited to join <span className="font-bold text-foreground">{invite.tenant_name}</span>.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleRespondInvite(invite.id, 'decline')}
                  disabled={isProcessingInvite === invite.id.toString()}
                  className="px-4 py-2 bg-card hover:bg-black/10 dark:hover:bg-white/10 border border-border rounded-xl text-foreground text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={() => handleRespondInvite(invite.id, 'accept')}
                  disabled={isProcessingInvite === invite.id.toString()}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessingInvite === invite.id.toString() ? "Processing..." : "Accept & Join"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {stats.map((stat, i) => {
          const cardContent = (
            <div className={`bg-card border border-border rounded-3xl p-4 sm:p-5 xl:p-6 flex items-center gap-3.5 transition-all shadow-xs min-w-0 h-full ${stat.href ? 'hover:shadow-md hover:border-border/80 dark:hover:border-white/20 cursor-pointer group' : ''}`}>
              <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${stat.bg} ${stat.href ? 'group-hover:scale-105 transition-transform' : ''}`}>
                <stat.icon className={`w-5 h-5 sm:w-5 sm:h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium truncate mb-1" title={stat.label}>
                  {stat.label}
                </p>
                <AutoFitStatNumber 
                  value={stat.value} 
                  maxFontSize={28}
                  minFontSize={13}
                />
                {stat.subtext && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 truncate" title={stat.subtext} data-stat-value>
                    {stat.subtext}
                  </p>
                )}
              </div>
            </div>
          );

          return (
            <motion.div variants={itemVariants} key={i} className="min-w-0 h-full">
              {stat.href ? (
                <Link href={stat.href} prefetch={false} className="block h-full focus:outline-none">
                  {cardContent}
                </Link>
              ) : (
                cardContent
              )}
            </motion.div>
          );
        })}

        <motion.div 
          variants={itemVariants} 
          className="relative group min-w-0 sm:col-span-2 lg:col-span-2 xl:col-span-1 h-full"
        >
          <Link
            href="/user/invoices"
            prefetch={false}
            className="bg-card border border-border rounded-3xl p-4 sm:p-5 xl:p-6 flex items-center gap-3.5 hover:shadow-md hover:border-amber-500/30 transition-all shadow-xs cursor-pointer min-w-0 h-full w-full block focus:outline-none"
          >
            <div className="flex items-center gap-3.5 min-w-0 w-full">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/80 dark:bg-amber-400/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                  <AnimatedNumber value={data.unpaidCount || 0} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium truncate mb-1" title="Unpaid Invoices">
                  Unpaid Invoices
                </p>
                <AutoFitStatNumber 
                  value={formatLKR(data.unpaidAmount || 0)} 
                  maxFontSize={28}
                  minFontSize={13}
                  colorClass="text-amber-600 dark:text-amber-400"
                />
              </div>
            </div>
          </Link>

          <div className="absolute top-[calc(100%+10px)] right-0 w-80 bg-popover border border-border dark:border-white/15 rounded-3xl p-5 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] backdrop-blur-xl pointer-events-none group-hover:pointer-events-auto">
            <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-border/50 dark:border-white/10">
              <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Unpaid Invoices
              </p>
              <Link 
                href="/user/invoices?status=unpaid"
                prefetch={false}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-500 flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {data.unpaidClients && data.unpaidClients.length > 0 ? (
              <div className="space-y-3">
                {data.unpaidClients.slice(0, 6).map((client: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-sm border-b border-border/40 dark:border-white/5 pb-2.5 last:border-0 last:pb-0">
                    <div className="truncate pr-3 min-w-0">
                      <p className="text-foreground/90 font-semibold truncate text-xs">{client.name}</p>
                      {client.count > 0 && (
                        <p className="text-[10px] text-muted-foreground">{client.count} {client.count === 1 ? 'invoice' : 'invoices'}</p>
                      )}
                    </div>
                    <span className="text-amber-700 dark:text-amber-400 font-bold whitespace-nowrap text-right text-xs">
                      {formatLKR(client.amount)}
                    </span>
                  </div>
                ))}
                {data.unpaidClients.length > 6 && (
                  <div className="text-center text-xs text-muted-foreground pt-1 font-medium">
                    + {data.unpaidClients.length - 6} more clients
                  </div>
                )}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-muted-foreground mb-3">No unpaid invoices at the moment.</p>
                <Link
                  href="/user/invoices?status=unpaid"
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <span>View all invoices</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "This Month Income", value: data.currentMonthStats?.income || 0, prevValue: data.currentMonthStats?.lastMonthIncome || 0, isCurrency: true },
          { label: "This Month Expenses", value: data.currentMonthStats?.expenses || 0, prevValue: data.currentMonthStats?.lastMonthExpenses || 0, isCurrency: true, invertColors: true },
          { label: "This Month Profit", value: (data.currentMonthStats?.income || 0) - (data.currentMonthStats?.expenses || 0), prevValue: (data.currentMonthStats?.lastMonthIncome || 0) - (data.currentMonthStats?.lastMonthExpenses || 0), isCurrency: true },
          { label: "Year to Date Profit", value: data.netIncomeComparison?.currentNet || 0, prevValue: data.netIncomeComparison?.previousNet || 0, isCurrency: true }
        ].map((stat, i) => {
          let pct = 0;
          if (stat.prevValue === 0) pct = stat.value > 0 ? 100 : 0;
          else pct = ((stat.value - stat.prevValue) / Math.abs(stat.prevValue)) * 100;
          const isPositive = pct >= 0;
          const displayPct = Math.abs(pct).toFixed(1);
          let pctColor = "text-gray-500 dark:text-gray-400";
          if (pct > 0) pctColor = stat.invertColors ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-green-400";
          else if (pct < 0) pctColor = stat.invertColors ? "text-emerald-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

          return (
            <motion.div variants={itemVariants} key={i} className="bg-card border border-border rounded-3xl p-5 sm:p-6 hover:shadow-md transition-all shadow-xs flex flex-col justify-between min-w-0 h-full">
              <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm font-medium mb-2 truncate" title={stat.label}>{stat.label}</p>
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                <div className="flex-1 min-w-0 pr-1">
                  <AutoFitStatNumber 
                    value={stat.isCurrency ? formatLKR(stat.value) : stat.value} 
                    maxFontSize={30}
                    minFontSize={13}
                  />
                </div>
                <div className={`flex items-center gap-1 text-xs xl:text-sm font-semibold shrink-0 ${pctColor}`}>
                  {isPositive ? <MdCallMade className="w-3.5 h-3.5" /> : <MdCallReceived className="w-3.5 h-3.5" />}
                  <span><AnimatedNumber value={displayPct + "%"} /></span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Getting Started Guide / Tour Checklist */}
      <GettingStartedCard
        tenantId={data?.tenantId || tenantInfo?.id}
        tenantInfo={tenantInfo}
        dashboardData={data}
      />

      {analyticsStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analyticsStats.map((stat, i) => (
            <motion.div variants={itemVariants} key={i} className="bg-card border border-border rounded-3xl p-7 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
              <div className={`p-3 rounded-2xl ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">
                  <AnimatedNumber value={stat.value} />
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-foreground">Income vs Expenses</h2>
            <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
              <button onClick={() => setChartYear(y => y - 1)} className="hover:text-foreground transition-colors p-1"><MdKeyboardArrowLeft className="w-4 h-4" /></button>
              <span className="text-foreground font-semibold text-sm">{chartYear}</span>
              <button onClick={() => setChartYear(y => y + 1)} className="hover:text-foreground transition-colors p-1"><MdKeyboardArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chartData.filter((d: any) => d.year === chartYear)} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#9ca3af" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `LKR ${value / 1000000}M`;
                    if (value >= 1000) return `LKR ${value / 1000}k`;
                    return `LKR ${value}`;
                  }} 
                />
                <Tooltip 
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const inc = payload.find((p: any) => p.dataKey === 'income')?.value || 0;
                      const exp = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
                      const profit = inc - exp;
                      return (
                        <div className="bg-[#0a0a0f]/95 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-2">
                          <p className="font-semibold text-gray-400">{label}</p>
                          <div className="flex items-center gap-4 text-xs font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                              <span className="text-gray-400">INC:</span>
                              <span className="font-semibold text-white tabular-nums">{formatLKR(inc)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
                              <span className="text-gray-400">EXP:</span>
                              <span className="font-semibold text-white tabular-nums">{formatLKR(exp)}</span>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-white/10 flex justify-between items-center gap-4">
                            <span className="text-gray-400">Net Profit:</span>
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: profit >= 0 ? "#10b981" : "#f43f5e" }}
                            >
                              {profit >= 0 ? "+" : ""}
                              {formatLKR(profit)}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}/>
                <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" strokeWidth={2} fill="url(#dashIncomeGrad)" fillOpacity={1} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#dashExpenseGrad)" fillOpacity={1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ExpenseBreakdownWidget 
            initialData={data.expenseBreakdown} 
            initialExpenseData={data.expenseBreakdown} 
            initialIncomeData={data.incomeBreakdown} 
          />
        </motion.div>
      </div>

      {/* Top Grid: Recent Transactions & Net Income Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent Transactions (Now Top, 2 columns) */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recent Transactions</h2>
            </div>
            <div className="space-y-3">
              {data.recentTransactions.map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-card border border-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="text-foreground flex shrink-0">
                      {tx.isPos || tx.type === 'pos' ? (
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                          tx.isNegative 
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' 
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                          <MdPointOfSale className="w-4 h-4" />
                        </div>
                      ) : tx.type === 'income' ? (
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-green-400 border border-emerald-500/20 flex items-center justify-center">
                          <MdCallReceived className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center">
                          <MdCallMade className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">{tx.name}</p>
                        {(tx.isPos || tx.type === 'pos') && (
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 shrink-0">
                            POS
                          </span>
                        )}
                        {tx.posStatus && tx.posStatus !== 'completed' && (
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full border shrink-0 ${
                            tx.isNegative || tx.posStatus === 'refunded' || tx.posStatus === 'voided'
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                              : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
                          }`}>
                            {tx.posStatus}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tx.date}</p>
                    </div>
                  </div>
                  <p className={`font-semibold text-sm shrink-0 ml-3 ${
                    tx.isNegative || tx.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-green-400'
                  }`}>
                    {tx.isNegative || tx.type === 'expense' ? '-' : '+'}{formatLKR(tx.amount)}
                  </p>
                </div>
              ))}
              {data.recentTransactions.length === 0 && <p className="text-gray-500 text-sm">No recent transactions.</p>}
            </div>
          </div>
        </motion.div>

        {/* Net Income comparison table */}
        <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-7 flex flex-col justify-between shadow-xs">
          <div>
            <h2 className="text-xl font-semibold mb-6 text-foreground">Net Income</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-black/[0.02] dark:bg-white/[0.02] text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Fiscal Year</th>
                    <th className="py-3 px-4 text-right">Previous (2025)</th>
                    <th className="py-3 px-4 text-right">Current (2026)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors">
                    <td className="py-4 px-4 text-foreground/90 font-medium">Income</td>
                    <td className="py-4 px-4 text-right font-semibold text-emerald-600 dark:text-green-400">
                      {formatLKR(data.netIncomeComparison.previousIncome)}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-emerald-600 dark:text-green-400">
                      {formatLKR(data.netIncomeComparison.currentIncome)}
                    </td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors">
                    <td className="py-4 px-4 text-foreground/90 font-medium">Expense</td>
                    <td className="py-4 px-4 text-right font-semibold text-red-600 dark:text-red-400">
                      {formatLKR(data.netIncomeComparison.previousExpense)}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-red-600 dark:text-red-400">
                      {formatLKR(data.netIncomeComparison.currentExpense)}
                    </td>
                  </tr>
                  <tr className="hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors font-semibold">
                    <td className="py-4 px-4 text-foreground font-bold">Net Income</td>
                    <td className={`py-4 px-4 text-right font-bold ${data.netIncomeComparison.previousNet >= 0 ? "text-emerald-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {data.netIncomeComparison.previousNet < 0 ? "-" : ""}{formatLKR(Math.abs(data.netIncomeComparison.previousNet))}
                    </td>
                    <td className={`py-4 px-4 text-right font-bold ${data.netIncomeComparison.currentNet >= 0 ? "text-emerald-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {data.netIncomeComparison.currentNet < 0 ? "-" : ""}{formatLKR(Math.abs(data.netIncomeComparison.currentNet))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Grid: Recent Invoices, Recent Quotations & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent Invoices (Now Bottom) */}
        <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-7 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recent Invoices</h2>
            </div>
            <div className="space-y-4">
              {data.recentInvoices.map((invoice: any, i: number) => {
                let statusColor = "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-400/10 dark:border-gray-400/20";
                const statusStr = invoice.status?.toLowerCase() || '';
                if (statusStr === 'paid' || statusStr === 'fully paid') {
                  statusColor = "text-emerald-700 bg-emerald-100/70 border-emerald-200/60 dark:text-green-400 dark:bg-green-400/10 dark:border-green-400/20";
                } else if (statusStr === 'unpaid' || statusStr === 'pending') {
                  statusColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20";
                } else if (statusStr === 'overdue') {
                  statusColor = "text-red-700 bg-red-100/70 border-red-200/60 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20";
                } else if (statusStr.includes('advance')) {
                  statusColor = "text-blue-700 bg-blue-100/70 border-blue-200/60 dark:text-blue-400 dark:bg-blue-400/10 dark:border-blue-400/20";
                } else if (statusStr === 'refunded') {
                  statusColor = "text-purple-700 bg-purple-100/70 border-purple-200/60 dark:text-purple-400 dark:bg-purple-400/10 dark:border-purple-400/20";
                } else if (statusStr === 'cancelled' || statusStr === 'canceled' || statusStr === 'voided') {
                  statusColor = "text-rose-700 bg-rose-100/70 border-rose-200/60 dark:text-rose-400 dark:bg-rose-400/10 dark:border-rose-400/20";
                }

                return (
                  <Link
                    key={i}
                    href={`/user/invoice/${invoice.id}`}
                    prefetch={false}
                    className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-card border border-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors block"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-emerald-700 dark:text-brand-400 shrink-0">#{invoice.id}</span>
                          <span className="text-gray-300 dark:text-gray-600 shrink-0">•</span>
                          <p className="font-semibold text-sm text-foreground truncate">{invoice.service || 'Invoice'}</p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{invoice.client || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="font-semibold text-sm text-foreground">{formatLKR(invoice.amount)}</p>
                      <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {data.recentInvoices.length === 0 && <p className="text-gray-500 text-sm">No recent invoices.</p>}
            </div>
          </div>
        </motion.div>

        {/* Recent Quotations (Now Bottom) */}
        <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-7 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-foreground">Recent Quotations</h2>
            </div>
            <div className="space-y-4">
              {data.recentQuotations && data.recentQuotations.map((quotation: any, i: number) => {
                let statusColor = "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-400/10 dark:border-gray-400/20";
                const statusStr = quotation.status?.toLowerCase() || '';
                if (statusStr === 'accepted' || statusStr === 'approved') {
                  statusColor = "text-emerald-700 bg-emerald-100/70 border-emerald-200/60 dark:text-green-400 dark:bg-green-400/10 dark:border-green-400/20";
                } else if (statusStr === 'pending' || statusStr === 'sent') {
                  statusColor = "text-amber-800 bg-amber-100/70 border-amber-200/60 dark:text-amber-400 dark:bg-amber-400/10 dark:border-amber-400/20";
                } else if (statusStr === 'rejected' || statusStr === 'declined') {
                  statusColor = "text-red-700 bg-red-100/70 border-red-200/60 dark:text-red-400 dark:bg-red-400/10 dark:border-red-400/20";
                } else if (statusStr === 'expired') {
                  statusColor = "text-gray-600 bg-gray-100 border-gray-200 dark:text-gray-400 dark:bg-gray-400/10 dark:border-gray-400/20";
                }

                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/[0.02] dark:bg-card border border-border rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground">
                          {quotation.project && quotation.project.length > 26 
                            ? quotation.project.substring(0, 26) + '...' 
                            : quotation.project || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{quotation.client || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-foreground">{formatLKR(quotation.amount)}</p>
                      <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {quotation.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {!data.recentQuotations || data.recentQuotations.length === 0 && <p className="text-gray-500 text-sm">No recent quotations.</p>}
            </div>
          </div>
        </motion.div>

        {/* Top Clients Widget */}
        <TopClientsWidget initialData={data.topClients} totalIncome={data.totalIncome} />
      </div>

      {/* Modal Overlay */}
      {modalMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-popover border border-border dark:border-white/15 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
          >
            <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center ${modalMessage.type === 'success' ? 'bg-emerald-100/70 dark:bg-green-500/10 text-emerald-700 dark:text-green-400' : 'bg-red-100/70 dark:bg-red-500/10 text-red-700 dark:text-red-400'}`}>
              {modalMessage.type === 'success' ? <MdCheck className="w-6 h-6" /> : <MdErrorOutline className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{modalMessage.title}</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{modalMessage.message}</p>
            <button
              onClick={() => {
                const cb = modalMessage.onDismiss;
                setModalMessage(null);
                if (cb) cb();
              }}
              className="w-full py-3 px-4 bg-card hover:bg-black/5 dark:hover:bg-white/20 border border-border text-foreground rounded-xl font-semibold transition-colors shadow-2xs"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}