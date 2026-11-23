"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui/Loader";
import { Edit2, Star, Undo2, Copy, Check } from "lucide-react";
import { MdDelete, MdCallMade, MdCallReceived, MdAccountBalanceWallet, MdAccountBalance, MdHandshake } from "react-icons/md";
import { getAccounts, createAccount, updateAccount, deleteAccount, transferCash, setDefaultAccount, getTransfers, updateTransfer, deleteTransfer } from "../actions/accounts";
import { getLimitStatus } from "../actions/actions";
import { getTenantPlan } from "../actions/plan";
import AnimatedNumber from "../components/AnimatedNumber";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useAppLock } from "../components/AppLockProvider";
import { useRole } from "../context/RoleContext";

const formatLKR = (amount: number) => {
  const num = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
  return `${num} LKR`;
};

export default function AccountsPage() {
  const { confirm } = useConfirm();
  const { requireAuth } = useAppLock();
  const { role, planName } = useRole();
  const [currentPlan, setCurrentPlan] = useState<string>("Free");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTransferId, setEditingTransferId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "bank" | "cash" | "debt">("all");
  
  const [formData, setFormData] = useState({ name: "", ownerName: "", type: "Cash Account", bankName: "", accountNumber: "", branch: "", initialBalance: 0 });
  const [transferData, setTransferData] = useState({ date: new Date().toISOString().split("T")[0], sourceAccountId: 0, destinationAccountId: 0, amount: 0, description: "" });
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const isProPlus = currentPlan === "Pro Plus" || (planName || "").toLowerCase().includes("plus");

  const load = async (showSkeleton = false) => {
    if (showSkeleton) setLoading(true);
    try {
      const [accs, trans, plan] = await Promise.all([getAccounts(), getTransfers(), getTenantPlan()]);
      setAccounts(accs);
      setTransfers(trans);
      if (plan) setCurrentPlan(plan);
    } catch (e) {
      console.error(e);
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  const handleOpenCreate = (defaultType = "Cash Account") => {
    setEditingId(null);
    const resolvedType = defaultType === "Debt Account" ? "Debt Given" : defaultType;
    setFormData({ name: "", ownerName: "", type: resolvedType, bankName: "", accountNumber: "", branch: "", initialBalance: 0 });
    setShowCreate(true);
  };

  useEffect(() => {
    load(true);
    getLimitStatus('accounts').then(status => {
      if (!status.allowed) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: status.error }));
      }
    });
    const handleCreate = () => handleOpenCreate("Cash Account");
    const handleTransfer = () => setShowTransfer(true);
    window.addEventListener("accounts:open-create", handleCreate);
    window.addEventListener("accounts:open-transfer", handleTransfer);
    return () => {
      window.removeEventListener("accounts:open-create", handleCreate);
      window.removeEventListener("accounts:open-transfer", handleTransfer);
    };
  }, []);

  const handleTypeChange = (newType: string) => {
    if (isDebt(newType) && !isProPlus) {
      window.dispatchEvent(
        new CustomEvent('upgrade-modal:open', {
          detail: 'Debt accounts are exclusively available on the Pro Plus plan. Upgrade to Pro Plus to track debts and settlements without skewing your profit & loss statements.'
        })
      );
      return;
    }
    setFormData(prev => ({ ...prev, type: newType }));
  };

  const handleSave = async () => {
    if (isDebt(formData.type) && !isProPlus) {
      window.dispatchEvent(
        new CustomEvent('upgrade-modal:open', {
          detail: 'Debt accounts are exclusively available on the Pro Plus plan.'
        })
      );
      return;
    }

    const payload = { ...formData, initialBalance: parseFloat(formData.initialBalance as any) || 0 };
    try {
      let res;
      if (editingId) {
        res = await updateAccount(editingId, payload);
      } else {
        res = await createAccount(payload);
      }
      if (res?.error) {
        if (res.error.includes("PRO_PLUS_REQUIRED") || res.error.includes("LIMIT_EXCEEDED")) {
          window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: res.error.replace("PRO_PLUS_REQUIRED: ", "") }));
          return;
        }
        throw new Error(res.error);
      }
      setShowCreate(false);
      setEditingId(null);
      setFormData({ name: "", ownerName: "", type: "Cash Account", bankName: "", accountNumber: "", branch: "", initialBalance: 0 });
      load();
    } catch (e: any) {
      if (e?.message?.includes("LIMIT_EXCEEDED") || e?.message?.includes("PRO_PLUS_REQUIRED")) {
        window.dispatchEvent(new CustomEvent('upgrade-modal:open', { detail: e.message.replace("PRO_PLUS_REQUIRED: ", "") }));
      } else {
        alert(e?.message || "Failed to save account.");
      }
    }
  };

  const handleTransfer = async () => {
    const amt = parseFloat(transferData.amount as any) || 0;
    if (transferData.sourceAccountId && transferData.destinationAccountId && amt !== 0) {
      if (editingTransferId) {
        await updateTransfer(editingTransferId, { ...transferData, amount: amt });
      } else {
        await transferCash({ ...transferData, amount: amt });
      }
      setShowTransfer(false);
      setEditingTransferId(null);
      setTransferData({ date: new Date().toISOString().split("T")[0], sourceAccountId: 0, destinationAccountId: 0, amount: 0, description: "" });
      load();
    }
  };

  const handleEditTransfer = (tr: any) => {
    setEditingTransferId(tr.id);
    setTransferData({
      date: tr.date,
      sourceAccountId: tr.sourceAccountId,
      destinationAccountId: tr.destinationAccountId,
      amount: tr.amount,
      description: tr.description
    });
    setShowTransfer(true);
  };

  const handleDeleteTransfer = async (id: number) => {
    if (await confirm("Are you sure you want to undo this transfer?")) {
      await deleteTransfer(id);
      load();
    }
  };

  const handleSetDefault = async (id: number) => {
    await setDefaultAccount(id);
    load();
  };

  const isBank = (type?: string) => {
    const t = String(type || "").trim().toLowerCase();
    return t === "bank" || t === "bank account";
  };

  const isDebt = (type?: string) => {
    const t = String(type || "").trim().toLowerCase();
    return t.includes("debt") || t.includes("loan");
  };

  const isDebtTaken = (type?: string) => {
    const t = String(type || "").trim().toLowerCase();
    return isDebt(t) && (t.includes("taken") || t.includes("borrow") || t.includes("payable"));
  };

  const isDebtGiven = (type?: string) => {
    return isDebt(type) && !isDebtTaken(type);
  };

  const isCash = (type?: string) => {
    const t = String(type || "").trim().toLowerCase();
    return !isBank(t) && !isDebt(t);
  };

  const handleEdit = (acc: any) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      ownerName: acc.ownerName || "",
      type: isDebtTaken(acc.type)
        ? "Debt Taken"
        : isDebt(acc.type)
          ? "Debt Given"
          : isBank(acc.type)
            ? "Bank Account"
            : "Cash Account",
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      branch: acc.branch || "",
      initialBalance: acc.initialBalance || 0,
    });
    setShowCreate(true);
  };

  const handleDelete = async (id: number) => {
    if (await confirm("Are you sure you want to delete this account?")) {
      await deleteAccount(id);
      load();
    }
  };

  const handleCopyBankDetails = async (acc: any) => {
    const details: string[] = [];
    if (acc.ownerName) {
      details.push(`Owner Name: ${acc.ownerName}`);
    } else if (acc.name) {
      details.push(`Account Name: ${acc.name}`);
    }
    if (acc.accountNumber) details.push(`Account Number: ${acc.accountNumber}`);
    if (acc.bankName) details.push(`Bank: ${acc.bankName}`);
    if (acc.branch) details.push(`Branch: ${acc.branch}`);

    const text = details.join("\n");
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(acc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error("Failed to copy bank details:", e);
    }
  };

  const handleIssueDebt = (debtAcc: any) => {
    const defaultAcc = accounts.find(a => (isBank(a.type) || isCash(a.type)) && a.isDefault) || accounts.find(a => isBank(a.type) || isCash(a.type));
    setTransferData({
      date: new Date().toISOString().split("T")[0],
      sourceAccountId: defaultAcc?.id || 0,
      destinationAccountId: debtAcc.id,
      amount: 0,
      description: `Debt issuance to ${debtAcc.name}`,
    });
    setEditingTransferId(null);
    setShowTransfer(true);
  };

  const handleRecordRepayment = (debtAcc: any) => {
    const defaultAcc = accounts.find(a => (isBank(a.type) || isCash(a.type)) && a.isDefault) || accounts.find(a => isBank(a.type) || isCash(a.type));
    setTransferData({
      date: new Date().toISOString().split("T")[0],
      sourceAccountId: debtAcc.id,
      destinationAccountId: defaultAcc?.id || 0,
      amount: debtAcc.currentBalance > 0 ? debtAcc.currentBalance : 0,
      description: `Debt settlement from ${debtAcc.name}`,
    });
    setEditingTransferId(null);
    setShowTransfer(true);
  };

  const handleReceiveDebt = (debtAcc: any) => {
    const defaultAcc = accounts.find(a => (isBank(a.type) || isCash(a.type)) && a.isDefault) || accounts.find(a => isBank(a.type) || isCash(a.type));
    setTransferData({
      date: new Date().toISOString().split("T")[0],
      sourceAccountId: debtAcc.id,
      destinationAccountId: defaultAcc?.id || 0,
      amount: 0,
      description: `Borrowed debt received from ${debtAcc.name}`,
    });
    setEditingTransferId(null);
    setShowTransfer(true);
  };

  const handleRepayDebt = (debtAcc: any) => {
    const defaultAcc = accounts.find(a => (isBank(a.type) || isCash(a.type)) && a.isDefault) || accounts.find(a => isBank(a.type) || isCash(a.type));
    setTransferData({
      date: new Date().toISOString().split("T")[0],
      sourceAccountId: defaultAcc?.id || 0,
      destinationAccountId: debtAcc.id,
      amount: debtAcc.currentBalance > 0 ? debtAcc.currentBalance : 0,
      description: `Debt repayment to ${debtAcc.name}`,
    });
    setEditingTransferId(null);
    setShowTransfer(true);
  };

  const totalBank = accounts.filter(a => isBank(a.type)).reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalCash = accounts.filter(a => isCash(a.type)).reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalDebtGiven = accounts.filter(a => isDebtGiven(a.type)).reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalDebtTaken = accounts.filter(a => isDebtTaken(a.type)).reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalAssets = totalBank + totalCash + totalDebtGiven;
  const netDebt = totalDebtGiven - totalDebtTaken;

  const filteredAccounts = accounts.filter(acc => {
    if (activeFilter === "bank") return isBank(acc.type);
    if (activeFilter === "cash") return isCash(acc.type);
    if (activeFilter === "debt") return isDebt(acc.type);
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border p-6 rounded-3xl flex items-center gap-4 animate-pulse">
              <div className="w-12 h-12 rounded-2xl bg-card flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-card rounded-full w-24" />
                <div className="h-6 bg-white/10 rounded-full w-32" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-transparent border border-border rounded-3xl p-7 flex flex-col h-48 animate-pulse">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-card" />
                  <div className="space-y-2">
                    <div className="h-5 bg-white/10 rounded-full w-32" />
                    <div className="h-3 bg-card rounded-full w-20" />
                  </div>
                </div>
              </div>
              <div className="mt-auto flex justify-between items-end">
                <div className="space-y-2">
                  <div className="h-3 bg-card rounded-full w-16" />
                  <div className="h-3 bg-card rounded-full w-16" />
                </div>
                <div className="space-y-2 text-right flex flex-col items-end">
                  <div className="h-3 bg-card rounded-full w-20" />
                  <div className="h-6 bg-white/10 rounded-full w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4 shadow-xs">
          <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-foreground flex shrink-0">
            <MdAccountBalanceWallet className="w-6 h-6"/>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Assets Balance</p>
            <p className="text-2xl font-bold tracking-tight text-foreground" data-stat-value>
              <AnimatedNumber value={formatLKR(totalAssets)} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4 shadow-xs">
          <div className="p-3.5 rounded-2xl bg-emerald-100/70 text-emerald-700 dark:bg-green-500/10 dark:text-green-400 flex shrink-0">
            <MdAccountBalance className="w-6 h-6"/>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Bank Accounts Balance</p>
            <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-green-400" data-stat-value>
              <AnimatedNumber value={formatLKR(totalBank)} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4 shadow-xs">
          <div className="p-3.5 rounded-2xl bg-blue-100/70 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 flex shrink-0">
            <MdAccountBalanceWallet className="w-6 h-6"/>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cash Accounts Balance</p>
            <p className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400" data-stat-value>
              <AnimatedNumber value={formatLKR(totalCash)} />
            </p>
          </div>
        </div>
        <div className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4 shadow-xs">
          <div className="p-3.5 rounded-2xl bg-amber-100/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 flex shrink-0">
            <MdHandshake className="w-6 h-6"/>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm text-gray-500 dark:text-gray-400">Debts Balance</p>
              {!isProPlus && (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Pro Plus
                </span>
              )}
            </div>
            <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400" data-stat-value>
              <AnimatedNumber value={formatLKR(totalDebtGiven > 0 && totalDebtTaken > 0 ? netDebt : totalDebtGiven > 0 ? totalDebtGiven : totalDebtTaken)} />
            </p>
            {(totalDebtGiven > 0 || totalDebtTaken > 0) && (
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span>Given: <span className="font-semibold text-amber-600 dark:text-amber-400" data-stat-value>{formatLKR(totalDebtGiven)}</span></span>
                <span>•</span>
                <span>Taken: <span className="font-semibold text-purple-600 dark:text-purple-400" data-stat-value>{formatLKR(totalDebtTaken)}</span></span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { key: "all", label: `All Accounts (${accounts.length})` },
            { key: "bank", label: `Bank (${accounts.filter(a => isBank(a.type)).length})` },
            { key: "cash", label: `Cash (${accounts.filter(a => isCash(a.type)).length})` },
            { key: "debt", label: `Debts (${accounts.filter(a => isDebt(a.type)).length})`, isDebt: true },
          ].map((tab) => {
            const active = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key as any)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                    : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-muted/50 shadow-2xs"
                }`}
              >
                <span>{tab.label}</span>
                {tab.isDebt && !isProPlus && (
                  <span className={`text-[9px] uppercase font-bold px-1 rounded ${
                    active ? "bg-brand-950/20 text-brand-950" : "bg-amber-500/20 text-amber-500"
                  }`}>
                    Pro Plus
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredAccounts.map(acc => {
          const debt = isDebt(acc.type);
          const debtTaken = isDebtTaken(acc.type);
          const bank = isBank(acc.type);
          return (
            <div key={acc.id} className="bg-card border border-border p-6 rounded-3xl flex flex-col justify-between shadow-xs hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4">
                  <div className={`p-3 rounded-2xl ${
                    debtTaken
                      ? 'bg-purple-100/70 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400'
                      : debt
                        ? 'bg-amber-100/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        : bank 
                          ? 'bg-emerald-100/70 text-emerald-700 dark:bg-green-500/10 dark:text-green-400' 
                          : 'bg-blue-100/70 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                  }`}>
                    {debt ? <MdHandshake className="w-5 h-5"/> : bank ? <MdAccountBalance className="w-5 h-5"/> : <MdAccountBalanceWallet className="w-5 h-5"/>}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {acc.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {debtTaken ? 'Debt Taken (Payable)' : debt ? 'Debt Given (Receivable)' : bank ? 'Bank Account' : 'Cash Account'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {bank && (
                    <button
                      onClick={() => handleCopyBankDetails(acc)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        copiedId === acc.id
                          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                      title={copiedId === acc.id ? "Copied bank details!" : "Copy bank details"}
                    >
                      {copiedId === acc.id ? (
                        <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {role !== 'Viewer' && (
                    <>
                      <button onClick={() => handleSetDefault(acc.id)} className={`transition-colors p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 ${acc.isDefault ? "text-amber-500 dark:text-yellow-400" : "text-gray-400 hover:text-amber-500 dark:hover:text-yellow-400"}`} title="Set as Default">
                        <Star className="w-4 h-4" fill={acc.isDefault ? "currentColor" : "none"} />
                      </button>
                      <button onClick={() => handleEdit(acc)} className="text-gray-400 hover:text-foreground p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Edit Account"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(acc.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors" title="Delete Account"><MdDelete className="w-4 h-4" /></button>
                    </>
                  )}
                </div>
              </div>
              
              {bank && (acc.ownerName || acc.bankName || acc.accountNumber || acc.branch) && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-6 space-y-1">
                  {acc.ownerName && <p>Owner: <span className="text-foreground font-medium">{acc.ownerName}</span></p>}
                  {acc.bankName && <p>Bank: {acc.bankName}</p>}
                  {acc.accountNumber && <p>A/C: {acc.accountNumber}</p>}
                  {acc.branch && <p>Branch: {acc.branch}</p>}
                </div>
              )}

              {debt && acc.branch && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-6 space-y-1">
                  <p>Terms: <span className="text-foreground font-medium">{acc.branch}</span></p>
                </div>
              )}

              {debt && role !== 'Viewer' && (
                <div className="flex items-center gap-2 mb-4">
                  {debtTaken ? (
                    <>
                      <button
                        onClick={() => handleReceiveDebt(acc)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-green-400 border border-emerald-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Receive borrowed funds into Bank/Cash"
                      >
                        <MdCallReceived className="w-3.5 h-3.5" /> Receive Debt
                      </button>
                      <button
                        onClick={() => handleRepayDebt(acc)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Repay borrowed debt from Bank/Cash"
                      >
                        <MdCallMade className="w-3.5 h-3.5" /> Repay Debt
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleIssueDebt(acc)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-green-400 border border-emerald-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Transfer funds to this Debt Account"
                      >
                        <MdCallMade className="w-3.5 h-3.5" /> Issue Debt
                      </button>
                      <button
                        onClick={() => handleRecordRepayment(acc)}
                        className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/20 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        title="Record debt settlement into Bank/Cash"
                      >
                        <MdCallReceived className="w-3.5 h-3.5" /> Settle Debt
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-between items-end mt-auto">
                <div className="space-y-1">
                  <p className="text-xs text-emerald-600 dark:text-green-400 flex items-center gap-1">
                    <MdCallMade className="w-3 h-3"/> {debtTaken ? 'Borrowed:' : debt ? 'Issued:' : 'Inflow:'} <span data-stat-value>{formatLKR(acc.periodInflow)}</span>
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <MdCallReceived className="w-3 h-3"/> {debtTaken ? 'Repaid:' : debt ? 'Settled:' : 'Outflow:'} <span data-stat-value>{formatLKR(acc.periodOutflow)}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {debtTaken ? 'Outstanding Payable' : debt ? 'Outstanding Receivable' : 'Current Balance'}
                  </p>
                  <p className={`text-xl font-bold tracking-tight ${(
                    debtTaken
                      ? acc.currentBalance > 0
                        ? 'text-purple-600 dark:text-purple-400'
                        : acc.currentBalance === 0
                          ? 'text-gray-500 dark:text-gray-400'
                          : 'text-emerald-600 dark:text-green-400'
                      : debt
                        ? acc.currentBalance > 0
                          ? 'text-amber-600 dark:text-amber-400'
                          : acc.currentBalance === 0
                            ? 'text-gray-500 dark:text-gray-400'
                            : 'text-red-600 dark:text-red-400'
                        : acc.currentBalance < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-emerald-600 dark:text-green-400'
                  )}`} data-stat-value>
                    {formatLKR(acc.currentBalance)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {filteredAccounts.length === 0 && (
          <div className="col-span-full bg-card border border-border rounded-3xl p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
              <MdHandshake className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {activeFilter === "debt" ? "No Debt accounts yet" : "No accounts found"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
              {activeFilter === "debt"
                ? "Track debts given to businesses, partners, or employees and their settlements with zero distortion to your income or expense statements."
                : "Create an account to start tracking your balances and transfers."}
            </p>
            {role !== 'Viewer' && (
              <button
                onClick={() => {
                  if (activeFilter === "debt" && !isProPlus) {
                    window.dispatchEvent(
                      new CustomEvent('upgrade-modal:open', {
                        detail: 'Debt accounts are exclusively available on the Pro Plus plan.'
                      })
                    );
                    return;
                  }
                  handleOpenCreate(activeFilter === "debt" ? "Debt Account" : "Cash Account");
                }}
                className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-semibold text-sm transition-colors shadow-xs"
              >
                + Create {activeFilter === "debt" ? "Debt Account" : "Account"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-xs">
        <h2 className="text-lg font-semibold mb-6 text-foreground">Cash Transfer History</h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500">No transfers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-600 dark:text-gray-400 uppercase bg-black/[0.02] dark:bg-white/[0.02] border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium rounded-tl-xl">Date</th>
                  <th className="px-4 py-3 font-medium">Source Account</th>
                  <th className="px-4 py-3 font-medium">Destination Account</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right rounded-tr-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-black/[0.02] dark:hover:bg-card transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{tr.date}</td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400">{tr.sourceAccountName}</td>
                    <td className="px-4 py-3 text-emerald-600 dark:text-green-400">{tr.destinationAccountName}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{tr.description || "-"}</td>
                    <td className="px-4 py-3 text-right font-medium" data-stat-value>{formatLKR(tr.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {role !== 'Viewer' && (
                          <>
                            <button onClick={() => handleEditTransfer(tr)} className="text-gray-400 hover:text-foreground transition-colors" title="Edit Transfer">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteTransfer(tr.id)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Undo Transfer">
                              <Undo2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-6 text-foreground">
              {editingId
                ? isDebtTaken(formData.type)
                  ? "Edit Debt Taken Account"
                  : isDebt(formData.type)
                    ? "Edit Debt Given Account"
                    : "Edit Account"
                : isDebtTaken(formData.type)
                  ? "Create Debt Taken Account"
                  : isDebt(formData.type)
                    ? "Create Debt Given Account"
                    : "Create Account"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Account Name</label>
                <input
                  type="text"
                  placeholder={
                    isDebtTaken(formData.type)
                      ? "e.g. Commercial Bank Facility or Director Debt"
                      : isDebt(formData.type)
                        ? "e.g. Kasun Perera - Equipment Debt"
                        : "e.g. Main Operating"
                  }
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-700 dark:text-gray-300 block">Account Type</label>
                  {!isProPlus && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                      Debt accounts need Pro Plus
                    </span>
                  )}
                </div>
                <select
                  value={formData.type}
                  onChange={e => handleTypeChange(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs"
                >
                  <option value="Cash Account" className="bg-card text-foreground">Cash Account</option>
                  <option value="Bank Account" className="bg-card text-foreground">Bank Account</option>
                  <option value="Debt Given" className="bg-card text-foreground">
                    Debt Given (Lent to others / Receivable){!isProPlus ? ' (Pro Plus only)' : ''}
                  </option>
                  <option value="Debt Taken" className="bg-card text-foreground">
                    Debt Taken (Borrowed from others / Payable){!isProPlus ? ' (Pro Plus only)' : ''}
                  </option>
                </select>
              </div>

              {isDebt(formData.type) && (
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Debt Direction</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-black/[0.03] dark:bg-white/[0.03] border border-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: "Debt Given" }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        isDebtGiven(formData.type)
                          ? "bg-amber-500 text-amber-950 shadow-xs"
                          : "text-gray-500 dark:text-gray-400 hover:text-foreground"
                      }`}
                    >
                      Debt Given (Receivable)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, type: "Debt Taken" }))}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
                        isDebtTaken(formData.type)
                          ? "bg-purple-500 text-purple-950 shadow-xs"
                          : "text-gray-500 dark:text-gray-400 hover:text-foreground"
                      }`}
                    >
                      Debt Taken (Payable)
                    </button>
                  </div>
                </div>
              )}

              {isDebt(formData.type) ? (
                <div>
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Terms / Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder={isDebtTaken(formData.type) ? "e.g. 12% annual, 24 monthly installments" : "e.g. 6-mo repayment schedule"}
                    value={formData.branch}
                    onChange={e => setFormData({...formData, branch: e.target.value})}
                    className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs"
                  />
                </div>
              ) : isBank(formData.type) ? (
                <>
                  <div>
                    <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Account Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Kasun Perera or Framebooks LLC"
                      value={formData.ownerName}
                      onChange={e => setFormData({...formData, ownerName: e.target.value})}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Bank Name</label>
                    <input type="text" placeholder="e.g. Bank of Ceylon" value={formData.bankName} onChange={e => setFormData({...formData, bankName: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Account Number</label>
                      <input type="text" placeholder="e.g. 0004833004" value={formData.accountNumber} onChange={e => setFormData({...formData, accountNumber: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
                    </div>
                    <div>
                      <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Branch</label>
                      <input type="text" placeholder="e.g. Moratuwa" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
                    </div>
                  </div>
                </>
              ) : null}

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                  {isDebtTaken(formData.type)
                    ? "Initial Outstanding Debt Owed (LKR)"
                    : isDebt(formData.type)
                      ? "Initial Outstanding Debt Receivable (LKR)"
                      : "Initial Balance (LKR)"}
                </label>
                <input
                  type="number"
                  value={Number.isNaN(Number(formData.initialBalance)) ? formData.initialBalance : formData.initialBalance}
                  onChange={e => setFormData({...formData, initialBalance: e.target.value === "" ? "" : e.target.value as any})}
                  placeholder="0"
                  className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setShowCreate(false); setEditingId(null); setFormData({ name: "", ownerName: "", type: "Cash Account", bankName: "", accountNumber: "", branch: "", initialBalance: 0 }); }} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-card transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold transition-colors shadow-xs">Save Account</button>
            </div>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-semibold mb-6 text-foreground">{editingTransferId ? "Edit Transfer" : "Transfer Funds"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Date</label>
                <input type="date" value={transferData.date} onChange={e => setTransferData({...transferData, date: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
              </div>
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Source Account (From)</label>
                <select value={transferData.sourceAccountId} onChange={e => setTransferData({...transferData, sourceAccountId: parseInt(e.target.value)})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs">
                  <option value={0} className="bg-card text-foreground">Select Source Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-card text-foreground">
                      {a.name} [{isDebtTaken(a.type) ? 'Debt Taken' : isDebt(a.type) ? 'Debt Given' : isBank(a.type) ? 'Bank' : 'Cash'}] ({formatLKR(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Destination Account (To)</label>
                <select value={transferData.destinationAccountId} onChange={e => setTransferData({...transferData, destinationAccountId: parseInt(e.target.value)})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs">
                  <option value={0} className="bg-card text-foreground">Select Destination Account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} className="bg-card text-foreground">
                      {a.name} [{isDebtTaken(a.type) ? 'Debt Taken' : isDebt(a.type) ? 'Debt Given' : isBank(a.type) ? 'Bank' : 'Cash'}] ({formatLKR(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const src = accounts.find(a => a.id === transferData.sourceAccountId);
                const dest = accounts.find(a => a.id === transferData.destinationAccountId);
                if (!src || !dest) return null;

                if ((isBank(src.type) || isCash(src.type)) && isDebtGiven(dest.type)) {
                  return (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                      💸 <strong className="font-semibold text-amber-900 dark:text-amber-200">Debt Issuance</strong>: Moving money into &ldquo;{dest.name}&rdquo; increases the outstanding debt receivable without creating an expense.
                    </div>
                  );
                }

                if (isDebtGiven(src.type) && (isBank(dest.type) || isCash(dest.type))) {
                  return (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                      💰 <strong className="font-semibold text-emerald-900 dark:text-emerald-200">Debt Settlement</strong>: Moving money from &ldquo;{src.name}&rdquo; records repayment and reduces the outstanding debt receivable without creating taxable income.
                    </div>
                  );
                }

                if (isDebtTaken(src.type) && (isBank(dest.type) || isCash(dest.type))) {
                  return (
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-800 dark:text-purple-300">
                      📥 <strong className="font-semibold text-purple-900 dark:text-purple-200">Debt Received</strong>: Receiving borrowed money from &ldquo;{src.name}&rdquo; into your account increases available funds and records debt payable without creating taxable income.
                    </div>
                  );
                }

                if ((isBank(src.type) || isCash(src.type)) && isDebtTaken(dest.type)) {
                  return (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                      📤 <strong className="font-semibold text-emerald-900 dark:text-emerald-200">Debt Repayment</strong>: Moving money into &ldquo;{dest.name}&rdquo; pays down borrowed debt and reduces your outstanding liability without creating an expense.
                    </div>
                  );
                }

                return null;
              })()}

              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Amount (LKR)</label>
                <input type="number" value={Number.isNaN(Number(transferData.amount)) ? transferData.amount : transferData.amount} onChange={e => setTransferData({...transferData, amount: e.target.value === "" ? "" : e.target.value as any})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
              </div>
              <div>
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">Description</label>
                <input type="text" placeholder="e.g. Debt transfer or settlement installment" value={transferData.description} onChange={e => setTransferData({...transferData, description: e.target.value})} className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-foreground outline-none focus:border-brand-500 shadow-2xs" />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button onClick={() => { setShowTransfer(false); setEditingTransferId(null); setTransferData({ date: new Date().toISOString().split("T")[0], sourceAccountId: 0, destinationAccountId: 0, amount: 0, description: "" }); }} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-card transition-colors">Cancel</button>
              <button onClick={handleTransfer} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold transition-colors shadow-xs">{editingTransferId ? "Save Changes" : "Transfer Funds"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
