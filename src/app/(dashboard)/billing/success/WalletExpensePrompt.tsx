"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Building,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Sparkles,
  X,
  CreditCard,
  PlusCircle,
} from "lucide-react";
import { recordWalletRechargeAsExpenseAction } from "../actions";

export interface AccountOption {
  id: number;
  name: string;
  type: string;
  bankName?: string;
  accountNumber?: string;
  currentBalance?: number;
}

export function WalletExpensePrompt({
  amount,
  accounts,
  returnUrl = "/settings/billing",
}: {
  amount: number;
  accounts: AccountOption[];
  returnUrl?: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<"ask" | "choose_account" | "completed">("ask");
  const [selectedAccountId, setSelectedAccountId] = useState<number>(
    accounts[0]?.id || 0
  );
  const [category, setCategory] = useState<string>("Subscriptions & Software");
  const [description, setDescription] = useState<string>(
    `Workspace Wallet Recharge (LKR ${amount.toLocaleString()})`
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successAccountName, setSuccessAccountName] = useState<string>("");

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setError("Please select an account.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await recordWalletRechargeAsExpenseAction({
        amount,
        accountId: selectedAccountId,
        category,
        description,
      });

      if (res.success) {
        setSuccessAccountName(res.accountName || "Selected Account");
        setStep("completed");
      } else {
        setError(res.error || "Failed to record expense.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-2 text-left space-y-4">
      {/* 1. INITIAL PROMPT STEP */}
      {step === "ask" && (
        <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
              <Receipt className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Record as a Business Expense?
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                Keep your workspace financial books accurate by adding this{" "}
                <strong className="text-foreground">LKR {amount.toLocaleString()}</strong> top-up to your business expenses.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                if (accounts.length > 0) {
                  setStep("choose_account");
                } else {
                  setError("No accounts found. Please create an account in Accounts & Banking first.");
                }
              }}
              className="py-2.5 px-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Yes, Add to Expenses</span>
            </button>

            <Link
              href={returnUrl}
              className="py-2.5 px-3.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-semibold text-xs border border-border flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>No, Skip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {error && (
            <p className="text-[11px] text-red-500 font-medium">{error}</p>
          )}
        </div>
      )}

      {/* 2. CHOOSE ACCOUNT STEP */}
      {step === "choose_account" && (
        <form
          onSubmit={handleRecordExpense}
          className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-brand-500" />
              <h4 className="text-xs sm:text-sm font-bold text-foreground">
                Select Payment Account
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setStep("ask")}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
              Paid From Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-foreground outline-none focus:border-brand-500 cursor-pointer"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} {acc.bankName ? `(${acc.bankName})` : ""} {acc.accountNumber ? `•••• ${acc.accountNumber.slice(-4)}` : ""} {acc.currentBalance !== undefined ? `— Bal: ${Number(acc.currentBalance).toLocaleString()} LKR` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-foreground outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="Subscriptions & Software">Subscriptions & Software</option>
                <option value="Software & Cloud Services">Software & Cloud Services</option>
                <option value="Office & Administration">Office & Administration</option>
                <option value="Bank Charges & Fees">Bank Charges & Fees</option>
                <option value="General Expenses">General Expenses</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs font-semibold text-foreground outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-red-500 font-medium">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => setStep("ask")}
              className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Expense...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Save Business Expense</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 3. COMPLETED STATE */}
      {step === "completed" && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-300 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Expense Recorded Successfully!</span>
          </div>
          <p className="text-xs text-muted-foreground">
            LKR <strong>{amount.toLocaleString()}</strong> was logged under{" "}
            <strong className="text-foreground">{successAccountName}</strong> and deducted from its balance.
          </p>
          <Link
            href={returnUrl}
            className="w-full py-2.5 px-4 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>Proceed to Billing Settings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

