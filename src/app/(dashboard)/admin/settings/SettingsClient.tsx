// src/app/(dashboard)/admin/settings/SettingsClient.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertTriangle, Search, X, Building2, ChevronDown } from "lucide-react";
import { savePlatformSettings, getTenantsForAllowlist } from "./actions";

type Tenant = { id: string; name: string; plan: string; ownerEmail: string };

export function SettingsClient({ initialSettings }: { initialSettings: Record<string, any> }) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Workspace allowlist state
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [allowlistSearch, setAllowlistSearch] = useState("");
  const [allowlistOpen, setAllowlistOpen] = useState(false);
  const allowlistRef = useRef<HTMLDivElement>(null);

  const allowedTenants: string[] = Array.isArray(settings.maintenance_allowed_tenants)
    ? settings.maintenance_allowed_tenants
    : [];

  // Load tenants when maintenance mode section is expanded
  useEffect(() => {
    if (settings.maintenance_mode && tenants.length === 0 && !tenantsLoading) {
      setTenantsLoading(true);
      getTenantsForAllowlist()
        .then(setTenants)
        .finally(() => setTenantsLoading(false));
    }
  }, [settings.maintenance_mode]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (allowlistRef.current && !allowlistRef.current.contains(e.target as Node)) {
        setAllowlistOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleAllowedTenant = (id: string) => {
    const next = allowedTenants.includes(id)
      ? allowedTenants.filter((t) => t !== id)
      : [...allowedTenants, id];
    setSettings({ ...settings, maintenance_allowed_tenants: next });
  };

  const removeAllowedTenant = (id: string) => {
    setSettings({
      ...settings,
      maintenance_allowed_tenants: allowedTenants.filter((t) => t !== id),
    });
  };

  const filteredTenants = tenants.filter(
    (t) =>
      !allowedTenants.includes(t.id) &&
      (t.name.toLowerCase().includes(allowlistSearch.toLowerCase()) ||
        t.ownerEmail.toLowerCase().includes(allowlistSearch.toLowerCase()))
  );

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

      {/* Billing */}
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

      {/* Access & Maintenance */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
        <h3 className="text-base font-bold text-foreground">Access</h3>

        <div className="space-y-4">
          {/* New Signups */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border">
            <div>
              <div className="text-sm font-semibold text-foreground">New signups</div>
              <p className="text-xs text-muted-foreground mt-0.5">Allow public registration</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.signups_enabled !== false}
              onClick={() => setSettings({ ...settings, signups_enabled: !settings.signups_enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                settings.signups_enabled !== false ? "bg-brand-500" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                  settings.signups_enabled !== false ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Maintenance Mode */}
          <div
            className={`rounded-2xl border transition-colors duration-300 ${
              settings.maintenance_mode
                ? "bg-amber-500/5 border-amber-500/30"
                : "bg-muted/40 border-border"
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                {settings.maintenance_mode && (
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Maintenance mode
                    {settings.maintenance_mode && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-full animate-pulse">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings.maintenance_mode
                      ? "All non-allowed workspaces see a maintenance notice"
                      : "Pause customer access for planned maintenance"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!settings.maintenance_mode}
                onClick={() => setSettings({ ...settings, maintenance_mode: !settings.maintenance_mode })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  settings.maintenance_mode ? "bg-amber-500" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                    settings.maintenance_mode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Expanded panel when maintenance is ON */}
            {settings.maintenance_mode && (
              <div className="px-4 pb-5 space-y-5 border-t border-amber-500/15 pt-4">
                {/* Message editor */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Maintenance notice message
                  </label>
                  <textarea
                    rows={2}
                    value={settings.maintenance_message || "We're performing scheduled maintenance. We'll be back shortly."}
                    onChange={(e) => setSettings({ ...settings, maintenance_message: e.target.value })}
                    placeholder="Message shown to users during maintenance..."
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* Allowed workspaces */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Allowed workspaces
                    <span className="ml-1.5 text-muted-foreground/60 font-normal">(bypass maintenance)</span>
                  </label>

                  {/* Selected chips */}
                  {allowedTenants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {allowedTenants.map((tid) => {
                        const t = tenants.find((x) => x.id === tid);
                        return (
                          <span
                            key={tid}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-xs font-medium text-amber-700 dark:text-amber-300"
                          >
                            <Building2 className="w-3 h-3 shrink-0" />
                            {t?.name || tid}
                            <button
                              type="button"
                              onClick={() => removeAllowedTenant(tid)}
                              className="ml-0.5 text-amber-500 hover:text-amber-700 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown picker */}
                  <div className="relative" ref={allowlistRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setAllowlistOpen((o) => !o);
                        if (tenants.length === 0 && !tenantsLoading) {
                          setTenantsLoading(true);
                          getTenantsForAllowlist()
                            .then(setTenants)
                            .finally(() => setTenantsLoading(false));
                        }
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-muted-foreground outline-none hover:border-amber-500 focus:border-amber-500 transition-colors"
                    >
                      <span>
                        {tenantsLoading
                          ? "Loading workspaces..."
                          : `Add workspaces to allowlist…`}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${allowlistOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {allowlistOpen && (
                      <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-border">
                          <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/40 rounded-xl">
                            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <input
                              autoFocus
                              type="text"
                              value={allowlistSearch}
                              onChange={(e) => setAllowlistSearch(e.target.value)}
                              placeholder="Search workspaces…"
                              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        <div className="max-h-56 overflow-y-auto py-1">
                          {tenantsLoading ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Loading…
                            </div>
                          ) : filteredTenants.length === 0 ? (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                              {allowlistSearch ? "No results" : "All workspaces already added"}
                            </div>
                          ) : (
                            filteredTenants.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  toggleAllowedTenant(t.id);
                                  setAllowlistSearch("");
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                              >
                                <div className="w-7 h-7 rounded-lg bg-brand-500/10 flex items-center justify-center shrink-0">
                                  <Building2 className="w-3.5 h-3.5 text-brand-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{t.ownerEmail}</p>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono shrink-0">
                                  {t.plan}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Workspaces in this list will see the normal dashboard while maintenance is active. Admins always bypass.
                  </p>
                </div>
              </div>
            )}
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
