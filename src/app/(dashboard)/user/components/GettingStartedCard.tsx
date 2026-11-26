"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { MdClose, MdArrowForward } from "react-icons/md";
import { Check } from "lucide-react";
import { useAppLock } from "./AppLockProvider";
import { dismissGettingStartedGuideAction } from "../actions/tenants";
import { getClientTenantInfo } from "@/lib/tenant/clientTenantInfo";

interface GettingStartedCardProps {
  tenantId?: number | string | null;
  tenantInfo?: any;
  dashboardData?: any;
}

interface ChecklistItem {
  id: string;
  stepIndex: number;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
  isCompleted?: boolean;
}

export default function GettingStartedCard({
  tenantId,
  tenantInfo: propTenantInfo,
  dashboardData,
}: GettingStartedCardProps) {
  const { data: session } = useSession();
  const sessionTenantId = (session?.user as any)?.tenantId;

  const { hasAppLock } = useAppLock();
  const [internalTenantInfo, setInternalTenantInfo] = useState<any>(propTenantInfo || null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [manualCompleted, setManualCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (propTenantInfo) {
      setInternalTenantInfo(propTenantInfo);
    } else {
      getClientTenantInfo()
        .then((info) => {
          if (info) setInternalTenantInfo(info);
        })
        .catch(() => {});
    }
  }, [propTenantInfo]);

  const tenantInfo = propTenantInfo || internalTenantInfo;
  const effectiveTenantId = tenantId || tenantInfo?.id || tenantInfo?.tenantId || sessionTenantId || dashboardData?.tenantId;

  const storageKey = effectiveTenantId
    ? `framebooks_getting_started_dismissed_${effectiveTenantId}`
    : "framebooks_getting_started_dismissed_default";

  const manualKey = effectiveTenantId
    ? `framebooks_checklist_completed_${effectiveTenantId}`
    : "framebooks_checklist_completed_default";

  const isDismissedInStorage = (): boolean => {
    if (typeof window === "undefined") return true;
    try {
      // 1. Check cookies (persists 1 year across pages, tabs, and sessions)
      if (document.cookie.includes("fb_guide_dismissed=true")) return true;
      if (effectiveTenantId && document.cookie.includes(`fb_guide_dismissed_${effectiveTenantId}=true`)) return true;

      // 2. Check localStorage global & default keys
      if (localStorage.getItem("framebooks_getting_started_dismissed_global") === "true") return true;
      if (localStorage.getItem("framebooks_getting_started_dismissed_default") === "true") return true;
      if (localStorage.getItem("framebooks_guide_dismissed") === "true") return true;

      // 3. Check specific tenant key
      if (effectiveTenantId && localStorage.getItem(`framebooks_getting_started_dismissed_${effectiveTenantId}`) === "true") {
        return true;
      }

      // 4. Check if any tenant guide was marked dismissed
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("framebooks_getting_started_dismissed_") && localStorage.getItem(key) === "true") {
          return true;
        }
      }
    } catch {}
    return false;
  };

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return isDismissedInStorage();
  });

  // Re-verify whenever storageKey or effectiveTenantId changes
  useEffect(() => {
    setMounted(true);
    if (isDismissedInStorage()) {
      setIsDismissed(true);
    }
  }, [storageKey, effectiveTenantId]);

  // Load manual completion from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(manualKey);
      if (saved) {
        setManualCompleted(JSON.parse(saved));
      } else {
        const defaultSaved = localStorage.getItem("framebooks_checklist_completed_default");
        if (defaultSaved) {
          setManualCompleted(JSON.parse(defaultSaved));
        }
      }
    } catch {}
  }, [manualKey]);

  // Compute automatic completion states based on real data
  const hasProfileSetup = Boolean(
    tenantInfo && (
      tenantInfo.phone ||
      tenantInfo.address ||
      tenantInfo.logo_url ||
      tenantInfo.industry ||
      tenantInfo.website ||
      tenantInfo.email ||
      (tenantInfo.name && tenantInfo.name.trim() !== "" && tenantInfo.name !== "My Business")
    )
  );
  const hasAccounts = Boolean(
    (dashboardData?.totalAssets !== undefined && Number(dashboardData.totalAssets) > 0) ||
    (dashboardData?.accountsCount !== undefined && Number(dashboardData.accountsCount) > 0) ||
    (dashboardData?.recentTransactions && dashboardData.recentTransactions.length > 0)
  );
  const hasInvoices = Boolean(
    (dashboardData?.recentInvoices && dashboardData.recentInvoices.length > 0) ||
    (dashboardData?.totalInvoices && dashboardData.totalInvoices > 0) ||
    (dashboardData?.invoiceAging && dashboardData.invoiceAging.length > 0 && dashboardData.invoiceAging.some((r: any) => Number(r.count) > 0))
  );
  const hasIncome = Boolean(
    (dashboardData?.lifetimeIncome !== undefined && Number(dashboardData.lifetimeIncome) > 0) ||
    (dashboardData?.lifetimeExpenses !== undefined && Number(dashboardData.lifetimeExpenses) > 0) ||
    (dashboardData?.totalIncome !== undefined && Number(dashboardData.totalIncome) > 0) ||
    (dashboardData?.totalExpenses !== undefined && Number(dashboardData.totalExpenses) > 0) ||
    (dashboardData?.recentTransactions && dashboardData.recentTransactions.length > 0)
  );

  const items: ChecklistItem[] = [
    {
      id: "profile",
      stepIndex: 0,
      title: "Set up your business profile",
      subtitle: "Save your company name, logo, currency and address.",
      href: "/settings",
      actionLabel: "Go to Settings",
      isCompleted: manualCompleted["profile"] !== undefined 
        ? manualCompleted["profile"] 
        : hasProfileSetup,
    },
    {
      id: "accounts",
      stepIndex: 1,
      title: "Add a bank or cash account",
      subtitle: "Track bank balances, petty cash, or cards.",
      href: "/user/accounts",
      actionLabel: "Go to Accounts",
      isCompleted: manualCompleted["accounts"] !== undefined 
        ? manualCompleted["accounts"] 
        : hasAccounts,
    },
    {
      id: "invoices",
      stepIndex: 2,
      title: "Create your first invoice",
      subtitle: "Bill your clients and track payment status.",
      href: "/user/invoices",
      actionLabel: "Go to Invoices",
      isCompleted: manualCompleted["invoices"] !== undefined 
        ? manualCompleted["invoices"] 
        : hasInvoices,
    },
    {
      id: "income",
      stepIndex: 3,
      title: "Record income or expense",
      subtitle: "Log cash flow as money arrives or goes out.",
      href: "/user/income",
      actionLabel: "Go to Income",
      isCompleted: manualCompleted["income"] !== undefined 
        ? manualCompleted["income"] 
        : hasIncome,
    },
    {
      id: "app_lock",
      stepIndex: 4,
      title: "Set up App Lock",
      subtitle: "Secure your dashboard with passkeys or biometrics.",
      href: "/settings/security",
      actionLabel: "Set up App Lock",
      isCompleted: manualCompleted["app_lock"] !== undefined 
        ? manualCompleted["app_lock"] 
        : hasAppLock,
    },
  ];

  const completedCount = items.filter((i) => i.isCompleted).length;
  const allCompleted = items.length > 0 && completedCount === items.length;
  const [autoHidden, setAutoHidden] = useState<boolean>(false);
  const isFirstCheckRef = useRef<boolean>(true);

  // Automatically hide when all tasks are complete
  useEffect(() => {
    if (!mounted) return;

    if (allCompleted) {
      if (isFirstCheckRef.current) {
        // Hide immediately without flashing if already done on initial load
        setAutoHidden(true);
        handleDismiss();
      } else {
        // User just completed the final task: small delay to perceive success, then smoothly collapse
        const timer = setTimeout(() => {
          setAutoHidden(true);
          handleDismiss();
        }, 700);
        return () => clearTimeout(timer);
      }
    } else {
      setAutoHidden(false);
    }
    isFirstCheckRef.current = false;
  }, [allCompleted, mounted, storageKey]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem("framebooks_getting_started_dismissed_global", "true");
      localStorage.setItem("framebooks_getting_started_dismissed_default", "true");
      localStorage.setItem("framebooks_guide_dismissed", "true");
      localStorage.setItem(storageKey, "true");
      if (effectiveTenantId) {
        localStorage.setItem(`framebooks_getting_started_dismissed_${effectiveTenantId}`, "true");
        document.cookie = `fb_guide_dismissed_${effectiveTenantId}=true; path=/; max-age=31536000; SameSite=Lax`;
      }
      document.cookie = `fb_guide_dismissed=true; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    // Persist to server cookies & session
    try {
      dismissGettingStartedGuideAction(effectiveTenantId).catch(() => {});
    } catch {}
  };

  const toggleManualCheck = (id: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...manualCompleted, [id]: !currentState };
    setManualCompleted(updated);
    try {
      localStorage.setItem(manualKey, JSON.stringify(updated));
    } catch {}
  };

  if (!mounted) return null;

  const isVisible = !isDismissed && !autoHidden;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="getting-started-card"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden" }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="relative rounded-3xl border border-border bg-card text-foreground p-5 sm:p-6 shadow-xs overflow-hidden"
        >
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 relative z-10">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              Getting started
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {completedCount} of {items.length} done. Complete these steps to set up your business workspace.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer hidden sm:block font-medium"
            >
              Dismiss guide
            </button>
            <button
              onClick={handleDismiss}
              title="Dismiss guide"
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <MdClose className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Checklist rows */}
        <div className="space-y-2 relative z-10">
          {items.map((item, index) => {
            const isDone = Boolean(item.isCompleted);

            return (
              <div
                key={item.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl transition-all border ${
                  isDone
                    ? "bg-muted/20 dark:bg-white/[0.015] border-border/40 opacity-80"
                    : "bg-muted/40 dark:bg-white/[0.03] border-border/70 hover:bg-muted/70 dark:hover:bg-white/[0.05]"
                }`}
              >
                {/* Number or Checkmark pill + Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={(e) => toggleManualCheck(item.id, isDone, e)}
                    title={isDone ? "Click to mark incomplete" : "Click to mark done"}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-transform active:scale-90 cursor-pointer ${
                      isDone
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25 dark:border-blue-500/30 hover:bg-blue-500/20"
                    }`}
                  >
                    {isDone ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>

                  <div className="min-w-0">
                    <h3
                      className={`text-xs sm:text-sm font-semibold tracking-tight truncate ${
                        isDone ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className={`text-[11px] sm:text-xs text-muted-foreground truncate ${isDone ? "opacity-75" : ""}`}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right Action Buttons: [Mark as done] + [Go to ...] */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {/* Mark as done toggle button */}
                  <button
                    type="button"
                    onClick={(e) => toggleManualCheck(item.id, isDone, e)}
                    className={`w-32 sm:w-36 h-[34px] flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isDone
                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-background hover:bg-muted text-foreground border border-border hover:border-black/20 dark:hover:border-white/20 shadow-2xs"
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    <span>{isDone ? "Done" : "Mark as done"}</span>
                  </button>

                  {/* Direct Navigation Button */}
                  <Link
                    href={item.href}
                    className="w-32 sm:w-36 h-[34px] flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-600/20 dark:hover:bg-blue-600/30 active:scale-95 text-blue-700 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs"
                  >
                    <span>{item.actionLabel}</span>
                    <MdArrowForward className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);
}
