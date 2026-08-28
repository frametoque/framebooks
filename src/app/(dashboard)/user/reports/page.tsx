"use client";

import { useEffect, useState } from "react";
import { Percent, Link as LinkIcon } from "lucide-react";
import { MdTrendingUp, MdTrendingDown, MdAttachMoney, MdDownload, MdInsertDriveFile, MdCalendarToday, MdGroup, MdMenuBook, MdSearch, MdCallMade, MdCallReceived, MdShowChart } from "react-icons/md";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getReports, getClients } from "../actions/actions";
import AnimatedNumber from "../components/AnimatedNumber";
import { useAdminDateRange } from "../context/AdminDateRangeContext";
import WheelDatePicker from "../components/WheelDatePicker";
import { PlanType } from "@/lib/plans";
import { getTenantPlan } from "../actions/plan";
import { UpgradeOverlay } from "../components/UpgradeOverlay";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

const GREEN_PALETTE = ['#00E35B', '#00C853', '#00AD45', '#009238', '#00782C', '#005D21'];
const RED_PALETTE = ['#EF4444', '#E03C3C', '#D13535', '#C22D2D', '#B32525', '#A41D1D'];

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { dateRange, startDate, endDate, setStartDate, setEndDate, setDateRange } = useAdminDateRange();
  const [activeTab, setActiveTab] = useState<"overview" | "profit_loss" | "trial_balance" | "general_ledger" | "account_ledger" | "cash_flow" | "balance_sheet" | "tax_summary">("overview");
  const [plan, setPlan] = useState<PlanType>('Free');

  // Ledger specific state
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [journalFilter, setJournalFilter] = useState("all");
  const [activePicker, setActivePicker] = useState<"trial_date" | null>(null);

  // Trial balance uses its own local date (not the shared global date) 
  // so switching tabs doesn't re-trigger the main data load.
  const todayStr = new Date().toISOString().split("T")[0];
  const [trialBalanceDate, setTrialBalanceDate] = useState(todayStr);
  const trialStart = "1970-01-01";

  const formatDateFriendly = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1]) - 1;
    const day = parseInt(parts[2]);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[monthIdx]} ${day}, ${year}`;
  };

  const [ledgerLoading, setLedgerLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMain() {
      setLoading(true);
      try {
        const [res, cls, accs, currentPlan] = await Promise.all([
          getReports(startDate, endDate),
          getClients(),
          import("../actions/accounts").then(m => m.getAccounts(startDate, endDate)),
          getTenantPlan()
        ]);
        if (!cancelled) {
          setData(res);
          setClients(cls);
          setAccounts(accs);
          setPlan(currentPlan);
        }
      } catch (e) {
        console.error("Failed to load reports", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadMain();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    async function loadLedger() {
      setLedgerLoading(true);
      try {
        // For trial_balance, use the local trialBalanceDate instead of the shared global range
        const ledgerStart = activeTab === "trial_balance" ? trialStart : startDate;
        const ledgerEnd   = activeTab === "trial_balance" ? trialBalanceDate : endDate;
        const accountId   = activeTab === "account_ledger" ? selectedAccountId : null;
        const txs = await import("../actions/accounts").then(m => m.getLedger(accountId, ledgerStart, ledgerEnd));
        if (!cancelled) {
          setTransactions(txs);
        }
      } catch (e) {
        console.error("Failed to load ledger", e);
      } finally {
        if (!cancelled) setLedgerLoading(false);
      }
    }
    loadLedger();
    return () => { cancelled = true; };
  }, [startDate, endDate, activeTab, selectedAccountId, trialBalanceDate]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("reports:tab-change", { detail: activeTab }));
    // No longer mutate global date range on tab switch — trial balance uses its own local date
  }, [activeTab]);

  useEffect(() => {
    // Broadcast the trial balance date for the top-bar display
    if (activeTab === "trial_balance") {
      window.dispatchEvent(new CustomEvent("reports:formatted-date", { detail: formatDateFriendly(trialBalanceDate) }));
    } else {
      window.dispatchEvent(new CustomEvent("reports:formatted-date", { detail: formatDateFriendly(endDate) }));
    }
  }, [endDate, trialBalanceDate, activeTab]);

  useEffect(() => {
    const handleToggle = () => {
      setActivePicker(prev => prev === "trial_date" ? null : "trial_date");
    };
    window.addEventListener("reports:toggle-datepicker", handleToggle);
    return () => {
      window.removeEventListener("reports:toggle-datepicker", handleToggle);
    };
  }, []);



  if (loading || !data) {
    return (
      <div className="space-y-4">
        {/* Four Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-card w-14 h-14" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-transparent border border-border rounded-full w-32" />
          ))}
        </div>
        
        {/* Two side-by-side charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 animate-pulse">
          <div className="bg-transparent border border-border rounded-3xl p-6 space-y-6">
            <div className="h-6 bg-white/10 rounded-full w-40" />
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-card rounded-full w-20" />
                  <div className="h-8 bg-white/10 rounded-2xl flex-1" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-transparent border border-border rounded-3xl p-6 space-y-6">
            <div className="h-6 bg-white/10 rounded-full w-40" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-4 bg-card rounded-full w-20" />
                  <div className="h-8 bg-white/10 rounded-2xl flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Client Revenue Chart */}
        <div className="bg-transparent border border-border rounded-3xl p-6 animate-pulse space-y-6">
          <div className="h-6 bg-white/10 rounded-full w-48" />
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-card rounded-full w-20" />
                <div className="h-8 bg-white/10 rounded-2xl flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Compute chronological running balance
  let runningBalance = 0;
  const journalEntriesWithBalance = [...(data.journalEntries || [])]
    .reverse() // older transactions first to compute running balance
    .map((entry: any) => {
      if (entry.type === "income") {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return {
        ...entry,
        runningBalance
      };
    })
    .reverse(); // back to latest first for display

  // Filter journal entries
  const filteredJournal = journalEntriesWithBalance
    .filter((entry: any) => {
      const matchesSearch = 
        entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (journalFilter === "income") return matchesSearch && entry.type === "income";
      if (journalFilter === "expense") return matchesSearch && entry.type === "expense";
      return matchesSearch;
    });

  const stats = [
    { label: "Total Income", value: formatLKR(data.totalIncome), icon: MdTrendingUp, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Expenses", value: formatLKR(data.totalExpenses), icon: MdTrendingDown, color: "text-red-400", bg: "bg-red-400/10" },
    { label: "Net Profit", value: formatLKR(data.netProfit), icon: MdAttachMoney, color: "text-brand-400", bg: "bg-brand-400/10" },
    { label: "Profit Margin", value: `${data.profitMargin}%`, icon: Percent, color: "text-blue-400", bg: "bg-blue-400/10" },
  ];

  // Top 5 clients by revenue for the chart
  const topClientsChart = [...clients]
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .map((c) => ({ name: c.name, revenue: c.revenue }));

  const content = (
    <div className="space-y-6 print:p-0 print:m-0">
      {/* Stats Cards - Displayed on all tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex items-center gap-4 hover:bg-card transition-colors">
            <div className={`p-4 rounded-2xl ${stat.bg}`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-2xl font-semibold">
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs Row - Pill styled like expenses page categories */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 print:hidden">
        {/* Main Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          {[
            { id: "overview", label: "Overview", icon: <MdShowChart className="w-4 h-4" /> },
            { id: "profit_loss", label: "Profit & Loss", icon: <MdTrendingUp className="w-4 h-4" /> },
            { id: "cash_flow", label: "Cash Flow", icon: <MdAttachMoney className="w-4 h-4" /> },
            { id: "balance_sheet", label: "Balance Sheet", icon: <MdMenuBook className="w-4 h-4" /> },
            { id: "tax_summary", label: "Tax Summary", icon: <Percent className="w-4 h-4" /> },
            { id: "trial_balance", label: "Trial Balance", icon: <MdInsertDriveFile className="w-4 h-4" /> },
            { id: "general_ledger", label: "General Ledger", icon: <MdMenuBook className="w-4 h-4" /> },
            { id: "account_ledger", label: "Account Ledger", icon: <MdGroup className="w-4 h-4" /> }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTab(t.id as any);
                if (t.id === 'account_ledger' && accounts.length > 0 && !selectedAccountId) {
                  setSelectedAccountId(accounts[0].id);
                }
                if (t.id === 'general_ledger') {
                  setSelectedAccountId(null);
                }
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                activeTab === t.id
                  ? "bg-brand-500 text-brand-900 border-brand-500 font-bold"
                  : "bg-card text-foreground border-border hover:bg-black/5 dark:hover:bg-white/5 transition-opacity"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Datepicker dropdown for trial balance (anchored here) */}
        {activePicker === "trial_date" && (
          <WheelDatePicker
            value={endDate}
            onChange={(date) => {
              setEndDate(date);
              setStartDate("1970-01-01");
            }}
            onClose={() => setActivePicker(null)}
            label="As of Date"
          />
        )}
      </div>

      {activeTab !== "overview" && activeTab !== "profit_loss" && plan !== "Pro Plus" ? (
        <UpgradeOverlay
          title="Advanced Stats & Analytics"
          description="Gain deep insights with general ledgers, trial balances, and detailed profit & loss reports. Upgrade to Pro Plus to unlock this feature."
          requiredPlan="Pro Plus"
        >
          <div />
        </UpgradeOverlay>
      ) : (
        <>
          {activeTab === "overview" && (
        <>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Income Chart */}
            <div className="bg-transparent border border-border rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Income by Service</h2>
              <div style={{ height: Math.max(300, (data.incomeByService?.length || 0) * 45) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.incomeByService} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={150} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Income']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {data.incomeByService?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={GREEN_PALETTE[index % GREEN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expenses Chart */}
            <div className="bg-transparent border border-border rounded-3xl p-6">
              <h2 className="text-xl font-semibold mb-6">Expenses Breakdown</h2>
              <div style={{ height: Math.max(300, (data.expensesBreakdown?.length || 0) * 45) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.expensesBreakdown} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `LKR ${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={150} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Expense']}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {data.expensesBreakdown?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={RED_PALETTE[index % RED_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Clients by Revenue Chart */}
          {topClientsChart.length > 0 && (
            <div className="bg-transparent border border-border rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <h2 className="text-xl font-semibold">Top Clients by Revenue</h2>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClientsChart} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                    <XAxis
                      type="number"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `LKR ${value / 1000}k`}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      contentStyle={{ backgroundColor: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '16px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(value: any) => [formatLKR(value), 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={24}>
                      {topClientsChart.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={GREEN_PALETTE[index % GREEN_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {(activeTab === "general_ledger" || activeTab === "account_ledger") && (
        <div className="space-y-4">
          {activeTab === "account_ledger" && accounts.find(a => a.id === selectedAccountId) && (() => {
            const selectedAccount = accounts.find(a => a.id === selectedAccountId);
            const periodInflow = transactions.reduce((sum, t) => sum + t.debit, 0);
            const periodOutflow = transactions.reduce((sum, t) => sum + t.credit, 0);
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-transparent border border-border p-6 rounded-3xl flex items-center gap-4">
                  <div className="p-4 text-foreground flex shrink-0"><MdMenuBook className="w-6 h-6"/></div>
                  <div><p className="text-sm text-gray-400">Account Book Balance</p><p className="text-2xl font-semibold">{formatLKR(selectedAccount.currentBalance)}</p></div>
                </div>
                <div className="bg-transparent border border-border p-6 rounded-3xl flex items-center gap-4">
                  <div className="p-4 text-foreground flex shrink-0"><MdCallMade className="w-6 h-6"/></div>
                  <div><p className="text-sm text-gray-400">Period Inflow (Debit)</p><p className="text-2xl font-semibold text-green-400">+{formatLKR(periodInflow)}</p></div>
                </div>
                <div className="bg-transparent border border-border p-6 rounded-3xl flex items-center gap-4">
                  <div className="p-4 text-foreground flex shrink-0"><MdCallReceived className="w-6 h-6"/></div>
                  <div><p className="text-sm text-gray-400">Period Outflow (Credit)</p><p className="text-2xl font-semibold text-red-400">-{formatLKR(periodOutflow)}</p></div>
                </div>
              </div>
            );
          })()}

          <div className="bg-transparent border border-border rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-3">
                {activeTab === 'general_ledger' && (
                  <h2 className="text-lg font-semibold">Ledger: All Accounts</h2>
                )}
                {activeTab === 'account_ledger' && (
                  <select value={selectedAccountId || ""} onChange={e => setSelectedAccountId(parseInt(e.target.value))} className="bg-transparent border border-border rounded-xl px-4 py-2 text-sm outline-none">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type.split(' ')[0]})</option>)}
                  </select>
                )}
              </div>
              <div className="relative w-full sm:w-64">
                <MdSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="MdSearch descriptions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-transparent border border-border rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-brand-500 transition-colors" />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-border text-xs text-gray-400 uppercase tracking-wider">
                    <th className="p-4 font-medium">Date</th>
                    {activeTab === 'general_ledger' && <th className="p-4 font-medium">Account</th>}
                    <th className="p-4 font-medium">Description</th>
                    <th className="p-4 font-medium">Reference</th>
                    <th className="p-4 font-medium text-right">Debit (+)</th>
                    <th className="p-4 font-medium text-right">Credit (-)</th>
                    {activeTab === 'account_ledger' && <th className="p-4 font-medium text-right">Running Balance</th>}
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {ledgerLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading ledger...</td></tr>
                  ) : transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.referenceType.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">No transactions found for this period.</td></tr>
                  ) : (
                    (() => {
                      let rb = activeTab === 'account_ledger' && selectedAccountId ? (accounts.find(a => a.id === selectedAccountId)?.initialBalance || 0) : 0;
                      
                      const filtered = transactions.filter(t => t.description.toLowerCase().includes(searchTerm.toLowerCase()) || t.referenceType.toLowerCase().includes(searchTerm.toLowerCase()));
                      
                      const withBalance = filtered.map(t => {
                        if (activeTab === 'account_ledger') {
                          rb += t.debit - t.credit;
                        }
                        return { ...t, rb };
                      });

                      return withBalance.reverse().map((t, i) => {
                        const accName = accounts.find(a => a.id === t.accountId)?.name || 'Unknown';
                        const relatedAccName = accounts.find(a => a.id === t.relatedAccountId)?.name || 'Unknown';
                        let displayAccount = accName;
                        if (activeTab === 'general_ledger' && t.referenceType === 'Transfer') {
                          displayAccount = `${accName} → ${relatedAccName}`;
                        }
                        return (
                          <tr key={i} className="hover:bg-card transition-colors">
                            <td className="p-4 text-gray-300">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                            {activeTab === 'general_ledger' && <td className="p-4 text-gray-300 text-xs">{displayAccount}</td>}
                            <td className="p-4">{t.description || "-"}</td>
                            <td className="p-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${t.referenceType === 'Income' ? 'bg-brand-500/20 text-brand-500' : t.referenceType === 'Expense' ? 'bg-red-500/20 text-red-500' : 'bg-purple-500/20 text-purple-400'}`}>
                                {t.referenceType.toUpperCase()}
                              </span>
                            </td>
                            <td className="p-4 text-right text-green-400">{t.debit > 0 ? `+${formatLKR(t.debit)}` : "-"}</td>
                            <td className="p-4 text-right text-red-400">{t.credit > 0 ? `-${formatLKR(t.credit)}` : "-"}</td>
                            {activeTab === 'account_ledger' && (
                              <td className={`p-4 text-right font-medium ${t.rb < 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {formatLKR(t.rb)}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "profit_loss" && (
        <div className="space-y-4">
          {/* Income vs Expenses Cards */}
          <div className="bg-transparent border border-border rounded-3xl p-8 flex flex-col md:flex-row items-center justify-around gap-8 text-center">
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Income</span>
              <span className="text-2xl font-bold text-green-400">{formatLKR(data.totalIncome)}</span>
            </div>
            <div className="hidden md:block text-2xl text-gray-500 font-light">—</div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Expenses</span>
              <span className="text-2xl font-bold text-red-400">{formatLKR(data.totalExpenses)}</span>
            </div>
            <div className="hidden md:block text-2xl text-gray-500 font-light">=</div>
            <div className="flex flex-col">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Net Profit</span>
              <span className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {data.netProfit < 0 ? "-" : ""}{formatLKR(Math.abs(data.netProfit))}
              </span>
            </div>
          </div>

          {/* Accounts Breakdown Table */}
          <div className="bg-transparent border border-border rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Accounts</h3>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                {dateRange === "lifetime"
                  ? "Lifetime"
                  : `${new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} to ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
              </span>
            </div>

            <div className="space-y-4">
              {/* Income */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3">Income</h4>
                <div className="divide-y divide-white/5 pl-4">
                  {data.incomeByService.map((row: any, i: number) => (
                    <div key={i} className="flex justify-between py-3.5 text-sm">
                      <span className="text-gray-300">{row.name}</span>
                      <span className="text-foreground font-semibold">{formatLKR(row.value)}</span>
                    </div>
                  ))}
                  {data.incomeByService.length === 0 && (
                    <div className="flex justify-between py-3.5 text-sm text-gray-500">
                      <span>No income recorded in this period</span>
                      <span>LKR 0.00</span>
                    </div>
                  )}
                  <div className="flex justify-between py-4 text-sm font-bold border-t border-border mt-2">
                    <span className="text-foreground">Total Income</span>
                    <span className="text-foreground">{formatLKR(data.totalIncome)}</span>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div>
                <h4 className="text-sm font-bold text-foreground mb-3">Expenses</h4>
                <div className="divide-y divide-white/5 pl-4">
                  {data.expensesBreakdown.map((row: any, i: number) => (
                    <div key={i} className="flex justify-between py-3.5 text-sm">
                      <span className="text-gray-300">{row.name}</span>
                      <span className="text-foreground font-semibold">{formatLKR(row.value)}</span>
                    </div>
                  ))}
                  {data.expensesBreakdown.length === 0 && (
                    <div className="flex justify-between py-3.5 text-sm text-gray-500">
                      <span>No expenses recorded in this period</span>
                      <span>LKR 0.00</span>
                    </div>
                  )}
                  <div className="flex justify-between py-4 text-sm font-bold border-t border-border mt-2">
                    <span className="text-foreground">Total Expenses</span>
                    <span className="text-foreground">{formatLKR(data.totalExpenses)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Margin */}
            <div className="bg-card rounded-2xl p-5 flex justify-between items-center border border-border">
              <div>
                <div className="text-sm font-bold text-foreground">Net Profit</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">As a percentage of Total Income</div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${data.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {data.netProfit < 0 ? "-" : ""}{formatLKR(Math.abs(data.netProfit))}
                </div>
                <div className="text-xs text-gray-400 mt-1">{data.profitMargin}%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "trial_balance" && (
        <div className="bg-transparent border border-border rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Accounts</h3>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
              As of {new Date(trialBalanceDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 w-1/2">Accounts</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {/* Assets Section */}
                <tr className="bg-card font-bold">
                  <td colSpan={3} className="py-3 px-4 text-foreground text-xs uppercase tracking-wider">Accounts (Assets & Liabilities)</td>
                </tr>
                {accounts.map(acc => {
                  if (acc.currentBalance === 0) return null;
                  return (
                    <tr key={acc.id} className="hover:bg-card transition-colors">
                      <td className="py-3.5 px-6 text-gray-300 pl-8">
                        {false 
                          ? `${acc.currentBalance < 0 ? 'Capital' : 'Debt'} ${acc.name.replace(/Debts?\s*/i, '')}` 
                          : acc.name}
                      </td>
                      <td className="py-3.5 px-4 text-right text-foreground font-medium">
                        {acc.currentBalance > 0 ? formatLKR(acc.currentBalance) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right text-gray-400 font-medium">
                        {acc.currentBalance < 0 ? formatLKR(Math.abs(acc.currentBalance)) : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* Income Section */}
                <tr className="bg-card font-bold">
                  <td colSpan={3} className="py-3 px-4 text-foreground text-xs uppercase tracking-wider">Income</td>
                </tr>
                {data.incomeByService.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-card transition-colors">
                    <td className="py-3.5 px-6 text-gray-300 pl-8">{row.name}</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                    <td className="py-3.5 px-4 text-right text-foreground font-medium">{formatLKR(row.value)}</td>
                  </tr>
                ))}
                {data.incomeByService.length === 0 && (
                  <tr className="hover:bg-card transition-colors">
                    <td className="py-3.5 px-6 text-gray-400 pl-8">No Income Category</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                  </tr>
                )}
                <tr className="font-semibold text-gray-300">
                  <td className="py-3.5 px-6 pl-8">Total Income</td>
                  <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                  <td className="py-3.5 px-4 text-right text-foreground font-bold">
                    {formatLKR(data.totalIncome)}
                  </td>
                </tr>

                {/* Expenses Section */}
                <tr className="bg-card font-bold">
                  <td colSpan={3} className="py-3 px-4 text-foreground text-xs uppercase tracking-wider">Expenses</td>
                </tr>
                {data.expensesBreakdown.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-card transition-colors">
                    <td className="py-3.5 px-6 text-gray-300 pl-8">{row.name}</td>
                    <td className="py-3.5 px-4 text-right text-foreground font-medium">{formatLKR(row.value)}</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                  </tr>
                ))}
                {data.expensesBreakdown.length === 0 && (
                  <tr className="hover:bg-card transition-colors">
                    <td className="py-3.5 px-6 text-gray-400 pl-8">No Expense Category</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                  </tr>
                )}
                <tr className="font-semibold text-gray-300">
                  <td className="py-3.5 px-6 pl-8">Total Expenses</td>
                  <td className="py-3.5 px-4 text-right text-foreground font-bold">
                    {formatLKR(data.totalExpenses)}
                  </td>
                  <td className="py-3.5 px-4 text-right text-gray-500 font-medium">—</td>
                </tr>

                {/* Initial Capital / Opening Balance */}
                {(() => {
                  const totalInit = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);
                  if (totalInit === 0) return null;
                  return (
                    <tr className="font-semibold text-gray-300">
                      <td className="py-3.5 px-6 pl-8">Net Opening Balance</td>
                      <td className="py-3.5 px-4 text-right text-foreground font-medium">
                        {totalInit < 0 ? formatLKR(Math.abs(totalInit)) : "—"}
                      </td>
                      <td className="py-3.5 px-4 text-right text-foreground font-medium">
                        {totalInit > 0 ? formatLKR(totalInit) : "—"}
                      </td>
                    </tr>
                  );
                })()}

                {/* Grand Totals */}
                {(() => {
                  const totalAccountsDebit = accounts.reduce((sum, a) => sum + (a.currentBalance > 0 ? a.currentBalance : 0), 0);
                  const totalAccountsCredit = accounts.reduce((sum, a) => sum + (a.currentBalance < 0 ? Math.abs(a.currentBalance) : 0), 0);
                  const totalInit = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0);
                  
                  const grandTotalDebit = totalAccountsDebit + data.totalExpenses + (totalInit < 0 ? Math.abs(totalInit) : 0);
                  const grandTotalCredit = totalAccountsCredit + data.totalIncome + (totalInit > 0 ? totalInit : 0);
                  return (
                    <tr className="bg-white/10 font-bold border-t-2 border-black/20 dark:border-white/20">
                      <td className="py-4 px-4 text-foreground uppercase tracking-wider">Total for all accounts</td>
                      <td className="py-4 px-4 text-right text-foreground text-base">{formatLKR(grandTotalDebit)}</td>
                      <td className="py-4 px-4 text-right text-foreground text-base">{formatLKR(grandTotalCredit)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "cash_flow" && data?.advanced && (
        <div className="bg-transparent border border-border rounded-3xl p-8 overflow-x-auto print:p-0 print:border-none">
          <h2 className="text-2xl font-bold mb-6">Statement of Cash Flows</h2>
          <table className="w-full text-sm text-left">
            <thead className="border-b border-border text-gray-400">
              <tr>
                <th className="py-4 px-4 font-semibold uppercase tracking-wider">Description</th>
                <th className="py-4 px-4 font-semibold uppercase tracking-wider text-right">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-black/10 transition-colors group">
                <td className="py-4 px-4 font-medium text-foreground">Cash Inflow (Operating Activities)</td>
                <td className="py-4 px-4 text-right text-green-400 font-semibold">{formatLKR(data.totalIncome)}</td>
              </tr>
              <tr className="hover:bg-black/10 transition-colors group">
                <td className="py-4 px-4 font-medium text-foreground pl-8">Customer Payments & Sales</td>
                <td className="py-4 px-4 text-right text-gray-300">{formatLKR(data.totalIncome)}</td>
              </tr>
              <tr className="hover:bg-black/10 transition-colors group">
                <td className="py-4 px-4 font-medium text-foreground">Cash Outflow (Operating Activities)</td>
                <td className="py-4 px-4 text-right text-red-400 font-semibold">({formatLKR(data.totalExpenses)})</td>
              </tr>
              <tr className="hover:bg-black/10 transition-colors group">
                <td className="py-4 px-4 font-medium text-foreground pl-8">Operating Expenses & Purchases</td>
                <td className="py-4 px-4 text-right text-gray-300">({formatLKR(data.totalExpenses)})</td>
              </tr>
              <tr className="bg-white/10 font-bold border-t-2 border-black/20 dark:border-white/20">
                <td className="py-4 px-4 text-foreground uppercase tracking-wider">Net Cash Flow from Operations</td>
                <td className={`py-4 px-4 text-right text-base ${data.totalIncome - data.totalExpenses >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatLKR(data.totalIncome - data.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "balance_sheet" && data?.advanced && (
        <div className="bg-transparent border border-border rounded-3xl p-8 overflow-x-auto print:p-0 print:border-none">
          <h2 className="text-2xl font-bold mb-6">Balance Sheet (Statement of Financial Position)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold border-b border-border pb-2 mb-4 text-brand-400">Assets</h3>
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-black/10 transition-colors">
                    <td className="py-3 px-2 font-medium">Cash and Cash Equivalents (Bank)</td>
                    <td className="py-3 px-2 text-right">{formatLKR(data.advanced.assets.bankBalance)}</td>
                  </tr>
                  <tr className="hover:bg-black/10 transition-colors">
                    <td className="py-3 px-2 font-medium">Accounts Receivable (Unpaid Invoices)</td>
                    <td className="py-3 px-2 text-right">{formatLKR(data.advanced.assets.accountsReceivable)}</td>
                  </tr>
                  <tr className="font-bold border-t border-white/20 bg-white/5">
                    <td className="py-3 px-2">Total Assets</td>
                    <td className="py-3 px-2 text-right">{formatLKR(data.advanced.assets.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="text-lg font-bold border-b border-border pb-2 mb-4 text-red-400">Liabilities & Equity</h3>
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-black/10 transition-colors">
                    <td className="py-3 px-2 font-medium text-gray-400">Accounts Payable</td>
                    <td className="py-3 px-2 text-right text-gray-400">{formatLKR(data.advanced.liabilities.accountsPayable)}</td>
                  </tr>
                  <tr className="font-bold border-t border-white/10 text-gray-400">
                    <td className="py-3 px-2">Total Liabilities</td>
                    <td className="py-3 px-2 text-right">{formatLKR(data.advanced.liabilities.total)}</td>
                  </tr>
                  <tr className="hover:bg-black/10 transition-colors mt-4">
                    <td className="py-3 px-2 font-medium text-brand-400">Owner's Equity / Retained Earnings</td>
                    <td className="py-3 px-2 text-right text-brand-400">{formatLKR(data.advanced.equity)}</td>
                  </tr>
                  <tr className="font-bold border-t border-white/20 bg-white/5">
                    <td className="py-3 px-2">Total Liabilities & Equity</td>
                    <td className="py-3 px-2 text-right">{formatLKR(data.advanced.liabilities.total + data.advanced.equity)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "tax_summary" && data?.advanced && (
        <div className="bg-transparent border border-border rounded-3xl p-8 overflow-x-auto print:p-0 print:border-none max-w-2xl">
          <h2 className="text-2xl font-bold mb-6">Tax Summary</h2>
          <table className="w-full text-sm text-left">
            <thead className="border-b border-border text-gray-400">
              <tr>
                <th className="py-4 px-4 font-semibold uppercase tracking-wider">Tax Type</th>
                <th className="py-4 px-4 font-semibold uppercase tracking-wider text-right">Amount (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr className="hover:bg-black/10 transition-colors group">
                <td className="py-4 px-4 font-medium text-foreground">Tax Collected (Sales/Invoices)</td>
                <td className="py-4 px-4 text-right text-gray-300">{formatLKR(data.advanced.taxCollected)}</td>
              </tr>
              <tr className="hover:bg-black/10 transition-colors group text-gray-500">
                <td className="py-4 px-4 font-medium">Tax Paid (Expenses/Purchases)</td>
                <td className="py-4 px-4 text-right">-</td>
              </tr>
              <tr className="bg-white/10 font-bold border-t-2 border-black/20 dark:border-white/20">
                <td className="py-4 px-4 text-foreground uppercase tracking-wider">Net Tax Liability</td>
                <td className="py-4 px-4 text-right text-base text-amber-400">
                  {formatLKR(data.advanced.taxCollected)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-gray-500">* Note: Net Tax Liability is the estimated tax you owe based on recorded invoices. Please consult a professional accountant for official filings.</p>
        </div>
      )}
        </>
      )}
    </div>
  );

  return content;
}
