// src/app/(dashboard)/admin/settings/SettingsClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { savePlatformSettings } from "./actions";

export function SettingsClient({ initialSettings }: { initialSettings: Record<string, any> }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSavedSuccess(false);
    setErrorMsg("");
    try {
      await savePlatformSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      router.refresh();
    } catch {
      setErrorMsg("Couldn't save. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Settings saved</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-sm font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Subscription & Billing Defaults */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-foreground">Billing</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Grace period (days)
            </label>
            <input
              type="number"
              min={0}
              value={settings.grace_period_days || 7}
              onChange={(e) => setSettings({ ...settings, grace_period_days: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Default currency
            </label>
            <input
              type="text"
              value={settings.default_currency || "LKR"}
              onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm font-medium text-foreground outline-none font-mono focus:border-brand-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Support email
          </label>
          <input
            type="email"
            value={settings.support_email || "support@frametoque.com"}
            onChange={(e) => setSettings({ ...settings, support_email: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* System Safeguards & Access */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-foreground">Access</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
            <div>
              <div className="text-sm font-semibold text-foreground">Maintenance mode</div>
              <p className="text-xs text-muted-foreground mt-0.5">Pause customer access for planned maintenance</p>
            </div>
            <input
              type="checkbox"
              checked={!!settings.maintenance_mode}
              onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
              className="w-5 h-5 accent-brand-500 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
            <div>
              <div className="text-sm font-semibold text-foreground">New signups</div>
              <p className="text-xs text-muted-foreground mt-0.5">Allow public registration</p>
            </div>
            <input
              type="checkbox"
              checked={settings.signups_enabled !== false}
              onChange={(e) => setSettings({ ...settings, signups_enabled: e.target.checked })}
              className="w-5 h-5 accent-brand-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-sm transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{submitting ? "Saving..." : "Save settings"}</span>
        </button>
      </div>
    </form>
  );
}
