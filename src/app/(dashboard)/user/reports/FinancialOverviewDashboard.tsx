"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatLKR } from "@/components/Formatters";
import { useAccentTheme } from "@/lib/theme/useAccentTheme";

interface FinancialOverviewDashboardProps {
  data: {
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: string | number;
    incomeByService: Array<{ name: string; value: number }>;
    expensesBreakdown: Array<{ name: string; value: number }>;
    journalEntries: Array<{
      id: string;
      rawId: number;
      type: "income" | "expense";
      description: string;
      date: string;
      amount: number;
      category: string;
      paymentMethod: string;
      invoiceId: number | null;
    }>;
  };
  clients: Array<{
    id: number;
    name: string;
    revenue: number | string;
    [key: string]: any;
  }>;
  accounts: Array<{
    id: number;
    name: string;
    type: string;
    currentBalance?: number;
    balance?: number;
    [key: string]: any;
  }>;
}

// Strict Monochromatic Red Palette for Expenses
const EXPENSES_RED_PALETTE = [
  "#ef4444",
  "#991b1b",
  "#f87171",
  "#b91c1c",
  "#fca5a5",
  "#7f1d1d",
  "#dc2626",
  "#e11d48",
];

export default function FinancialOverviewDashboard({
  data,
  clients,
  accounts,
}: FinancialOverviewDashboardProps) {
  const { accent, chartPalette } = useAccentTheme();

  // Monochromatic palette for income based on user selected color theme
  const incomePalette = useMemo(() => {
    return chartPalette && chartPalette.length > 0
      ? chartPalette
      : ["#22c55e", "#15803d", "#4ade80", "#047857", "#86efac", "#166534", "#10b981", "#a7f3d0"];
  }, [chartPalette]);

  // --- 1. Top Stats Calculations ---
  const totalIncome = Number(data?.totalIncome || 0);
  const totalExpenses = Number(data?.totalExpenses || 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin =
    totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0.0";
  const spendingRatio =
    totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : "0.0";

  const incomeTransactions = useMemo(() => {
    return (data?.journalEntries || []).filter((e) => e.type === "income");
  }, [data?.journalEntries]);

  const incomeTxCount = incomeTransactions.length;
  const averageSale = incomeTxCount > 0 ? totalIncome / incomeTxCount : 0;

  // --- 2. Hero Chart State & Processing ---
  type HeroViewMode = "money_in_out" | "profit_margin" | "total_savings";
  type Granularity = "auto" | "month" | "week" | "day";

  const [heroViewMode, setHeroViewMode] = useState<HeroViewMode>("money_in_out");
  const [granularity, setGranularity] = useState<Granularity>("auto");

  // Determine active granularity if auto
  const resolvedGranularity = useMemo(() => {
    if (granularity !== "auto") return granularity;
    const entries = data?.journalEntries || [];
    if (entries.length === 0) return "month";
    const dates = entries
      .map((e) => new Date(e.date).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length === 0) return "month";
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const spanDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);
    if (spanDays > 120) return "month";
    if (spanDays > 28) return "week";
    return "day";
  }, [granularity, data?.journalEntries]);

  // Group journal entries for hero chart
  const heroChartData = useMemo(() => {
    const entries = [...(data?.journalEntries || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const bucketMap = new Map<
      string,
      { label: string; timestamp: number; income: number; expenses: number }
    >();

    for (const e of entries) {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) continue;

      let key = "";
      let label = "";

      if (resolvedGranularity === "month") {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        key = `${year}-${month}`;
        label = d.toLocaleDateString("en-US", { month: "short" }) + " " + String(year).slice(2);
      } else if (resolvedGranularity === "week") {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = monday.toISOString().slice(0, 10);
        label = monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } else {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          label,
          timestamp: d.getTime(),
          income: 0,
          expenses: 0,
        });
      }

      const bucket = bucketMap.get(key)!;
      if (e.type === "income") {
        bucket.income += Number(e.amount || 0);
      } else {
        bucket.expenses += Number(e.amount || 0);
      }
    }

    if (bucketMap.size === 0) {
      const fallbackMonths = ["Aug 26", "Sep 26", "Oct 26", "Nov 26"];
      let run = 0;
      return fallbackMonths.map((m) => {
        const inc = totalIncome / 4;
        const exp = totalExpenses / 4;
        const profit = inc - exp;
        run += profit;
        return {
          name: m,
          income: inc,
          expenses: exp,
          netProfit: profit,
          margin: inc > 0 ? (profit / inc) * 100 : 0,
          cumulativeSavings: run,
        };
      });
    }

    let runningSavings = 0;
    return Array.from(bucketMap.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .map(([_, val]) => {
        const inc = Math.round(val.income);
        const exp = Math.round(val.expenses);
        const profit = inc - exp;
        runningSavings += profit;
        return {
          name: val.label,
          income: inc,
          expenses: exp,
          netProfit: profit,
          margin: inc > 0 ? Number(((profit / inc) * 100).toFixed(1)) : 0,
          cumulativeSavings: runningSavings,
        };
      });
  }, [data?.journalEntries, resolvedGranularity, totalIncome, totalExpenses]);

  // Highlight Insights Footer calculations
  const heroInsights = useMemo(() => {
    if (heroChartData.length === 0) {
      return {
        bestIncome: { name: "N/A", value: 0 },
        highestSpending: { name: "N/A", value: 0 },
        mostProfitable: { name: "N/A", value: 0 },
        avgMargin: "0.0%",
      };
    }

    let bestIncome = heroChartData[0];
    let highestSpending = heroChartData[0];
    let mostProfitable = heroChartData[0];
    let marginSum = 0;
    let marginCount = 0;

    for (const d of heroChartData) {
      if (d.income > bestIncome.income) bestIncome = d;
      if (d.expenses > highestSpending.expenses) highestSpending = d;
      if (d.netProfit > mostProfitable.netProfit) mostProfitable = d;
      if (d.income > 0) {
        marginSum += d.margin;
        marginCount++;
      }
    }

    const avgMargin =
      marginCount > 0 ? (marginSum / marginCount).toFixed(1) + "%" : `${profitMargin}%`;

    return {
      bestIncome: { name: bestIncome.name, value: bestIncome.income },
      highestSpending: { name: highestSpending.name, value: highestSpending.expenses },
      mostProfitable: { name: mostProfitable.name, value: mostProfitable.netProfit },
      avgMargin,
    };
  }, [heroChartData, profitMargin]);

  // --- 3. Breakdown Donut Charts Dimensions & States ---
  const [incomeDimension, setIncomeDimension] = useState<"service" | "method">("service");
  const [expenseDimension, setExpenseDimension] = useState<"category" | "method">("category");

  const [hoveredIncomeSlice, setHoveredIncomeSlice] = useState<number | null>(null);
  const [hoveredExpenseSlice, setHoveredExpenseSlice] = useState<number | null>(null);

  // Income dataset based on dimension
  const incomeBreakdownData = useMemo(() => {
    if (incomeDimension === "service") {
      return (data?.incomeByService || []).map((item) => ({
        name: item.name || "Other",
        value: Number(item.value || 0),
      }));
    } else {
      const map = new Map<string, number>();
      for (const e of incomeTransactions) {
        const method = (e.paymentMethod || "Other").trim();
        map.set(method, (map.get(method) || 0) + Number(e.amount || 0));
      }
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }
  }, [incomeDimension, data?.incomeByService, incomeTransactions]);

  const totalIncomeBreakdown = useMemo(() => {
    return incomeBreakdownData.reduce((s, i) => s + i.value, 0) || totalIncome || 1;
  }, [incomeBreakdownData, totalIncome]);

  // Expenses dataset based on dimension
  const expenseTransactions = useMemo(() => {
    return (data?.journalEntries || []).filter((e) => e.type === "expense");
  }, [data?.journalEntries]);

  const expenseBreakdownData = useMemo(() => {
    if (expenseDimension === "category") {
      return (data?.expensesBreakdown || []).map((item) => ({
        name: item.name || "Other",
        value: Number(item.value || 0),
      }));
    } else {
      const map = new Map<string, number>();
      for (const e of expenseTransactions) {
        const method = (e.paymentMethod || "Other").trim();
        map.set(method, (map.get(method) || 0) + Number(e.amount || 0));
      }
      return Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }
  }, [expenseDimension, data?.expensesBreakdown, expenseTransactions]);

  const totalExpenseBreakdown = useMemo(() => {
    return expenseBreakdownData.reduce((s, i) => s + i.value, 0) || totalExpenses || 1;
  }, [expenseBreakdownData, totalExpenses]);

  // --- 4. Top Clients & Sales Share Calculations ---
  const rankedClients = useMemo(() => {
    return [...(clients || [])]
      .map((c) => ({
        id: c.id,
        name: c.name || "Unnamed Client",
        revenue: Number(c.revenue || 0),
      }))
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [clients]);

  const top5ClientsRevenue = useMemo(() => {
    return rankedClients.reduce((s, c) => s + c.revenue, 0);
  }, [rankedClients]);

  const top5Share =
    totalIncome > 0
      ? ((top5ClientsRevenue / totalIncome) * 100).toFixed(1)
      : "0.0";

  const allClientsWithRevenue = useMemo(() => {
    return (clients || []).filter((c) => Number(c.revenue || 0) > 0);
  }, [clients]);

  const avgSalePerClient =
    allClientsWithRevenue.length > 0
      ? totalIncome / allClientsWithRevenue.length
      : 0;

  // --- 5. Future Predictions Calculations ---
  const predictionsData = useMemo(() => {
    const monthlyActualsMap = new Map<string, { income: number; expenses: number }>();
    const entries = data?.journalEntries || [];

    for (const e of entries) {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyActualsMap.has(key)) {
        monthlyActualsMap.set(key, { income: 0, expenses: 0 });
      }
      const b = monthlyActualsMap.get(key)!;
      if (e.type === "income") b.income += Number(e.amount || 0);
      else b.expenses += Number(e.amount || 0);
    }

    const sortedMonthKeys = Array.from(monthlyActualsMap.keys()).sort();
    const recentMonths = sortedMonthKeys
      .slice(-3)
      .map((k) => monthlyActualsMap.get(k)!);

    const baseIncome =
      recentMonths.length > 0
        ? recentMonths.reduce((s, m) => s + m.income, 0) / recentMonths.length
        : totalIncome > 0
        ? totalIncome / 3
        : 120000;

    const baseExpense =
      recentMonths.length > 0
        ? recentMonths.reduce((s, m) => s + m.expenses, 0) / recentMonths.length
        : totalExpenses > 0
        ? totalExpenses / 3
        : 60000;

    const currIncome =
      recentMonths.length > 0
        ? recentMonths[recentMonths.length - 1].income
        : baseIncome;
    const prevIncome =
      recentMonths.length > 1
        ? recentMonths[recentMonths.length - 2].income
        : currIncome;

    const growthRate =
      prevIncome > 0
        ? Math.max(-0.25, Math.min(0.25, (currIncome - prevIncome) / prevIncome))
        : 0.05;

    const projectedNextIncome = Math.round(baseIncome * (1 + growthRate * 0.5));
    const projectedNextExpense = Math.round(baseExpense);
    const projectedNextProfit = projectedNextIncome - projectedNextExpense;

    const incomeMultipliers = [1.0, 1.05, 1.11, 1.08, 1.15, 1.21];
    const expenseMultipliers = [1.0, 1.03, 0.98, 1.05, 1.02, 1.06];

    const now = new Date();
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const targetMonthBadge = nextMonthDate.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });

    const chartPoints = [];
    for (let i = 0; i < 6; i++) {
      const futDate = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
      const label =
        futDate.toLocaleDateString("en-US", { month: "short" }) +
        " " +
        futDate.getFullYear().toString().slice(2);
      const inc = Math.round(projectedNextIncome * incomeMultipliers[i]);
      const exp = Math.round(projectedNextExpense * expenseMultipliers[i]);
      chartPoints.push({
        name: label,
        income: inc,
        expenses: exp,
        expectedProfit: inc - exp,
      });
    }

    const totalLiquidCash = (accounts || []).reduce(
      (s, a) => s + Math.max(0, Number(a.currentBalance ?? a.balance ?? 0)),
      0
    );
    const moneyWillLastMonths =
      baseExpense > 0 ? (totalLiquidCash / baseExpense).toFixed(1) : "Stable";

    const annualRunRate = projectedNextIncome * 12;

    return {
      targetMonthBadge,
      projectedNextIncome,
      projectedNextExpense,
      projectedNextProfit,
      chartPoints,
      moneyWillLastMonths,
      annualRunRate,
    };
  }, [data?.journalEntries, totalIncome, totalExpenses, accounts]);

  return (
    <div className="space-y-6">
      {/* =========================================================================
          2. Top Stats Bar (Unified 6-Card Grid)
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Total Income */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Total Income</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
            {formatLKR(totalIncome)}
          </p>
        </div>

        {/* 2. Total Expenses */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Total Expenses</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
            {formatLKR(totalExpenses)}
          </p>
        </div>

        {/* 3. Net Profit */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Net Profit</p>
          <p
            className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums"
            style={{ color: netProfit >= 0 ? accent : "#f43f5e" }}
          >
            {netProfit < 0 ? "-" : ""}
            {formatLKR(Math.abs(netProfit))}
          </p>
        </div>

        {/* 4. Profit Margin */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Profit Margin</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
            {profitMargin}%
          </p>
        </div>

        {/* 5. Spending Ratio */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Spending Ratio</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
            {spendingRatio}%
          </p>
        </div>

        {/* 6. Average Sale */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-5 hover:border-white/20 transition-all shadow-lg">
          <p className="text-xs font-medium text-gray-400 mb-1">Average Sale</p>
          <p className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
            {formatLKR(averageSale)}
          </p>
        </div>
      </div>

      {/* =========================================================================
          3. Hero Chart: "Money Over Time"
          ========================================================================= */}
      <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-white tracking-tight">Money Over Time</h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-2xl">
              <button
                onClick={() => setHeroViewMode("money_in_out")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  heroViewMode === "money_in_out"
                    ? "bg-white/20 text-white font-semibold shadow-xs"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Money In vs Out
              </button>
              <button
                onClick={() => setHeroViewMode("profit_margin")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  heroViewMode === "profit_margin"
                    ? "bg-white/20 text-white font-semibold shadow-xs"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Profit &amp; Margin
              </button>
              <button
                onClick={() => setHeroViewMode("total_savings")}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  heroViewMode === "total_savings"
                    ? "bg-white/20 text-white font-semibold shadow-xs"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Total Savings
              </button>
            </div>

            {/* Granularity Switcher */}
            <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-2xl">
              {(["auto", "month", "week", "day"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs capitalize transition-all ${
                    granularity === g
                      ? "bg-white/20 text-white font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Chart Body */}
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {heroViewMode === "money_in_out" ? (
              <AreaChart
                data={heroChartData}
                margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="heroIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="heroExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.07)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <Tooltip content={<MoneyInOutTooltip accent={accent} />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingBottom: "12px" }}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke={accent}
                  strokeWidth={2}
                  fill="url(#heroIncomeGrad)"
                  fillOpacity={1}
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#heroExpenseGrad)"
                  fillOpacity={1}
                />
              </AreaChart>
            ) : heroViewMode === "profit_margin" ? (
              <ComposedChart
                data={heroChartData}
                margin={{ top: 10, right: 20, left: 15, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.07)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#38bdf8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<ProfitMarginTooltip accent={accent} />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingBottom: "12px" }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="netProfit"
                  name="Net Profit"
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                >
                  {heroChartData.map((entry, index) => (
                    <Cell
                      key={`bar-${index}`}
                      fill={entry.netProfit >= 0 ? accent : "#f43f5e"}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="margin"
                  name="Margin %"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#38bdf8" }}
                />
              </ComposedChart>
            ) : (
              <AreaChart
                data={heroChartData}
                margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="heroSavingsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.07)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#9ca3af"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => {
                    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(0)}k`;
                    return `${val}`;
                  }}
                />
                <Tooltip content={<TotalSavingsTooltip accent={accent} />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "12px", paddingBottom: "12px" }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeSavings"
                  name="Total Savings"
                  stroke={accent}
                  strokeWidth={2}
                  fill="url(#heroSavingsGrad)"
                  fillOpacity={1}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Highlight Insights Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-white/10">
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-medium text-gray-400 mb-1">Best Income Period</p>
            <p className="text-base font-bold text-white tracking-tight">
              {heroInsights.bestIncome.name}
            </p>
            <p
              className="text-xs font-semibold mt-0.5 tabular-nums"
              style={{ color: accent }}
            >
              {formatLKR(heroInsights.bestIncome.value)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-medium text-gray-400 mb-1">Highest Spending Period</p>
            <p className="text-base font-bold text-white tracking-tight">
              {heroInsights.highestSpending.name}
            </p>
            <p className="text-xs font-semibold text-[#f43f5e] mt-0.5 tabular-nums">
              {formatLKR(heroInsights.highestSpending.value)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-medium text-gray-400 mb-1">Most Profitable Period</p>
            <p className="text-base font-bold text-white tracking-tight">
              {heroInsights.mostProfitable.name}
            </p>
            <p
              className="text-xs font-semibold mt-0.5 tabular-nums"
              style={{
                color: heroInsights.mostProfitable.value >= 0 ? accent : "#f43f5e",
              }}
            >
              {heroInsights.mostProfitable.value < 0 ? "-" : "+"}
              {formatLKR(Math.abs(heroInsights.mostProfitable.value))}
            </p>
          </div>

          <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
            <p className="text-xs font-medium text-gray-400 mb-1">Average Profit Margin</p>
            <p className="text-base font-bold text-white tracking-tight">
              {heroInsights.avgMargin}
            </p>
            <p className="text-xs font-medium text-gray-400 mt-0.5">Across active periods</p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. Income & Expenses Breakdown (Monochromatic Donut Charts)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Income Breakdown Card */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white tracking-tight">Income</h3>
              <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-2xl">
                <button
                  onClick={() => setIncomeDimension("service")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    incomeDimension === "service"
                      ? "bg-white/20 text-white font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  By Service
                </button>
                <button
                  onClick={() => setIncomeDimension("method")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    incomeDimension === "method"
                      ? "bg-white/20 text-white font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  By Payment Method
                </button>
              </div>
            </div>

            {/* Side-by-Side Donut Chart & Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mt-2">
              {/* Donut Chart with Centered Text */}
              <div className="relative flex items-center justify-center">
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomeBreakdownData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={84}
                        paddingAngle={2}
                        onMouseEnter={(_, index) => setHoveredIncomeSlice(index)}
                        onMouseLeave={() => setHoveredIncomeSlice(null)}
                      >
                        {incomeBreakdownData.map((_, index) => (
                          <Cell
                            key={`income-slice-${index}`}
                            fill={incomePalette[index % incomePalette.length]}
                            opacity={
                              hoveredIncomeSlice === null || hoveredIncomeSlice === index
                                ? 1
                                : 0.35
                            }
                            stroke={hoveredIncomeSlice === index ? "#ffffff" : "none"}
                            strokeWidth={hoveredIncomeSlice === index ? 2 : 0}
                            className="transition-all duration-200 cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Center Text Overlay */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  {hoveredIncomeSlice !== null && incomeBreakdownData[hoveredIncomeSlice] ? (
                    <>
                      <span className="text-[11px] font-medium text-gray-400 truncate max-w-[110px]">
                        {incomeBreakdownData[hoveredIncomeSlice].name}
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 tabular-nums">
                        {formatLKR(incomeBreakdownData[hoveredIncomeSlice].value, true)}
                      </span>
                      <span
                        className="text-[10px] font-semibold"
                        style={{ color: accent }}
                      >
                        {(
                          (incomeBreakdownData[hoveredIncomeSlice].value /
                            totalIncomeBreakdown) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-gray-400">Total Income</span>
                      <span className="text-base font-bold text-white mt-0.5 tabular-nums">
                        {formatLKR(totalIncome, true)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend List */}
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {incomeBreakdownData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No income recorded for this period
                  </p>
                ) : (
                  incomeBreakdownData.map((item, index) => {
                    const color = incomePalette[index % incomePalette.length];
                    const pct = ((item.value / totalIncomeBreakdown) * 100).toFixed(1);
                    const isHovered = hoveredIncomeSlice === index;
                    return (
                      <div
                        key={`inc-leg-${index}`}
                        onMouseEnter={() => setHoveredIncomeSlice(index)}
                        onMouseLeave={() => setHoveredIncomeSlice(null)}
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                          isHovered ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-medium text-gray-200 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-white tabular-nums">
                            {formatLKR(item.value)}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400 w-11 text-right tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Expenses Breakdown Card */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white tracking-tight">Expenses</h3>
              <div className="flex items-center bg-white/5 border border-white/10 p-1 rounded-2xl">
                <button
                  onClick={() => setExpenseDimension("category")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    expenseDimension === "category"
                      ? "bg-white/20 text-white font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  By Category
                </button>
                <button
                  onClick={() => setExpenseDimension("method")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    expenseDimension === "method"
                      ? "bg-white/20 text-white font-semibold shadow-xs"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  By Payment Method
                </button>
              </div>
            </div>

            {/* Side-by-Side Donut Chart & Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center mt-2">
              {/* Donut Chart with Centered Text */}
              <div className="relative flex items-center justify-center">
                <div className="h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdownData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={84}
                        paddingAngle={2}
                        onMouseEnter={(_, index) => setHoveredExpenseSlice(index)}
                        onMouseLeave={() => setHoveredExpenseSlice(null)}
                      >
                        {expenseBreakdownData.map((_, index) => (
                          <Cell
                            key={`expense-slice-${index}`}
                            fill={
                              EXPENSES_RED_PALETTE[index % EXPENSES_RED_PALETTE.length]
                            }
                            opacity={
                              hoveredExpenseSlice === null || hoveredExpenseSlice === index
                                ? 1
                                : 0.35
                            }
                            stroke={hoveredExpenseSlice === index ? "#ffffff" : "none"}
                            strokeWidth={hoveredExpenseSlice === index ? 2 : 0}
                            className="transition-all duration-200 cursor-pointer"
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Center Text Overlay */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  {hoveredExpenseSlice !== null && expenseBreakdownData[hoveredExpenseSlice] ? (
                    <>
                      <span className="text-[11px] font-medium text-gray-400 truncate max-w-[110px]">
                        {expenseBreakdownData[hoveredExpenseSlice].name}
                      </span>
                      <span className="text-sm font-bold text-white mt-0.5 tabular-nums">
                        {formatLKR(expenseBreakdownData[hoveredExpenseSlice].value, true)}
                      </span>
                      <span className="text-[10px] font-semibold text-[#f43f5e]">
                        {(
                          (expenseBreakdownData[hoveredExpenseSlice].value /
                            totalExpenseBreakdown) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-gray-400">Total Spent</span>
                      <span className="text-base font-bold text-white mt-0.5 tabular-nums">
                        {formatLKR(totalExpenses, true)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Legend List */}
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                {expenseBreakdownData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">
                    No expenses recorded for this period
                  </p>
                ) : (
                  expenseBreakdownData.map((item, index) => {
                    const color =
                      EXPENSES_RED_PALETTE[index % EXPENSES_RED_PALETTE.length];
                    const pct = ((item.value / totalExpenseBreakdown) * 100).toFixed(1);
                    const isHovered = hoveredExpenseSlice === index;
                    return (
                      <div
                        key={`exp-leg-${index}`}
                        onMouseEnter={() => setHoveredExpenseSlice(index)}
                        onMouseLeave={() => setHoveredExpenseSlice(null)}
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer ${
                          isHovered ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-xs font-medium text-gray-200 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-white tabular-nums">
                            {formatLKR(item.value)}
                          </span>
                          <span className="text-[11px] font-medium text-gray-400 w-11 text-right tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          5. Top Clients & Sales Share  AND  6. Future Predictions
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Top Clients & Sales Share Card */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight mb-6">
              Top Clients &amp; Sales Share
            </h3>

            {/* Ranked Horizontal Bars */}
            <div className="space-y-4">
              {rankedClients.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  No client sales recorded for this period
                </p>
              ) : (
                rankedClients.map((client, idx) => {
                  const share =
                    totalIncome > 0
                      ? ((client.revenue / totalIncome) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <div key={client.id || idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-white shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-white truncate">
                            {client.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-semibold text-white tabular-nums">
                            {formatLKR(client.revenue)}
                          </span>
                          <span className="text-gray-400 font-medium tabular-nums w-12 text-right">
                            {share}%
                          </span>
                        </div>
                      </div>

                      {/* Accent Gradient Fill Bar */}
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(4, Number(share)))}%`,
                            background: `linear-gradient(to right, ${accent}, ${chartPalette[1] || accent})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Concentration Stats */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 mt-6">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">
                Top 5 Clients Share (%)
              </p>
              <p className="text-lg font-bold text-white tracking-tight tabular-nums">
                {top5Share}%
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">
                Average Sale per Client
              </p>
              <p className="text-lg font-bold text-white tracking-tight tabular-nums">
                {formatLKR(avgSalePerClient)}
              </p>
            </div>
          </div>
        </div>

        {/* Future Predictions Card (Forecasting) */}
        <div className="bg-[#0a0a0f] border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Future Predictions
              </h3>
            </div>

            {/* 3 Target Next-Month Metric Boxes */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="text-[11px] font-medium text-gray-400 truncate">Expected Income</p>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/10 text-gray-300 shrink-0">
                    {predictionsData.targetMonthBadge}
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm font-bold tabular-nums truncate"
                  style={{ color: accent }}
                >
                  {formatLKR(predictionsData.projectedNextIncome)}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="text-[11px] font-medium text-gray-400 truncate">Expected Expenses</p>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/10 text-gray-300 shrink-0">
                    {predictionsData.targetMonthBadge}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#f43f5e] tabular-nums truncate">
                  {formatLKR(predictionsData.projectedNextExpense)}
                </p>
              </div>

              <div className="bg-white/5 border border-white/5 rounded-2xl p-3 sm:p-3.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="text-[11px] font-medium text-gray-400 truncate">Expected Profit</p>
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/10 text-gray-300 shrink-0">
                    {predictionsData.targetMonthBadge}
                  </span>
                </div>
                <p
                  className="text-xs sm:text-sm font-bold tabular-nums truncate"
                  style={{
                    color:
                      predictionsData.projectedNextProfit >= 0 ? accent : "#f43f5e",
                  }}
                >
                  {predictionsData.projectedNextProfit < 0 ? "-" : "+"}
                  {formatLKR(Math.abs(predictionsData.projectedNextProfit))}
                </p>
              </div>
            </div>

            {/* AreaChart of Upcoming 6 Future Months purely (250px height) */}
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={predictionsData.chartPoints}
                  margin={{ top: 10, right: 10, left: 15, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="predIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accent} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="predExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.07)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
                      if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
                      return `${val}`;
                    }}
                  />
                  <Tooltip content={<PredictionTooltip accent={accent} />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ fontSize: "11px", paddingBottom: "8px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke={accent}
                    strokeWidth={2}
                    fill="url(#predIncomeGrad)"
                    fillOpacity={1}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fill="url(#predExpenseGrad)"
                    fillOpacity={1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2 Forward Indicators */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 mt-4">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">Money Will Last</p>
              <p className="text-lg font-bold text-white tracking-tight tabular-nums">
                {predictionsData.moneyWillLastMonths === "Stable"
                  ? "Stable"
                  : `${predictionsData.moneyWillLastMonths} Months`}
              </p>
            </div>

            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <p className="text-xs font-medium text-gray-400 mb-1">
                Expected Yearly Sales
              </p>
              <p className="text-lg font-bold text-white tracking-tight tabular-nums">
                {formatLKR(predictionsData.annualRunRate)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Custom Tooltips using user's accent theme ---

function MoneyInOutTooltip({ active, payload, label, accent = "#22c55e" }: any) {
  if (active && payload && payload.length) {
    const inc = payload.find((p: any) => p.dataKey === "income")?.value || 0;
    const exp = payload.find((p: any) => p.dataKey === "expenses")?.value || 0;
    const profit = inc - exp;
    return (
      <div className="bg-[#0a0a0f]/95 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-2">
        <p className="font-semibold text-gray-400">{label}</p>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
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
            style={{ color: profit >= 0 ? accent : "#f43f5e" }}
          >
            {profit >= 0 ? "+" : ""}
            {formatLKR(profit)}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

function ProfitMarginTooltip({ active, payload, label, accent = "#22c55e" }: any) {
  if (active && payload && payload.length) {
    const profitItem = payload.find((p: any) => p.dataKey === "netProfit");
    const marginItem = payload.find((p: any) => p.dataKey === "margin");
    const profit = profitItem ? Number(profitItem.value || 0) : 0;
    const margin = marginItem ? Number(marginItem.value || 0).toFixed(1) : "0.0";
    return (
      <div className="bg-[#0a0a0f]/95 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-2">
        <p className="font-semibold text-gray-400">{label}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400">Net Profit:</span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: profit >= 0 ? accent : "#f43f5e" }}
          >
            {profit >= 0 ? "+" : ""}
            {formatLKR(profit)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400">Margin:</span>
          <span className="font-semibold text-[#38bdf8] tabular-nums">{margin}%</span>
        </div>
      </div>
    );
  }
  return null;
}

function TotalSavingsTooltip({ active, payload, label, accent = "#10b981" }: any) {
  if (active && payload && payload.length) {
    const savings = payload[0]?.value || 0;
    return (
      <div className="bg-[#0a0a0f]/95 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-1">
        <p className="font-semibold text-gray-400">{label}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-gray-400">Total Savings:</span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: savings >= 0 ? accent : "#f43f5e" }}
          >
            {savings >= 0 ? "+" : ""}
            {formatLKR(savings)}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

function PredictionTooltip({ active, payload, label, accent = "#22c55e" }: any) {
  if (active && payload && payload.length) {
    const inc = payload.find((p: any) => p.dataKey === "income")?.value || 0;
    const exp = payload.find((p: any) => p.dataKey === "expenses")?.value || 0;
    const profit = inc - exp;
    return (
      <div className="bg-[#0a0a0f]/95 border border-white/10 rounded-2xl p-3.5 shadow-2xl backdrop-blur-xl text-xs space-y-2">
        <p className="font-semibold text-gray-400">{label}</p>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accent }}
            />
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
          <span className="text-gray-400">Expected Profit:</span>
          <span
            className="font-semibold tabular-nums"
            style={{ color: profit >= 0 ? accent : "#f43f5e" }}
          >
            {profit >= 0 ? "+" : ""}
            {formatLKR(profit)}
          </span>
        </div>
      </div>
    );
  }
  return null;
}
