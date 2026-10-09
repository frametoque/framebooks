// src/components/admin/PlanChangeModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, ArrowRight, Check, Loader2 } from "lucide-react";
import { formatLKR, PlanBadge } from "@/components/Formatters";
import { checkDowngradeEligibility, changeSubscriptionPlan } from "@/app/(dashboard)/admin/subscriptions/actions";

interface PlanChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: any;
  allPlans: any[];
  onSuccess?: () => void;
}

export function PlanChangeModal({
  isOpen,
  onClose,
  subscription,
  allPlans,
  onSuccess,
}: PlanChangeModalProps) {
  const [targetPlanKey, setTargetPlanKey] = useState<string>("pro");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [effectiveNow, setEffectiveNow] = useState(true);
  const [isComp, setIsComp] = useState(false);
  const [customEndDate, setCustomEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [overrideLimits, setOverrideLimits] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downgradeWarning, setDowngradeWarning] = useState<any | null>(null);

  const currentPlan = allPlans.find((p) => p.id === subscription?.plan_id) || allPlans[0];
  const selectedPlan = allPlans.find((p) => p.key === targetPlanKey) || allPlans[0];

  // Whenever target plan changes, check downgrade limits
  useEffect(() => {
    if (!subscription?.tenant_id) return;
    let active = true;
    setChecking(true);
    checkDowngradeEligibility(subscription.tenant_id, targetPlanKey)
      .then((res) => {
        if (active) {
          if (!res.isEligible) {
            setDowngradeWarning(res.exceeded);
          } else {
            setDowngradeWarning(null);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [subscription, targetPlanKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert("Please enter a reason for the plan modification.");
      return;
    }

    try {
      setSubmitting(true);
      await changeSubscriptionPlan({
        subscriptionId: subscription.id,
        newPlanKey: targetPlanKey,
        interval,
        effectiveNow,
        isComp,
        customEndDate: customEndDate || undefined,
        reason: reason.trim(),
        overrideLimits,
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || "Failed to update subscription");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative my-8"
          >
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-xl font-bold text-foreground">Change Subscription Plan</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Workspace: <span className="font-semibold text-foreground">{subscription?.tenant_name}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 pt-4">
              {/* Plan Selection Cards */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select New Tier
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {allPlans.map((p) => {
                    const isSelected = p.key === targetPlanKey;
                    return (
                      <div
                        key={p.key}
                        onClick={() => setTargetPlanKey(p.key)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? "bg-brand-500/10 border-brand-500 text-foreground ring-1 ring-brand-500"
                            : "bg-black/[0.02] dark:bg-white/[0.02] border-border hover:border-black/20 dark:hover:border-white/20 text-gray-600 dark:text-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">{p.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-brand-500" />}
                        </div>
                        <div className="text-xs text-gray-500">
                          {p.price_monthly === 0 ? "Free" : `${formatLKR(p.price_monthly)}/mo`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Downgrade Warning */}
              {downgradeWarning && downgradeWarning.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    Quota Over-Usage Warning
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    This workspace currently has more records than the target plan allows:
                  </p>
                  <ul className="text-xs list-disc list-inside space-y-1 text-amber-700 dark:text-amber-300 font-medium">
                    {downgradeWarning.map((w: any, idx: number) => (
                      <li key={idx}>
                        {w.current} {w.resource} (Max allowed on {selectedPlan?.name}: {w.max})
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={overrideLimits}
                      onChange={(e) => setOverrideLimits(e.target.checked)}
                      className="rounded text-brand-500"
                    />
                    I acknowledge and approve overriding this limit restriction.
                  </label>
                </div>
              )}

              {/* Billing Interval & Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Billing Interval
                  </label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value as any)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground outline-none cursor-pointer"
                  >
                    <option value="monthly">Monthly ({formatLKR(selectedPlan?.price_monthly || 0)})</option>
                    <option value="yearly">Yearly ({formatLKR(selectedPlan?.price_yearly || 0)})</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                    Custom Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm text-foreground outline-none"
                  />
                </div>
              </div>

              {/* Switches: Comped & Effective timing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-border bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isComp}
                    onChange={(e) => setIsComp(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Comped plan</span>
                    <span className="text-[11px] text-muted-foreground">Free of charge</span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl border border-border bg-muted/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={effectiveNow}
                    onChange={(e) => setEffectiveNow(e.target.checked)}
                    className="rounded text-brand-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-foreground block">Effective immediately</span>
                    <span className="text-[11px] text-muted-foreground">Update privileges right away</span>
                  </div>
                </label>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Bank transfer verified"
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-brand-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border bg-card text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || checking || (!!downgradeWarning && !overrideLimits)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold bg-brand-500 hover:bg-brand-400 text-brand-900 transition-all shadow-md shadow-brand-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirm Plan Update
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
