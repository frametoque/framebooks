"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  AlertTriangle,
  ShieldCheck,
  Vault,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Power,
  RotateCw,
} from "lucide-react";
import { loadPosSettingsAction, savePosSettingsAction } from "@/app/(dashboard)/pos/actions/stock";
import {
  getCountersAction,
  createCounterAction,
  updateCounterAction,
  deleteCounterAction,
  PosCounter,
} from "@/app/(dashboard)/pos/actions/counters";
import { PosSettings } from "@/lib/pos/stock-service";

interface PosSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
  canManageSettings?: boolean;
  onOpenCashDrawer?: () => void;
  onPrintTestBill?: () => void;
}

export function PosSettingsModal({
  isOpen,
  onClose,
  onSettingsSaved,
  canManageSettings = true,
  onOpenCashDrawer,
  onPrintTestBill,
}: PosSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "counters">("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PosSettings>({
    allow_negative_stock: false,
    sku_prefix: "SKU",
    receipt_header: "",
    receipt_footer: "Thank you for your purchase!",
    default_tax_rate: 0,
    default_account_id: null,
  });
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Counters management state
  const [counters, setCounters] = useState<PosCounter[]>([]);
  const [loadingCounters, setLoadingCounters] = useState(false);
  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterCode, setNewCounterCode] = useState("");
  const [addingCounter, setAddingCounter] = useState(false);
  const [counterActionId, setCounterActionId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && canManageSettings) {
      loadSettings();
      loadCounters();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
        return;
      }

      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (document.activeElement?.tagName || "").toUpperCase()
      );

      // F5 or (Space when no input focused): Open cash drawer
      if ((e.key === "F5" && !e.shiftKey) || (e.key === " " && !isInput)) {
        if (onOpenCashDrawer) {
          e.preventDefault();
          onOpenCashDrawer();
        }
        return;
      }

      // Shift+F5 or Alt+P: Print test bill
      if ((e.key === "F5" && e.shiftKey) || (e.altKey && e.key.toLowerCase() === "p")) {
        if (onPrintTestBill) {
          e.preventDefault();
          onPrintTestBill();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canManageSettings, onClose, onOpenCashDrawer, onPrintTestBill]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await loadPosSettingsAction();
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  };

  const loadCounters = async () => {
    setLoadingCounters(true);
    try {
      const res = await getCountersAction();
      if (res.success && res.counters) {
        setCounters(res.counters);
      }
    } catch (e: any) {
      console.error("Failed to load counters:", e);
    } finally {
      setLoadingCounters(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await savePosSettingsAction(settings);
      if (res.success) {
        setStatusMsg({ type: 'success', text: "POS settings saved successfully." });
        if (onSettingsSaved) onSettingsSaved();
        setTimeout(onClose, 800);
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to save POS settings." });
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message || "Failed to save POS settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCounterName.trim()) return;

    setAddingCounter(true);
    setStatusMsg(null);

    try {
      const res = await createCounterAction({
        name: newCounterName.trim(),
        code: newCounterCode.trim() || undefined,
      });

      if (res.success) {
        setStatusMsg({ type: 'success', text: `Counter "${newCounterName}" created.` });
        setNewCounterName("");
        setNewCounterCode("");
        await loadCounters();
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to create counter." });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Failed to create counter." });
    } finally {
      setAddingCounter(false);
    }
  };

  const handleToggleActiveCounter = async (counter: PosCounter) => {
    setCounterActionId(counter.id);
    setStatusMsg(null);

    try {
      const res = await updateCounterAction(counter.id, {
        is_active: !counter.is_active,
      });

      if (res.success) {
        await loadCounters();
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to update counter." });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Failed to update counter." });
    } finally {
      setCounterActionId(null);
    }
  };

  const handleDeleteCounter = async (counterId: number, counterName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${counterName}"?`)) return;

    setCounterActionId(counterId);
    setStatusMsg(null);

    try {
      const res = await deleteCounterAction(counterId);
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Counter "${counterName}" deleted.` });
        await loadCounters();
      } else {
        setStatusMsg({ type: 'error', text: res.error || "Failed to delete counter." });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || "Failed to delete counter." });
    } finally {
      setCounterActionId(null);
    }
  };

  if (!isOpen || canManageSettings === false) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">POS Terminal Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-border px-6 bg-black/5 dark:bg-white/5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "general"
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-400 hover:text-foreground"
            }`}
          >
            <span>General & Receipt</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("counters")}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "counters"
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-400 hover:text-foreground"
            }`}
          >
            <span>Cashier Counters</span>
            {counters.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 text-muted-foreground font-mono">
                {counters.length}
              </span>
            )}
          </button>
        </div>

        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b shrink-0 ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                : "bg-red-500/10 border-red-500/20 text-red-500"
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content */}
        <div className="overflow-y-auto flex-1">
          {activeTab === "general" ? (
            <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
              {/* Oversell rule toggle */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Allow Negative Stock (Overselling)</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Let checkout proceed even when product inventory reaches zero.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={settings.allow_negative_stock}
                    onChange={(e) => setSettings({ ...settings, allow_negative_stock: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500" />
                </label>
              </div>

              {/* SKU format prefix */}
              <div>
                <label className="block text-gray-400 font-semibold mb-1">SKU Auto-Generation Prefix</label>
                <input
                  type="text"
                  value={settings.sku_prefix}
                  onChange={(e) => setSettings({ ...settings, sku_prefix: e.target.value.toUpperCase() })}
                  placeholder="e.g. SKU, ITEM, PRD"
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 font-bold text-foreground outline-none focus:border-brand-500"
                />
              </div>

              {/* Default tax rate */}
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Default Tax Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={settings.default_tax_rate}
                  onChange={(e) => setSettings({ ...settings, default_tax_rate: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                />
              </div>

              {/* Thermal Receipt Configuration */}
              <div className="border-t border-border pt-1" />

              {/* Receipt Header Text */}
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Receipt Header Text</label>
                <input
                  type="text"
                  value={settings.receipt_header}
                  onChange={(e) => setSettings({ ...settings, receipt_header: e.target.value })}
                  placeholder="e.g. 123 Galle Road, Colombo 03 • Tel: 011-2345678"
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                />
              </div>

              {/* Receipt Footer Message */}
              <div>
                <label className="block text-gray-400 font-semibold mb-1">Receipt Footer Note</label>
                <input
                  type="text"
                  value={settings.receipt_footer}
                  onChange={(e) => setSettings({ ...settings, receipt_footer: e.target.value })}
                  placeholder="e.g. Thank you for your purchase! Goods sold are non-refundable."
                  className="w-full bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-foreground outline-none focus:border-brand-500"
                />
              </div>

              {/* Hardware & Counter Tools */}
              <div className="pt-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={onOpenCashDrawer}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
                    title="Open Cash Drawer (Space)"
                  >
                    <div className="flex items-center gap-2">
                      <Vault className="w-4 h-4 text-brand-500 shrink-0" />
                      <span>Drawer</span>
                    </div>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-sans font-semibold">Space</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={onPrintTestBill}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-border text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
                    title="Print Test Bill for Calibration (Enter / Shift+F5)"
                  >
                    <div className="flex items-center gap-2">
                      <Printer className="w-4 h-4 text-brand-500 shrink-0" />
                      <span>Test Bill</span>
                    </div>
                    <kbd className="text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded font-sans font-semibold">Enter</kbd>
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-3 flex justify-end gap-2 border-t border-border">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border rounded-xl font-semibold text-gray-400 hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Cancel</span>
                  <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving..." : "Save Settings"}</span>
                  <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                </button>
              </div>
            </form>
          ) : (
            /* Cashier Counters Management Tab */
            <div className="p-6 space-y-6">
              {/* Add New Counter Form */}
              <form onSubmit={handleAddCounter} className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border space-y-3">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-brand-500" />
                  <span>Add New Cashier Counter</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-gray-400 font-semibold mb-1">Counter Name *</label>
                    <input
                      type="text"
                      required
                      value={newCounterName}
                      onChange={(e) => setNewCounterName(e.target.value)}
                      placeholder="e.g. Counter 2, Front Desk Register"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-brand-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 font-semibold mb-1">Code / Station ID</label>
                    <input
                      type="text"
                      value={newCounterCode}
                      onChange={(e) => setNewCounterCode(e.target.value.toUpperCase())}
                      placeholder="e.g. C2, EXP"
                      className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none focus:border-brand-500 font-bold uppercase"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={addingCounter || !newCounterName.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs shadow-xs cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{addingCounter ? "Adding..." : "Add Counter"}</span>
                  </button>
                </div>
              </form>

              {/* List of Existing Counters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Configured Counters ({counters.length})
                  </h5>
                  <button
                    type="button"
                    onClick={loadCounters}
                    disabled={loadingCounters}
                    className="text-[11px] text-gray-400 hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <RotateCw className={`w-3 h-3 ${loadingCounters ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingCounters && counters.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">Loading counters...</div>
                ) : counters.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-2xl">
                    No counters configured. Add your first counter above.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {counters.map((c) => {
                      const hasActiveShift = Boolean(c.active_shift);
                      return (
                        <div
                          key={c.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            c.is_active
                              ? "bg-black/5 dark:bg-white/5 border-border"
                              : "bg-black/2 dark:bg-white/2 border-border/50 opacity-60"
                          }`}
                        >
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                hasActiveShift
                                  ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                                  : c.is_active
                                  ? "bg-brand-500/15 text-brand-500 border border-brand-500/30"
                                  : "bg-gray-500/10 text-gray-400 border border-border"
                              }`}
                            >
                              {c.code || c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground truncate">{c.name}</span>
                                {c.code && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-black/10 dark:bg-white/10 text-muted-foreground">
                                    {c.code}
                                  </span>
                                )}
                                {!c.is_active && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    Disabled
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                {hasActiveShift ? (
                                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Shift #{c.active_shift?.shift_number} Active ({c.active_shift?.user_name})
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    No active shift
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleActiveCounter(c)}
                              disabled={counterActionId === c.id || hasActiveShift}
                              title={
                                hasActiveShift
                                  ? "Cannot disable while shift is active"
                                  : c.is_active
                                  ? "Disable Counter"
                                  : "Enable Counter"
                              }
                              className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                c.is_active
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                                  : "bg-gray-500/10 text-gray-400 border-border hover:bg-black/10 dark:hover:bg-white/10"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCounter(c.id, c.name)}
                              disabled={counterActionId === c.id || hasActiveShift || counters.length <= 1}
                              title={
                                hasActiveShift
                                  ? "Cannot delete while shift is active"
                                  : counters.length <= 1
                                  ? "Cannot delete the only counter"
                                  : "Delete Counter"
                              }
                              className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
