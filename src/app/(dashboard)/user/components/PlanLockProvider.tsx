"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Lock, CreditCard, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRole } from "../context/RoleContext";

export function PlanLockProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isReadOnly, planName } = useRole();

  // If the workspace is in read-only mode (grace period expired),
  // block explicit creation and editing routes while leaving all dashboard viewing accessible.
  const isCreateOrEditRoute = 
    pathname?.startsWith("/user/invoices/new") ||
    pathname?.includes("/edit") ||
    pathname?.startsWith("/user/quotations/new");

  if (isReadOnly && isCreateOrEditRoute) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-background text-foreground">
        <div className="w-16 h-16 bg-rose-500/15 text-rose-500 border border-rose-500/25 rounded-3xl flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
          <Lock size={32} />
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/25 mb-3">
          Read-Only Mode Active
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Action Blocked</h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed text-xs sm:text-sm">
          Your <span className="font-semibold text-foreground">{planName}</span> subscription and grace period have expired. Full viewing access to your records is preserved, but adding or editing records is disabled until your plan is renewed.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link 
            href="/user/settings?tab=billing" 
            className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2"
          >
            <CreditCard size={16} />
            <span>Pay & Renew Subscription</span>
          </Link>
          <Link 
            href="/user/dashboard" 
            className="w-full sm:w-auto px-6 py-3 bg-muted hover:bg-muted/80 text-foreground rounded-2xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 border border-border"
          >
            <ArrowLeft size={16} />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  // Dashboard and all browsing views remain fully open for viewing
  return <>{children}</>;
}
