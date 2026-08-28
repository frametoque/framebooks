"use client";

import { useEffect, useState } from "react";
import { Receipt, Folder, CheckSquare, Droplets } from "lucide-react";
import { MdAccountBalance, MdAccountBalanceWallet, MdTrendingUp, MdErrorOutline, MdCallMade, MdCallReceived, MdInsertDriveFile, MdGroup, MdRemoveRedEye, MdCalendarToday, MdLocationOn, MdKeyboardArrowLeft, MdKeyboardArrowRight, MdCheck } from "react-icons/md";
import { motion, Variants } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { getDashboardData } from "../actions/actions";
import ExpenseBreakdownWidget from "../components/ExpenseBreakdownWidget";
import TopClientsWidget from "../components/TopClientsWidget";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAdminDateRange } from "../context/AdminDateRangeContext";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [bookingForecasts, setBookingForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { startDate, endDate } = useAdminDateRange();
  const [chartYear, setChartYear] = useState<number>(new Date().getFullYear());
  const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);
  const [isProcessingInvite, setIsProcessingInvite] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState<{title: string, message: string, type: 'success' | 'error', onDismiss?: () => void} | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [res, analyticsRes, eventsRes, weatherRes, invitationsRes] = await Promise.all([
          getDashboardData(startDate, endDate),
          Promise.resolve(null),
          Promise.resolve([]),
          fetch("/api/admin/weather").then(r => r.ok ? r.json() : null).catch(() => null),
          fetch("/api/team/invitations/pending").then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        if (cancelled) return;
        setData(res);
        setAnalytics(analyticsRes);
        if (weatherRes && weatherRes.bookingForecasts) {
          setBookingForecasts(weatherRes.bookingForecasts);
        }
        if (invitationsRes && invitationsRes.pending) {
          setPendingInvitations(invitationsRes.pending);
        }

        const now = new Date();
        const upcoming = eventsRes
          .filter((e: any) => {
            if (e.type !== 'booking' || e.status === 'cancelled') return false;
            // Parse event start date and time
            const eventDateTime = new Date(`${e.date}T${e.time || '00:00'}:00`);
            // If start_time was provided, filter out events whose start time has passed.
            // If no start_time, keep the event until the end of that day (23:59:59).
            if (e.time) {
              return eventDateTime >= now;
            }
            const endOfDay = new Date(`${e.date}T23:59:59`);
            return endOfDay >= now;
          })
          .sort((a: any, b: any) => {
            const dateA = `${a.date}T${a.time || '00:00'}:00`;
            const dateB = `${b.date}T${b.time || '00:00'}:00`;
            return dateA.localeCompare(dateB);
          })
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        {/* Skeleton Stats Cards (Row 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse">
              <div className="p-4 rounded-2xl bg-card w-14 h-14" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Stats Cards (Row 2) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-32" />
                <div className="h-8 bg-white/10 rounded-full w-40" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Analytics Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 animate-pulse">
              <div className="p-4 rounded-2xl bg-card w-14 h-14" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Skeleton Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Skeleton Chart */}
          <div className="lg:col-span-2 bg-transparent border border-border rounded-3xl p-6 animate-pulse space-y-6">
            <div className="h-6 bg-white/10 rounded-full w-40" />
            <div className="h-[280px] bg-card rounded-2xl" />
          </div>
          <div className="bg-transparent border border-border rounded-3xl p-6 animate-pulse space-y-6">
            <div className="h-6 bg-white/10 rounded-full w-40" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-card rounded-2xl border border-border" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Available Funds", value: formatLKR(data.totalAssets || 0), subtext: (data.totalAfterDebts !== undefined && data.totalAfterDebts > data.totalAssets) ? `After Debts: ${formatLKR(data.totalAfterDebts)}` : (data.totalCapital > 0 ? `Total Capital: ${formatLKR(data.totalCapital)}` : undefined), icon: MdAccountBalance, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Total Income", value: formatLKR(data.totalIncome), icon: MdAccountBalanceWallet, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Expenses", value: formatLKR(data.totalExpenses), icon: Receipt, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Net Profit", value: formatLKR(data.netProfit), icon: MdTrendingUp, color: "text-brand-400", bg: "bg-brand-400/10" },
  ];

  const analyticsStats = analytics
    ? [
        { label: "Visitors (All Time)", value: (analytics.totalVisitors ?? 0).toLocaleString(), icon: MdGroup, color: "text-indigo-400", bg: "bg-indigo-400/10" },
        { label: "Pageviews (All Time)", value: (analytics.totalPageviews ?? 0).toLocaleString(), icon: MdRemoveRedEye, color: "text-brand-400", bg: "bg-brand-400/10" },
      ]
    : [];

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
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stats.map((stat, i) => (
          <motion.div variants={itemVariants} key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-3xl font-bold">
                <AnimatedNumber value={stat.value} />
              </p>
              {stat.subtext && <p className="text-xs text-gray-500 mt-1">{stat.subtext}</p>}
            </div>
          </motion.div>
        ))}
        <motion.div variants={itemVariants} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-amber-400">
              <AnimatedNumber value={data.unpaidCount || 0} />
            </span>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Unpaid Invoices</p>
            <p className="text-3xl font-bold text-amber-400">
              <AnimatedNumber value={formatLKR(data.unpaidAmount || 0)} />
            </p>
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
          let pctColor = "text-gray-400";
          if (pct > 0) pctColor = stat.invertColors ? "text-red-400" : "text-green-400";
          else if (pct < 0) pctColor = stat.invertColors ? "text-green-400" : "text-red-400";

          return (
            <motion.div variants={itemVariants} key={i} className="bg-transparent border border-border rounded-3xl p-7 hover:bg-card transition-colors flex flex-col justify-between">
              <p className="text-gray-400 text-sm mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold">
                  <AnimatedNumber value={stat.isCurrency ? formatLKR(stat.value) : stat.value} />
                </p>
                <div className={`flex items-center gap-1 text-sm font-medium ${pctColor}`}>
                  {isPositive ? <MdCallMade className="w-4 h-4" /> : <MdCallReceived className="w-4 h-4" />}
                  <span><AnimatedNumber value={displayPct + "%"} /></span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {analyticsStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analyticsStats.map((stat, i) => (
            <motion.div variants={itemVariants} key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
              <div className={`p-4 rounded-2xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
                <p className="text-2xl font-semibold">
                  <AnimatedNumber value={stat.value} />
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-transparent border border-border rounded-3xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Income vs Expenses</h2>
            <div className="flex items-center gap-4 text-gray-400 bg-transparent border border-border px-3 py-1.5 rounded-xl">
              <button onClick={() => setChartYear(y => y - 1)} className="hover:text-foreground transition-colors p-1"><MdKeyboardArrowLeft className="w-4 h-4" /></button>
              <span className="text-foreground font-medium text-sm">{chartYear}</span>
              <button onClick={() => setChartYear(y => y + 1)} className="hover:text-foreground transition-colors p-1"><MdKeyboardArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData.filter((d: any) => d.year === chartYear)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value/1000}k`} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => formatLKR(value)}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}/>
                <Bar dataKey="income" name="Income" fill="#00E35B" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div variants={itemVariants}>
          <ExpenseBreakdownWidget initialData={data.expenseBreakdown} />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <motion.div variants={itemVariants} className="bg-transparent border border-border rounded-3xl p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Recent Invoices</h2>
            </div>
            <div className="space-y-4">
              {data.recentInvoices.map((invoice: any, i: number) => {
                let statusColor = "text-gray-400 bg-gray-400/10 border-gray-400/20";
                const statusStr = invoice.status?.toLowerCase() || '';
                if (statusStr === 'paid' || statusStr === 'fully paid') statusColor = "text-green-400 bg-green-400/10 border-green-400/20";
                else if (statusStr === 'unpaid' || statusStr === 'pending') statusColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
                else if (statusStr === 'overdue') statusColor = "text-red-400 bg-red-400/10 border-red-400/20";
                else if (statusStr.includes('advance')) statusColor = "text-blue-400 bg-blue-400/10 border-blue-400/20";
                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-transparent border border-border rounded-2xl hover:bg-card transition-colors">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-sm">{invoice.service || 'Service'}</p>
                        <p className="text-xs text-gray-400">{invoice.client || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatLKR(invoice.amount)}</p>
                      <span className={`inline-block mt-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                );
              })}
              {data.recentInvoices.length === 0 && <p className="text-gray-500 text-sm">No recent invoices.</p>}
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-transparent border border-border rounded-3xl p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Recent Quotations</h2>
            </div>
            <div className="space-y-4">
              {data.recentQuotations && data.recentQuotations.map((quotation: any, i: number) => {
                let statusColor = "text-gray-400 bg-gray-400/10 border-gray-400/20";
                const statusStr = quotation.status?.toLowerCase() || '';
                if (statusStr === 'accepted' || statusStr === 'approved') {
                  statusColor = "text-green-400 bg-green-400/10 border-green-400/20";
                } else if (statusStr === 'pending' || statusStr === 'sent') {
                  statusColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
                } else if (statusStr === 'rejected' || statusStr === 'declined') {
                  statusColor = "text-red-400 bg-red-400/10 border-red-400/20";
                } else if (statusStr === 'expired') {
                  statusColor = "text-gray-400 bg-gray-400/10 border-gray-400/20";
                }

                return (
                  <div key={i} className="flex items-center justify-between p-4 bg-transparent border border-border rounded-2xl hover:bg-card transition-colors">
                  <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-sm">
                          {quotation.project && quotation.project.length > 26 
                            ? quotation.project.substring(0, 26) + '...' 
                            : quotation.project || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-400">{quotation.client || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatLKR(quotation.amount)}</p>
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

        {/* Net Income comparison table */}
        <motion.div variants={itemVariants} className="bg-transparent border border-border rounded-3xl p-7 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-6">Net Income</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Fiscal Year</th>
                    <th className="py-3 px-4 text-right">Previous (2025)</th>
                    <th className="py-3 px-4 text-right">Current (2026)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  <tr className="hover:bg-card transition-colors">
                    <td className="py-4 px-4 text-gray-300 font-medium">Income</td>
                    <td className="py-4 px-4 text-right font-semibold text-green-400">
                      {formatLKR(data.netIncomeComparison.previousIncome)}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-green-400">
                      {formatLKR(data.netIncomeComparison.currentIncome)}
                    </td>
                  </tr>
                  <tr className="hover:bg-card transition-colors">
                    <td className="py-4 px-4 text-gray-300 font-medium">Expense</td>
                    <td className="py-4 px-4 text-right font-semibold text-red-400">
                      {formatLKR(data.netIncomeComparison.previousExpense)}
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-red-400">
                      {formatLKR(data.netIncomeComparison.currentExpense)}
                    </td>
                  </tr>
                  <tr className="hover:bg-card transition-colors font-semibold">
                    <td className="py-4 px-4 text-foreground font-bold">Net Income</td>
                    <td className={`py-4 px-4 text-right font-bold ${data.netIncomeComparison.previousNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {data.netIncomeComparison.previousNet < 0 ? "-" : ""}{formatLKR(Math.abs(data.netIncomeComparison.previousNet))}
                    </td>
                    <td className={`py-4 px-4 text-right font-bold ${data.netIncomeComparison.currentNet >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {data.netIncomeComparison.currentNet < 0 ? "-" : ""}{formatLKR(Math.abs(data.netIncomeComparison.currentNet))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Grid: Recent Transactions & Expense Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Recent Transactions */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-transparent border border-border rounded-3xl p-6">
          <h2 className="text-xl font-semibold mb-6">Recent Transactions</h2>
          <div className="space-y-3">
            {data.recentTransactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-transparent border border-border rounded-2xl hover:bg-card transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-foreground flex shrink-0">
                    {tx.type === 'income' ? (
                      <MdCallMade className="w-5 h-5 text-brand-500" />
                    ) : (
                      <MdCallReceived className="w-5 h-5 text-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{tx.name}</p>
                    <p className="text-sm text-gray-400">{tx.date}</p>
                  </div>
                </div>
                <p className={`font-semibold ${tx.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatLKR(tx.amount)}
                </p>
              </div>
            ))}
            {data.recentTransactions.length === 0 && <p className="text-gray-500 text-sm">No recent transactions.</p>}
          </div>
        </motion.div>

        {/* Top Clients Widget */}
        <TopClientsWidget />
      </div>

      {/* Modal Overlay */}
      {modalMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111] border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl"
          >
            <div className={`w-12 h-12 rounded-2xl mb-4 flex items-center justify-center ${modalMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {modalMessage.type === 'success' ? <MdCheck className="w-6 h-6" /> : <MdErrorOutline className="w-6 h-6" />}
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">{modalMessage.title}</h3>
            <p className="text-gray-400 text-sm mb-6">{modalMessage.message}</p>
            <button
              onClick={() => {
                const cb = modalMessage.onDismiss;
                setModalMessage(null);
                if (cb) cb();
              }}
              className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-foreground rounded-xl font-semibold transition-colors"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}