"use client";

import React, { useState, useEffect } from "react";
import { Settings, X, Save, AlertTriangle, ShieldCheck } from "lucide-react";
import { loadPosSettingsAction, savePosSettingsAction } from "@/app/(dashboard)/pos/actions/stock";
import { PosSettings } from "@/lib/pos/stock-service";

interface PosSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: () => void;
  canManageSettings?: boolean;
}

export function PosSettingsModal({ isOpen, onClose, onSettingsSaved, canManageSettings = true }: PosSettingsModalProps) {
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

  useEffect(() => {
    if (isOpen && canManageSettings) {
      loadSettings();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, canManageSettings, onClose]);

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

  if (!isOpen || canManageSettings === false) return null;

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div>
            <h2 className="text-base font-bold text-foreground">POS Terminal & Stock Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {statusMsg && (
          <div
            className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
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
          <div className="pt-2 border-t border-border">
            <span className="text-[11px] font-bold text-brand-500 uppercase tracking-wider block mb-1">
              Receipt Customization
            </span>
          </div>

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
      </div>
    </div>
  );
}
