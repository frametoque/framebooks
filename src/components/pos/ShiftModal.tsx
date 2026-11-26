"use client";

import React, { useState, useEffect } from "react";
import { DollarSign, X, AlertTriangle, CheckCircle2, Lock, Unlock, Clock } from "lucide-react";
import { getShiftSummaryAction, closeShiftAction, getOrCreateShiftAction } from "@/app/(dashboard)/pos/actions/sales";

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

  useEffect(() => {
    if (!isOpen) return;

    if (shift && shift.id) {
      loadSummary(shift.id);
    }
  }, [isOpen, shift]);

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
      const res = await getOrCreateShiftAction(openingAmount, notes);
      if (res.success && res.shift) {
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
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">
              {shift ? `Shift #${shift.shift_number || shift.id} Management` : "Open New Shift"}
            </h3>
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
          <form onSubmit={handleOpenShift} className="p-6 space-y-4">
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
                Count the initial cash float currently in the drawer.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Shift Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Morning shift, terminal #1"
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
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Unlock className="w-4 h-4" />
                <span>{loading ? "Opening..." : "Open Shift"}</span>
                <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
              </button>
            </div>
          </form>
        ) : (
          // Active Shift Dashboard & Close Shift
          <div className="p-6 space-y-6">
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
                    <span className="text-[11px] text-gray-400 uppercase font-semibold">Opening Cash</span>
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
                    className="px-4 py-2.5 rounded-xl border border-border text-gray-400 text-sm font-semibold hover:text-foreground"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("close")}
                    className="px-5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 font-bold rounded-xl text-sm transition-colors"
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
                    <span>{loading ? "Closing..." : "Confirm & Close Shift"}</span>
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
