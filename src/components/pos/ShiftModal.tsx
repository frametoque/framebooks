"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, X, AlertTriangle, CheckCircle2, Lock, Unlock, Clock, Store, User } from "lucide-react";
import { getShiftSummaryAction, closeShiftAction, getOrCreateShiftAction } from "@/app/(dashboard)/pos/actions/sales";
import { getCountersAction, PosCounter } from "@/app/(dashboard)/pos/actions/counters";

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: any | null;
  onShiftUpdated: (newShift: any | null) => void;
}

export function ShiftModal({ isOpen, onClose, shift, onShiftUpdated }: ShiftModalProps) {
  const [loading, setLoading] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState<string>("0");
  const [closingCashInput, setClosingCashInput] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [summary, setSummary] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"status" | "close">("status");

  // Counters state for opening a shift
  const [counters, setCounters] = useState<PosCounter[]>([]);
  const [selectedCounterId, setSelectedCounterId] = useState<number | null>(null);
  const [loadingCounters, setLoadingCounters] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (shift && shift.id) {
      loadSummary(shift.id);
    } else {
      loadCounters();
    }
  }, [isOpen, shift]);

  const loadCounters = async () => {
    setLoadingCounters(true);
    try {
      const res = await getCountersAction();
      if (res.success && res.counters) {
        setCounters(res.counters);
        // Default to first active counter without an active shift, or the first active counter
        const available = res.counters.find((c) => c.is_active && !c.active_shift);
        if (available) {
          setSelectedCounterId(available.id);
        } else if (res.counters.length > 0) {
          const firstActive = res.counters.find((c) => c.is_active);
          setSelectedCounterId(firstActive ? firstActive.id : res.counters[0].id);
        }
      }
    } catch (e: any) {
      console.error("Failed to load counters for shift:", e);
    } finally {
      setLoadingCounters(false);
    }
  };

  const loadSummary = async (shiftId: number) => {
    setLoading(true);
    try {
      const res = await getShiftSummaryAction(shiftId);
      if (res.success && res.metrics) {
        setSummary(res.metrics);
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load shift summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const openingAmount = parseFloat(openingCashInput) || 0;
      const res = await getOrCreateShiftAction(openingAmount, notes, selectedCounterId || undefined);
      if (res.success && res.shift) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("framebooks_pos_active_shift", JSON.stringify(res.shift));
          } catch {}
          window.dispatchEvent(new CustomEvent("pos:shift-changed", { detail: res.shift }));
        }
        onShiftUpdated(res.shift);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to open shift.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to open shift.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift?.id) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const counted = parseFloat(closingCashInput) || 0;
      const res = await closeShiftAction(shift.id, counted, notes);
      if (res.success) {
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("framebooks_pos_active_shift", "closed");
          } catch {}
          window.dispatchEvent(new CustomEvent("pos:shift-changed", { detail: null }));
        }
        onShiftUpdated(null);
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to close shift.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to close shift.");
    } finally {
      setLoading(false);
    }
  };

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold text-xs">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {shift
                  ? `${shift.counter_name || "Counter 1"} • Shift #${shift.shift_number || shift.id}`
                  : "Open Shift on Counter"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {shift ? "Active Cash Drawer Session" : "Select a cashier counter and count drawer float"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Shift Body */}
        {!shift ? (
          // Open Shift Form
          <form onSubmit={handleOpenShift} className="p-6 space-y-4 overflow-y-auto">
            {/* Counter Selection */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Select Cashier Counter
              </label>

              {loadingCounters ? (
                <div className="text-xs text-muted-foreground py-2">Loading available counters...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {counters
                    .filter((c) => c.is_active)
                    .map((c) => {
                      const isSelected = selectedCounterId === c.id;
                      const hasShift = Boolean(c.active_shift);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedCounterId(c.id)}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                            isSelected
                              ? "bg-brand-500/10 border-brand-500 ring-2 ring-brand-500/20"
                              : "bg-black/5 dark:bg-white/5 border-border hover:border-gray-500"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-xs text-foreground truncate">{c.name}</span>
                            {c.code && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-muted-foreground">
                                {c.code}
                              </span>
                            )}
                          </div>
                          {hasShift ? (
                            <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Shift #{c.active_shift?.shift_number} in progress ({c.active_shift?.user_name})
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Available for new shift
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Opening Float Cash (LKR)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  LKR
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  autoFocus
                  required
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-16 pr-4 py-3 font-bold text-lg text-foreground outline-none focus:border-brand-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Count the initial cash float currently placed in the drawer.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Shift Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning shift, register opening verification"
                rows={2}
                className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-500 transition-colors"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-border text-gray-400 text-sm font-semibold hover:text-foreground flex items-center gap-1.5 cursor-pointer"
              >
                <span>Cancel</span>
                <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
              </button>
              <button
                type="submit"
                disabled={loading || !selectedCounterId}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>{loading ? "Opening Shift..." : "Open Shift"}</span>
                <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
              </button>
            </div>
          </form>
        ) : (
          // Active Shift Dashboard & Close Shift
          <div className="p-6 space-y-5 overflow-y-auto">
            {/* Shift info strip */}
            <div className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-border flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-brand-500" />
                <span className="font-bold text-foreground">{shift.counter_name || "Counter 1"}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-emerald-500 font-semibold">Shift #{shift.shift_number || shift.id} Active</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{shift.user_name || "Cashier"}</span>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setActiveTab("status")}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "status"
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-400 hover:text-foreground"
                }`}
              >
                Shift Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("close")}
                className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === "close"
                    ? "border-brand-500 text-brand-500"
                    : "border-transparent text-gray-400 hover:text-foreground"
                }`}
              >
                Reconcile & Close Shift
              </button>
            </div>

            {activeTab === "status" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold">Opening Float</span>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      LKR {formatLKR(summary?.openingCash ?? shift.opening_cash)}
                    </p>
                  </div>
                  <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold">Orders Completed</span>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      {summary?.totalOrders ?? 0}
                    </p>
                  </div>
                  <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold">Cash Sales</span>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      LKR {formatLKR(summary?.cashSales ?? 0)}
                    </p>
                  </div>
                  <div className="p-3.5 bg-black/5 dark:bg-white/5 border border-border rounded-2xl">
                    <span className="text-[11px] text-gray-400 uppercase font-semibold">Card & Transfer Sales</span>
                    <p className="text-base font-bold text-foreground mt-0.5">
                      LKR {formatLKR((summary?.cardSales ?? 0) + (summary?.transferSales ?? 0))}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-brand-700 dark:text-brand-300">Expected Drawer Cash</span>
                    <p className="text-[11px] text-gray-400">Opening Float + Cash Sales</p>
                  </div>
                  <div className="text-lg font-black text-brand-500">
                    LKR {formatLKR(summary?.expectedCash ?? 0)}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl border border-border text-gray-400 text-sm font-semibold hover:text-foreground cursor-pointer"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("close")}
                    className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 font-bold rounded-xl text-sm transition-colors cursor-pointer"
                  >
                    Close Shift
                  </button>
                </div>
              </div>
            ) : (
              // Reconcile and Close Tab
              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Counted Cash in Drawer (LKR)
                    </label>
                    <span className="text-xs text-gray-400 font-semibold">
                      Expected: LKR {formatLKR(summary?.expectedCash ?? 0)}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                      LKR
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      autoFocus
                      value={closingCashInput}
                      onChange={(e) => setClosingCashInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl pl-16 pr-4 py-3 font-bold text-lg text-foreground outline-none focus:border-brand-500 transition-colors"
                    />
                  </div>
                </div>

                {closingCashInput && (
                  <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      (parseFloat(closingCashInput) || 0) - (summary?.expectedCash ?? 0) === 0
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        : (parseFloat(closingCashInput) || 0) - (summary?.expectedCash ?? 0) > 0
                        ? "bg-brand-500/10 border-brand-500/20 text-brand-500"
                        : "bg-red-500/10 border-red-500/20 text-red-500"
                    }`}
                  >
                    <span>Cash Variance (Over/Short):</span>
                    <span className="font-bold text-sm">
                      LKR {formatLKR((parseFloat(closingCashInput) || 0) - (summary?.expectedCash ?? 0))}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Closing Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for variance or handover notes..."
                    rows={2}
                    className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground outline-none focus:border-brand-500 transition-colors"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("status")}
                    className="px-4 py-2.5 rounded-xl border border-border text-gray-400 text-sm font-semibold hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Back</span>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !closingCashInput}
                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>{loading ? "Closing..." : `Confirm & Close Shift on ${shift.counter_name || "Counter"}`}</span>
                    <kbd className="text-[10px] bg-red-950/40 text-white px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
