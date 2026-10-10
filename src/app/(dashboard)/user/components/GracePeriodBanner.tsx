"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, Lock, CreditCard, ArrowRight } from "lucide-react";
import { useRole } from "../context/RoleContext";

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

export function GracePeriodBanner() {
  const {
    isGracePeriod,
    isReadOnly,
    isPaymentPending,
    graceDaysRemaining,
    graceEndDate,
    planExpiresAt,
    planName,
  } = useRole();

  if (!isGracePeriod && !isReadOnly && !isPaymentPending) {
    return null;
  }

  if (isPaymentPending) {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/5 border border-amber-500/30 text-foreground shadow-sm animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  Pending Payment Notice — View-Only Mode
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  Payment Required
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-relaxed">
                This workspace has been flagged for <strong className="text-foreground">pending payment</strong> by platform administration. You can browse and view all your data, but creating, editing, and deleting records (invoices, expenses, incomes, clients, etc.) are disabled. Please settle the pending payment to restore full access.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href="/user/settings/billing"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Settle Payment Now</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isReadOnly) {
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-500/15 via-rose-500/10 to-rose-500/5 border border-rose-500/25 text-foreground shadow-sm animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  Workspace in Read-Only Mode
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  Grace Period Ended
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-relaxed">
                Your <span className="font-semibold text-foreground">{planName}</span> subscription and grace period have expired. Full viewing access to all existing invoices, income, expenses, accounts, and reports is preserved, but creating, editing, and deleting records are blocked. Please pay to renew and restore write access.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href="/user/settings/billing"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay & Renew Now</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isGracePeriod) {
    const days = graceDaysRemaining ?? 1;
    return (
      <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-amber-500/5 border border-amber-500/25 text-foreground shadow-sm animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-foreground">
                  Subscription Grace Period Active
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {days} {days === 1 ? "Day Remaining" : "Days Remaining"}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 leading-relaxed">
                Your <span className="font-semibold text-foreground">{planName}</span> subscription expired{planExpiresAt ? ` on ${formatDate(planExpiresAt)}` : ""}. You are currently in a grace period ending{graceEndDate ? ` on ${formatDate(graceEndDate)}` : ""}. Renew your subscription now to avoid having your workspace switched to read-only mode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Link
              href="/user/settings/billing"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs shadow-md transition-all cursor-pointer whitespace-nowrap"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Renew Subscription</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
