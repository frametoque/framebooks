// src/app/(dashboard)/admin/coupons/CouponsClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Tag, 
  Plus, 
  Percent, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  CheckCircle2,
  X
} from "lucide-react";
import { formatLKR } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { createCoupon, toggleCouponActive } from "./actions";

export function CouponsClient({ coupons }: { coupons: any[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(20);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState(100);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [statusToast, setStatusToast] = useState("");

  const activeCount = coupons.filter((c) => c.is_active).length;
  const totalRedeemed = coupons.reduce((sum, c) => sum + Number(c.actual_redemptions ?? c.redeemed_count ?? 0), 0);

  const filtered = coupons.filter((c) => {
    if (activeFilter === "active") return c.is_active;
    if (activeFilter === "inactive") return !c.is_active;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCoupon({
        code: code.trim().toUpperCase(),
        type,
        value: Number(value),
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
        maxRedemptions: Number(maxRedemptions) || undefined,
      });
      setCreateOpen(false);
      setCode("");
      setStatusToast("Coupon created");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch {
      alert("Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await toggleCouponActive(id, !current);
      setStatusToast(!current ? "Coupon activated" : "Coupon paused");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch {
      alert("Couldn't save. Try again.");
    }
  };

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Top of Page: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminStatCard
          label="Active coupons"
          value={activeCount}
          icon={Tag}
          iconBg="bg-brand-500/15 dark:bg-brand-400/10"
          iconColor="text-brand-700 dark:text-brand-400"
        />

        <AdminStatCard
          label="Total redeemed"
          value={totalRedeemed}
          icon={Percent}
          iconBg="bg-blue-100/80 dark:bg-blue-400/10"
          iconColor="text-blue-700 dark:text-blue-400"
        />
      </div>

      {/* Filter Chips & Action Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "inactive", label: "Paused" },
          ].map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key as any)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-colors border cursor-pointer ${
                  active
                    ? "bg-brand-500 text-brand-950 border-brand-500 font-bold shadow-xs"
                    : "bg-card text-foreground/80 hover:text-foreground border-border hover:bg-muted/50 shadow-2xs"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New coupon</span>
        </button>
      </div>

      {/* Coupons Table */}
      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-slate-50/75 dark:bg-white/[0.02] text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
                <th className="p-4">Code</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Redeemed</th>
                <th className="p-4">Expires</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">
                    No coupons found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-foreground">
                      {c.code}
                    </td>

                    <td className="p-4 font-semibold text-brand-600 dark:text-brand-400">
                      {c.type === "percent" ? `${c.value}% off` : `${formatLKR(c.value)} off`}
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{Number(c.actual_redemptions ?? c.redeemed_count ?? 0)}</span>
                      <span> / {c.max_redemptions || "Unlimited"}</span>
                    </td>

                    <td className="p-4 text-xs text-muted-foreground">
                      {c.valid_to ? new Date(c.valid_to).toLocaleDateString() : "Never"}
                    </td>

                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        c.is_active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {c.is_active ? "Active" : "Paused"}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleToggle(c.id, c.is_active)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        title={c.is_active ? "Pause" : "Activate"}
                      >
                        {c.is_active ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Coupon Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">New coupon</h3>
              <button
                onClick={() => setCreateOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Coupon code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono font-bold uppercase text-foreground outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Discount type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm outline-none"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="fixed">Fixed (LKR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Expires on
                  </label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxRedemptions}
                    onChange={(e) => setMaxRedemptions(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors shadow-xs"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
