"use client";
import { Loader } from "@/components/ui/Loader";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getExpenseBreakdownByMode, getIncomeBreakdownByMode } from "../actions/actions";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import { useAccentTheme } from "@/lib/theme/useAccentTheme";

const MODES = ["This Month", "Last Month", "This Year", "Last Year", "Lifetime"];

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `${num} LKR`;
};

interface ExpenseBreakdownWidgetProps {
  initialData?: any[];
  initialExpenseData?: any[];
  initialIncomeData?: any[];
}

export default function ExpenseBreakdownWidget({
  initialData,
  initialExpenseData,
  initialIncomeData
}: ExpenseBreakdownWidgetProps) {
  const { chartPalette } = useAccentTheme();
  const [tab, setTab] = useState<'expenses' | 'income'>('expenses');
  const [mode, setMode] = useState<string>("This Year");

  const effectiveInitialExpense = initialExpenseData || initialData || [];
  const effectiveInitialIncome = initialIncomeData || [];

  const [data, setData] = useState<any[]>(effectiveInitialExpense);
  const [loading, setLoading] = useState(false);

  const getCategoryColor = (name: string, index: number) => {
    const categoryIndexMap: Record<string, number> = {
      // Expenses
      "Stock Purchase": 0,
      "Marketing": 1,
      "Marketing & Ads": 1,
      "Equipment": 2,
      "Software": 3,
      "Software Subscriptions": 3,
      "Freelancers": 4,
      "Payroll": 4,
      "Office Rent": 5,
      "Transport": 6,
      "Travel & Meals": 6,
      "Charity": 7,
      "Desk Setup": 8,
      "Internet": 9,
      "Tech": 10,
      "Study": 11,
      // Incomes
      "Consulting Services": 0,
      "Web Development": 1,
      "Web Dev": 1,
      "Monthly Retainer": 2,
      "Video Edit": 3,
      "Vid Edit": 3,
      "Graphic Design": 4,
      "GIFT": 5,
      "Spare Parts": 6,
      "Oil": 7,
      "Other": 12,
    };
    const mapped = categoryIndexMap[name];
    const idx = typeof mapped === "number" ? mapped : index;
    return chartPalette[idx % chartPalette.length];
  };

  useEffect(() => {
    if (mode === "This Year") {
      if (tab === 'expenses' && effectiveInitialExpense.length > 0) {
        setData(effectiveInitialExpense);
        return;
      }
      if (tab === 'income' && effectiveInitialIncome.length > 0) {
        setData(effectiveInitialIncome);
        return;
      }
    }

    let active = true;
    setLoading(true);
    const fetcher = tab === 'expenses' ? getExpenseBreakdownByMode(mode) : getIncomeBreakdownByMode(mode);
    fetcher
      .then((res) => {
        if (active) {
          setData(res || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [mode, tab, initialExpenseData, initialIncomeData, initialData]);

  const total = (data || []).reduce((sum, r) => sum + (r.value || 0), 0);

  const handlePrev = () => {
    const idx = MODES.indexOf(mode);
    if (idx > 0) setMode(MODES[idx - 1]);
  };

  const handleNext = () => {
    const idx = MODES.indexOf(mode);
    if (idx < MODES.length - 1) setMode(MODES[idx + 1]);
  };

  return (
    <div className="bg-card border border-border rounded-3xl p-7 flex flex-col h-full shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            {tab === "expenses" ? "Expense Breakdown" : "Income Breakdown"}
          </h2>
          <div className="flex items-center gap-1 p-0.5 bg-black/5 dark:bg-card border border-border rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setTab("expenses")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === "expenses"
                  ? "bg-card text-foreground shadow-xs font-bold border border-border"
                  : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              Expenses
            </button>
            <button
              type="button"
              onClick={() => setTab("income")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                tab === "income"
                  ? "bg-card text-foreground shadow-xs font-bold border border-border"
                  : "text-gray-500 dark:text-gray-400 hover:text-foreground"
              }`}
            >
              Income
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-card border border-border px-2 py-1.5 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={handlePrev}
            disabled={mode === MODES[0]}
            className="hover:text-foreground transition-colors p-1 disabled:opacity-30"
          >
            <MdKeyboardArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-foreground font-semibold text-sm w-[90px] text-center">{mode}</span>
          <button
            type="button"
            onClick={handleNext}
            disabled={mode === MODES[MODES.length - 1]}
            className="hover:text-foreground transition-colors p-1 disabled:opacity-30"
          >
            <MdKeyboardArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[200px] flex-1">
          <Loader />
        </div>
      ) : data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8 flex-1">
          No {tab === "expenses" ? "expenses" : "income"} recorded for this range.
        </p>
      ) : (
        <div className="flex flex-col xl:flex-row items-center justify-center gap-4 flex-1 mt-2">
          <div className="relative h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  key={`${tab}-${mode}-${data.length}`} // Force re-render for animation on tab/data/mode change
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={true}
                  animationDuration={800}
                >
                  {data.map((entry: any, index: number) => {
                    const color = getCategoryColor(entry.name, index);
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--popover-bg, #0b2f38)',
                    borderColor: 'var(--border-color, #e2e8f0)',
                    borderRadius: '16px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                  }}
                  itemStyle={{ color: 'var(--text-primary, #000)', fontSize: '12px' }}
                  formatter={(value: any) => formatLKR(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">
                Total
              </span>
              <span className="text-sm font-bold text-foreground">
                {formatLKR(total)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin shrink-0 min-w-[200px]">
            {data.map((entry: any, index: number) => {
              const color = getCategoryColor(entry.name, index);
              return (
                <div key={index} className="flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium truncate">{entry.name}</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-foreground font-semibold whitespace-nowrap">{formatLKR(entry.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
