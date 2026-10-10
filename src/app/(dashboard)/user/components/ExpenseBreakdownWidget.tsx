"use client";
import { Loader } from "@/components/ui/Loader";


import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { getExpenseBreakdownByMode } from "../actions/actions";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";

const MODES = ["This Month", "Last Month", "This Year", "Last Year", "Lifetime"];

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0));
  return `${num} LKR`;
};

export default function ExpenseBreakdownWidget({ initialData }: { initialData?: any[] }) {
  const [mode, setMode] = useState<string>("This Year");
  const [data, setData] = useState<any[]>(initialData || []);
  const [loading, setLoading] = useState(false);
  const [initialRender, setInitialRender] = useState(true);

  useEffect(() => {
    if (initialRender) {
      setInitialRender(false);
      if (initialData && initialData.length > 0 && mode === "This Year") {
        setData(initialData);
        return;
      }
    }

    let active = true;
    setLoading(true);
    getExpenseBreakdownByMode(mode).then((res) => {
      if (active) {
        setData(res || []);
        setLoading(false);
      }
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [mode, initialData, initialRender]);

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground">Expense Breakdown</h2>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-card border border-border px-2 py-1.5 rounded-xl shadow-2xs">
          <button onClick={handlePrev} disabled={mode === MODES[0]} className="hover:text-foreground transition-colors p-1 disabled:opacity-30">
            <MdKeyboardArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-foreground font-semibold text-sm w-[90px] text-center">{mode}</span>
          <button onClick={handleNext} disabled={mode === MODES[MODES.length - 1]} className="hover:text-foreground transition-colors p-1 disabled:opacity-30">
            <MdKeyboardArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-[200px] flex-1">
          <Loader />
        </div>
      ) : data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8 flex-1">No expenses recorded for this range.</p>
      ) : (
        <div className="flex flex-col xl:flex-row items-center justify-center gap-4 flex-1 mt-2">
          <div className="relative h-[220px] w-[220px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  key={mode + data.length} // Force re-render for animation on data/mode change
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
                    const categoryColors: Record<string, string> = {
                      "Stock Purchase": "#00A341",
                      "Marketing": "#00C750",
                      "Equipment": "#00E35B",
                      "Software": "#26F29C",
                      "Freelancers": "#4DF6AE",
                      "Transport": "#99FACF",
                      "Other": "#BFFCDF",
                    };
                    const defaultColors = ["#00E35B", "#00C750", "#26F29C", "#00A341", "#4DF6AE", "#99FACF"];
                    const color = categoryColors[entry.name] || defaultColors[index % defaultColors.length];
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--popover-bg, #0b2f38)', borderColor: 'var(--border-color, #e2e8f0)', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                  itemStyle={{ color: 'var(--text-primary, #000)', fontSize: '12px' }}
                  formatter={(value: any) => formatLKR(value)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-bold text-foreground">
                {formatLKR(total)}
              </span>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin shrink-0 min-w-[200px]">
            {data.map((entry: any, index: number) => {
              const categoryColors: Record<string, string> = {
                "Stock Purchase": "#00A341",
                "Marketing": "#00C750",
                "Equipment": "#00E35B",
                "Software": "#26F29C",
                "Freelancers": "#4DF6AE",
                "Transport": "#99FACF",
                "Other": "#BFFCDF",
              };
              const defaultColors = ["#00E35B", "#00C750", "#26F29C", "#00A341", "#4DF6AE", "#99FACF"];
              const color = categoryColors[entry.name] || defaultColors[index % defaultColors.length];
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
