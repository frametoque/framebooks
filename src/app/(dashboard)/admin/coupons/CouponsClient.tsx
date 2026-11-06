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
  X,
  Pencil
} from "lucide-react";
import { formatLKR } from "@/components/Formatters";
import { AdminStatCard } from "@/app/(dashboard)/admin/_components/AdminStatCard";
import { createCoupon, toggleCouponActive, updateCoupon } from "./actions";

const AVAILABLE_PACKAGES = [
  { key: "pro", label: "Pro" },
  { key: "pro_plus", label: "Pro Plus" },
];

export function CouponsClient({ coupons }: { coupons: any[] }) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState(20);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState(100);
  const [applicablePlans, setApplicablePlans] = useState<string[]>(["pro", "pro_plus"]);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [statusToast, setStatusToast] = useState("");

  // Edit Coupon State
  const [editCoupon, setEditCoupon] = useState<any | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editType, setEditType] = useState<"percent" | "fixed">("percent");
  const [editValue, setEditValue] = useState(20);
  const [editValidTo, setEditValidTo] = useState("");
  const [editMaxRedemptions, setEditMaxRedemptions] = useState<number | string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editApplicablePlans, setEditApplicablePlans] = useState<string[]>(["pro", "pro_plus"]);

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
        applicablePlans,
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

  const handleOpenEdit = (c: any) => {
    setEditCoupon(c);
    setEditCode(c.code || "");
    setEditType(c.type || "percent");
    setEditValue(Number(c.value) || 0);
    setEditValidTo(
      c.valid_to ? new Date(c.valid_to).toISOString().split("T")[0] : ""
    );
    setEditMaxRedemptions(c.max_redemptions ?? "");
    setEditIsActive(Boolean(c.is_active));
    const rawPlans = Array.isArray(c.applicable_plans) ? c.applicable_plans : ["pro", "pro_plus"];
    const normalized = rawPlans.map((p: string) => p.toLowerCase().replace(/[^a-z0-9_]/g, "_"));
    setEditApplicablePlans(normalized.length > 0 ? normalized : ["pro", "pro_plus"]);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCoupon) return;
    setEditSubmitting(true);
    try {
      await updateCoupon({
        id: editCoupon.id,
        code: editCode.trim().toUpperCase(),
        type: editType,
        value: Number(editValue),
        validTo: editValidTo || undefined,
        maxRedemptions: editMaxRedemptions ? Number(editMaxRedemptions) : null,
        isActive: editIsActive,
        applicablePlans: editApplicablePlans,
      });
      setEditCoupon(null);
      setStatusToast("Coupon updated");
      setTimeout(() => setStatusToast(""), 3000);
      router.refresh();
    } catch {
      alert("Couldn't update coupon. Try again.");
    } finally {
      setEditSubmitting(false);
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
                    <td className="p-4">
                      <div className="font-mono font-bold text-foreground">{c.code}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Array.isArray(c.applicable_plans) && c.applicable_plans.length > 0 ? (
                          c.applicable_plans.map((p: string) => (
                            <span key={p} className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              {p === "pro_plus" ? "Pro Plus" : p === "pro" ? "Pro" : p}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            All Plans
                          </span>
                        )}
                      </div>
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
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Edit coupon"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
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
                      </div>
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

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Applicable packages
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_PACKAGES.map((pkg) => {
                    const isChecked = applicablePlans.includes(pkg.key) || applicablePlans.includes(pkg.label.toLowerCase());
                    return (
                      <button
                        key={pkg.key}
                        type="button"
                        onClick={() => {
                          setApplicablePlans((prev) => {
                            const has = prev.some(p => p.toLowerCase().replace(/[^a-z0-9_]/g, "_") === pkg.key);
                            if (has) {
                              const next = prev.filter(p => p.toLowerCase().replace(/[^a-z0-9_]/g, "_") !== pkg.key);
                              return next.length === 0 ? [pkg.key] : next;
                            } else {
                              return [...prev, pkg.key];
                            }
                          });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isChecked ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span>{pkg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Choose which packages can receive this discount.
                </p>
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

      {/* Edit Coupon Modal */}
      {editCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit coupon</h3>
                <p className="text-xs text-muted-foreground">Update coupon rules, expiry, and limits</p>
              </div>
              <button
                onClick={() => setEditCoupon(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Coupon code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-mono font-bold uppercase text-foreground outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Discount type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
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
                    value={editValue}
                    onChange={(e) => setEditValue(Number(e.target.value))}
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
                    value={editValidTo}
                    onChange={(e) => setEditValidTo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Limit (blank = unlimited)
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={editMaxRedemptions}
                    onChange={(e) => setEditMaxRedemptions(e.target.value)}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs sm:text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Applicable packages
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_PACKAGES.map((pkg) => {
                    const isChecked = editApplicablePlans.includes(pkg.key) || editApplicablePlans.includes(pkg.label.toLowerCase());
                    return (
                      <button
                        key={pkg.key}
                        type="button"
                        onClick={() => {
                          setEditApplicablePlans((prev) => {
                            const has = prev.some(p => p.toLowerCase().replace(/[^a-z0-9_]/g, "_") === pkg.key);
                            if (has) {
                              const next = prev.filter(p => p.toLowerCase().replace(/[^a-z0-9_]/g, "_") !== pkg.key);
                              return next.length === 0 ? [pkg.key] : next;
                            } else {
                              return [...prev, pkg.key];
                            }
                          });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-300"
                            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isChecked ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                        <span>{pkg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Choose which packages can receive this discount.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border">
                <label className="text-xs font-semibold text-foreground flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 cursor-pointer"
                  />
                  <span>Active & redeemable</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditCoupon(null)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold bg-brand-500 hover:bg-brand-400 text-brand-950 transition-colors shadow-xs cursor-pointer"
                >
                  {editSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
