"use client";

import React, { useState, useEffect, useRef } from "react";
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
  RotateCcw,
  Edit2,
  Upload,
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
import {
  PosClientDisplaySlide,
  DEFAULT_CUSTOMER_DISPLAY_SLIDES,
} from "@/lib/pos/client-display";

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
  const [activeTab, setActiveTab] = useState<"general" | "counters" | "display">("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PosSettings>({
    allow_negative_stock: false,
    sku_prefix: "SKU",
    receipt_header: "",
    receipt_footer: "Thank you for your purchase!",
    default_tax_rate: 0,
    default_account_id: null,
    customer_display_slides: DEFAULT_CUSTOMER_DISPLAY_SLIDES,
  });
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Customer Display Ads State
  const [showSlideForm, setShowSlideForm] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slideDraft, setSlideDraft] = useState<Partial<PosClientDisplaySlide>>({
    badge: "PROMO",
    title: "",
    subtitle: "",
    callToAction: "",
    imageUrl: "",
    active: true,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageUpload = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1600;
        const maxH = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setSlideDraft((prev) => ({
            ...prev,
            imageUrl: dataUrl,
          }));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Counters management state
  const [counters, setCounters] = useState<PosCounter[]>([]);
  const [loadingCounters, setLoadingCounters] = useState(false);
  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterCode, setNewCounterCode] = useState("");
  const [addingCounter, setAddingCounter] = useState(false);
  const [counterActionId, setCounterActionId] = useState<number | null>(null);

  const callbacksRef = useRef({ onClose, onOpenCashDrawer, onPrintTestBill });
  useEffect(() => {
    callbacksRef.current = { onClose, onOpenCashDrawer, onPrintTestBill };
  });

  useEffect(() => {
    if (isOpen && canManageSettings) {
      loadSettings();
      loadCounters();
    }
  }, [isOpen, canManageSettings]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        callbacksRef.current.onClose?.();
        return;
      }

      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(
        (document.activeElement?.tagName || "").toUpperCase()
      );

      // F5 or (Space when no input focused): Open cash drawer
      if ((e.key === "F5" && !e.shiftKey) || (e.key === " " && !isInput)) {
        if (callbacksRef.current.onOpenCashDrawer) {
          e.preventDefault();
          callbacksRef.current.onOpenCashDrawer();
        }
        return;
      }

      // Shift+F5 or Alt+P: Print test bill
      if ((e.key === "F5" && e.shiftKey) || (e.altKey && e.key.toLowerCase() === "p")) {
        if (callbacksRef.current.onPrintTestBill) {
          e.preventDefault();
          callbacksRef.current.onPrintTestBill();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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

  const handleAddOrUpdateSlide = (e: React.FormEvent) => {
    e.preventDefault();
    const currentSlides = settings.customer_display_slides || [];
    const img = slideDraft.imageUrl?.trim() || null;
    const title = slideDraft.title?.trim() || (img ? `Ad Banner ${currentSlides.length + 1}` : "Ad Banner");

    let updated: PosClientDisplaySlide[];

    if (editingSlideId) {
      updated = currentSlides.map((s) =>
        s.id === editingSlideId
          ? {
              ...s,
              title,
              subtitle: slideDraft.subtitle?.trim() || "",
              badge: slideDraft.badge?.trim() || "AD",
              callToAction: slideDraft.callToAction?.trim() || "",
              imageUrl: img,
              active: slideDraft.active ?? true,
            }
          : s
      );
    } else {
      const newSlide: PosClientDisplaySlide = {
        id: `slide-${Date.now()}`,
        title,
        subtitle: slideDraft.subtitle?.trim() || "",
        badge: slideDraft.badge?.trim() || "AD",
        callToAction: slideDraft.callToAction?.trim() || "",
        imageUrl: img,
        active: slideDraft.active ?? true,
      };
      updated = [...currentSlides, newSlide];
    }

    setSettings({ ...settings, customer_display_slides: updated });
    setShowSlideForm(false);
    setEditingSlideId(null);
    setSlideDraft({ badge: "AD", title: "", subtitle: "", callToAction: "", imageUrl: "", active: true });
    setStatusMsg({ type: "success", text: "Ad slide saved. Click 'Save & Update Customer Screen' to apply." });
  };

  const handleToggleSlideActive = (id: string) => {
    const currentSlides = settings.customer_display_slides || DEFAULT_CUSTOMER_DISPLAY_SLIDES;
    const updated = currentSlides.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    setSettings({ ...settings, customer_display_slides: updated });
  };

  const handleDeleteSlide = (id: string) => {
    const currentSlides = settings.customer_display_slides || DEFAULT_CUSTOMER_DISPLAY_SLIDES;
    const updated = currentSlides.filter((s) => s.id !== id);
    setSettings({ ...settings, customer_display_slides: updated });
  };

  const handleEditSlide = (slide: PosClientDisplaySlide) => {
    setEditingSlideId(slide.id);
    setSlideDraft({
      badge: slide.badge || "PROMO",
      title: slide.title,
      subtitle: slide.subtitle || "",
      callToAction: slide.callToAction || "",
      imageUrl: slide.imageUrl || "",
      active: slide.active,
    });
    setShowSlideForm(true);
  };

  const handleResetDefaultSlides = () => {
    setSettings({ ...settings, customer_display_slides: DEFAULT_CUSTOMER_DISPLAY_SLIDES });
    setStatusMsg({ type: "success", text: "Reset to default customer promotion slides." });
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
          <button
            type="button"
            onClick={() => setActiveTab("display")}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "display"
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-400 hover:text-foreground"
            }`}
          >
            <span>Customer Display Ads</span>
            {(settings.customer_display_slides || DEFAULT_CUSTOMER_DISPLAY_SLIDES).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-brand-500/15 text-brand-500 font-mono font-bold">
                {(settings.customer_display_slides || DEFAULT_CUSTOMER_DISPLAY_SLIDES).filter((s) => s.active).length}
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
          {activeTab === "general" && (
            <form onSubmit={handleSave} className="p-6 space-y-5 text-xs">
              {/* Oversell rule toggle */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Allow Negative Stock (Overselling)</h4>
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
          )}

          {activeTab === "counters" && (
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
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground truncate">{c.name}</span>
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
                                    Shift {c.active_shift?.shift_number} Active ({c.active_shift?.user_name})
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

          {activeTab === "display" && (
            <div className="p-6 space-y-5 text-xs">
              {/* Header Banner */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border flex items-center justify-between gap-3">
                <h4 className="font-bold text-sm text-foreground">
                  Customer Screen Idle Ads & Promos
                </h4>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Ad Image</span>
                  </button>
                </div>
              </div>

              {/* Hidden File Input for Direct Ad Banner Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleImageUpload(file);
                    setEditingSlideId(null);
                    setShowSlideForm(true);
                  }
                  e.target.value = "";
                }}
              />

              {/* Slide Creator / Editor Form */}
              {showSlideForm && (
                <form
                  onSubmit={handleAddOrUpdateSlide}
                  className="p-5 rounded-2xl bg-card border-2 border-brand-500/30 space-y-4 shadow-lg animate-in fade-in"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-sm text-foreground">
                      {editingSlideId ? "Edit Customer Screen Ad" : "Upload Customer Screen Ad"}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowSlideForm(false)}
                      className="text-gray-400 hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Image Upload Dropzone / Button */}
                  <div>
                    {slideDraft.imageUrl ? (
                      <div className="relative rounded-2xl overflow-hidden border-2 border-brand-500/30 bg-black/20 group">
                        <img
                          src={slideDraft.imageUrl}
                          alt="Ad Preview"
                          className="w-full h-44 object-contain bg-black/40"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-500 text-brand-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Change Image</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSlideDraft({ ...slideDraft, imageUrl: "" })}
                            className="px-3.5 py-1.5 rounded-xl bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="py-6 px-4 border-2 border-dashed border-border hover:border-brand-500 rounded-2xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer text-center group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Click to upload ad banner image</p>
                          <p className="text-[10px] text-muted-foreground">Recommended 16:9 or 4:3 ratio for counter display</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Ad Title / Name <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={slideDraft.title || ""}
                        onChange={(e) => setSlideDraft({ ...slideDraft, title: e.target.value })}
                        placeholder="e.g. Summer Sale, New Arrivals"
                        className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-foreground font-semibold text-xs outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                        Or External Image URL <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
                      </label>
                      <input
                        type="url"
                        value={slideDraft.imageUrl || ""}
                        onChange={(e) => setSlideDraft({ ...slideDraft, imageUrl: e.target.value })}
                        placeholder="https://example.com/banner.jpg"
                        className="w-full px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-border text-foreground font-mono text-xs outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={slideDraft.active !== false}
                        onChange={(e) => setSlideDraft({ ...slideDraft, active: e.target.checked })}
                        className="rounded border-border text-brand-500 focus:ring-brand-500"
                      />
                      <span className="font-semibold text-xs text-foreground">Active in auto-slide rotation</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSlideForm(false)}
                        className="px-3 py-1.5 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold text-muted-foreground cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs cursor-pointer"
                      >
                        {editingSlideId ? "Update Ad" : "Save Ad Slide"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Slides List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-muted-foreground px-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider">
                    Configured Ad Slides ({(settings.customer_display_slides || []).length})
                  </span>
                </div>

                {(settings.customer_display_slides || []).length === 0 && (
                  <div className="p-8 border-2 border-dashed border-border rounded-2xl text-center space-y-2">
                    <p className="text-xs font-bold text-foreground">No customer display ads uploaded yet</p>
                    <p className="text-[11px] text-muted-foreground">Click "Upload Ad Image" above to add banners that automatically slide when the counter is idle.</p>
                  </div>
                )}

                {(settings.customer_display_slides || []).map((slide, idx) => (
                  <div
                    key={slide.id || idx}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      slide.active
                        ? "bg-black/5 dark:bg-white/5 border-border hover:border-brand-500/30"
                        : "bg-black/2 dark:bg-white/2 border-border/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {slide.imageUrl ? (
                        <div className="w-20 h-14 rounded-xl overflow-hidden border border-border shrink-0 bg-black/40 shadow-inner">
                          <img src={slide.imageUrl} alt={slide.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-500 font-bold text-xs shrink-0">
                          #{idx + 1}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-brand-500/15 text-brand-500 border border-brand-500/30 shrink-0">
                            {slide.imageUrl ? "AD BANNER" : "SLIDE"}
                          </span>
                          <h5 className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {slide.title}
                          </h5>
                          {!slide.active && (
                            <span className="text-[10px] text-muted-foreground font-semibold">
                              (Paused)
                            </span>
                          )}
                        </div>
                        {slide.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-md mt-0.5">
                            {slide.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSlideActive(slide.id)}
                        className={`p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          slide.active
                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-gray-500/10 text-gray-400 border-border hover:bg-black/10 dark:hover:bg-white/10"
                        }`}
                        title={slide.active ? "Pause slide" : "Activate slide"}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditSlide(slide)}
                        className="p-2 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-foreground cursor-pointer"
                        title="Edit Slide"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="p-2 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 cursor-pointer"
                        title="Delete Slide"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save All Settings Action */}
              <div className="pt-3 border-t border-border flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="py-2.5 px-5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? "Saving Changes..." : "Save & Update Customer Screen"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
