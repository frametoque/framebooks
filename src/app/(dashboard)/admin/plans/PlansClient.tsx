// src/app/(dashboard)/admin/plans/PlansClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Check, 
  X, 
  Edit3, 
  Loader2, 
  CheckCircle2, 
  Crown,
  Layers,
  Building2,
  Plus,
  Trash2,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { formatLKR } from "@/components/Formatters";
import { updatePlan, createPlan, deletePlan, togglePlanActive } from "./actions";

export function PlansClient({ initialPlans }: { initialPlans: any[] }) {
  const router = useRouter();
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any | null>(null);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusToast, setStatusToast] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [newPlanData, setNewPlanData] = useState({
    name: "",
    key: "",
    description: "",
    priceMonthly: 0,
    priceYearly: 0,
    isPopular: false,
    isActive: true,
    limits: {
      invoices: 50,
      quotations: 50,
      incomes: 100,
      expenses: 100,
      clients: 50,
      accounts: 2,
      team_members: 0,
    },
    features: {
      inventory: false,
      advanced_reports: false,
      two_factor: false,
      audit_logs: false,
    },
  });

  const showToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(""), 3500);
  };

  const startEdit = (p: any) => {
    setEditingPlan(p);
    setEditFormData({
      id: p.id,
      name: p.name,
      description: p.description || "",
      priceMonthly: p.price_monthly,
      priceYearly: p.price_yearly,
      isPopular: !!p.is_popular,
      isActive: !!p.is_active,
      sortOrder: p.sort_order,
      limits: {
        invoices: p.limits?.invoices ?? 50,
        quotations: p.limits?.quotations ?? 50,
        incomes: p.limits?.incomes ?? 100,
        expenses: p.limits?.expenses ?? 100,
        clients: p.limits?.clients ?? 50,
        accounts: p.limits?.accounts ?? 2,
        team_members: p.limits?.team_members ?? 0,
      },
      features: {
        inventory: !!p.features?.inventory,
        advanced_reports: !!p.features?.advanced_reports,
        two_factor: !!p.features?.two_factor,
        audit_logs: !!p.features?.audit_logs,
      },
    });
    setApplyToExisting(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      await updatePlan({
        ...editFormData,
        applyToExisting,
      });
      setEditingPlan(null);
      setEditFormData(null);
      showToast("Plan updated successfully");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update plan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanData.name.trim()) {
      alert("Plan name is required");
      return;
    }
    setSubmitting(true);
    setErrorMessage("");
    try {
      await createPlan(newPlanData);
      setIsCreateOpen(false);
      setNewPlanData({
        name: "",
        key: "",
        description: "",
        priceMonthly: 0,
        priceYearly: 0,
        isPopular: false,
        isActive: true,
        limits: {
          invoices: 50,
          quotations: 50,
          incomes: 100,
          expenses: 100,
          clients: 50,
          accounts: 2,
          team_members: 0,
        },
        features: {
          inventory: false,
          advanced_reports: false,
          two_factor: false,
          audit_logs: false,
        },
      });
      showToast("New plan created successfully");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: any) => {
    if (!confirm(`Are you sure you want to delete the plan "${plan.name}"?`)) return;
    setSubmitting(true);
    try {
      await deletePlan(plan.id);
      if (editingPlan?.id === plan.id) {
        setEditingPlan(null);
        setEditFormData(null);
      }
      showToast(`Plan "${plan.name}" deleted`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete plan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p: any) => {
    try {
      await togglePlanActive(p.id, !p.is_active);
      showToast(!p.is_active ? `Activated ${p.name}` : `Deactivated ${p.name}`);
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  };

  const totalBusinesses = initialPlans.reduce((sum, p) => sum + (p.tenant_count || 0), 0);
  const activePlansCount = initialPlans.filter((p) => p.is_active).length;

  return (
    <div className="space-y-6">
      {statusToast && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{statusToast}</span>
        </div>
      )}

      {/* Header and Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-full bg-card border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-brand-500" />
            <span>{initialPlans.length} Plans</span>
            <span className="text-border">|</span>
            <span className="text-emerald-500 font-bold">{activePlansCount} Active</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-full bg-card border border-border text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-500" />
            <span>{totalBusinesses} Subscribed Businesses</span>
          </div>
        </div>

        <button
          onClick={() => {
            setErrorMessage("");
            setIsCreateOpen(true);
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 rounded-full font-bold text-xs sm:text-sm transition-all shadow-xs hover:shadow-md cursor-pointer ml-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add new plan</span>
        </button>
      </div>

      {/* Plans Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialPlans.map((p) => (
          <div
            key={p.id}
            className={`bg-card border rounded-3xl p-6 sm:p-7 shadow-xs flex flex-col justify-between relative transition-all ${
              p.is_popular
                ? "border-brand-500 ring-2 ring-brand-500/30"
                : "border-border hover:border-border/80"
            }`}
          >
            {p.is_popular && (
              <span className="absolute -top-3 right-6 px-3 py-0.5 bg-brand-500 text-brand-950 font-bold text-[10px] tracking-wider uppercase rounded-full shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Popular
              </span>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xl font-bold text-foreground">{p.name}</h3>
                  <span className="font-mono text-[10px] text-muted-foreground">key: {p.key}</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleToggleActive(p)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors ${
                    p.is_active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground border border-border hover:bg-muted/80"
                  }`}
                  title="Click to toggle active"
                >
                  {p.is_active ? "Active" : "Inactive"}
                </button>
              </div>

              {p.description && (
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[32px]">
                  {p.description}
                </p>
              )}

              <div className="mb-4">
                <span className="text-3xl font-extrabold text-foreground">
                  {p.price_monthly === 0 ? "Free" : formatLKR(p.price_monthly)}
                </span>
                {p.price_monthly > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">/month</span>
                )}
                {p.price_yearly > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                    {formatLKR(p.price_yearly)} /year (save ~20%)
                  </div>
                )}
              </div>

              {/* Resource Quotas */}
              <div className="space-y-2 py-4 border-y border-border/60 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoices</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.invoices === -1 ? "Unlimited" : p.limits?.invoices}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quotations</span>
                  <span className="font-semibold text-foreground">
                    {(p.key === 'pro' || p.key === 'pro_plus' || p.name === 'Pro' || p.name === 'Pro Plus' || p.limits?.quotations === -1) ? "Unlimited" : (p.limits?.quotations ?? 50)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Income entries</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.incomes === -1 ? "Unlimited" : p.limits?.incomes}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.expenses === -1 ? "Unlimited" : p.limits?.expenses}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Clients</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.clients === -1 ? "Unlimited" : p.limits?.clients}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accounts</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.accounts === -1 ? "Unlimited" : p.limits?.accounts}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team members</span>
                  <span className="font-semibold text-foreground">
                    {p.limits?.team_members === -1 ? "Unlimited" : (p.limits?.team_members > 0 ? p.limits?.team_members : "None")}
                  </span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-2 pt-4 text-xs">
                <div className="flex items-center gap-2">
                  {p.features?.inventory ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={p.features?.inventory ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Inventory management
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {p.features?.advanced_reports ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={p.features?.advanced_reports ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Advanced financial reports
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {p.features?.two_factor ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={p.features?.two_factor ? "text-foreground font-medium" : "text-muted-foreground"}>
                    Two-factor authentication (2FA)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {p.features?.audit_logs ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <X className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={p.features?.audit_logs ? "text-foreground font-medium" : "text-muted-foreground"}>
                    System audit logs
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 space-y-2">
              <div className="text-[11px] text-muted-foreground flex items-center justify-between px-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-brand-500" />
                  <span>{p.tenant_count || 0} businesses</span>
                </span>
                {p.active_sub_count > 0 && (
                  <span className="text-emerald-500 font-semibold">{p.active_sub_count} active subs</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors cursor-pointer shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit plan</span>
                </button>

                {p.tenant_count === 0 && (
                  <button
                    onClick={() => handleDelete(p)}
                    className="p-2.5 rounded-full border border-border bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete unused plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CREATE PLAN MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Create New Plan</h3>
                <p className="text-xs text-muted-foreground">Add a new subscription tier with custom limits & features</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Starter, Enterprise"
                    value={newPlanData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const slug = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                      setNewPlanData({ ...newPlanData, name, key: slug });
                    }}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Unique Key / Slug
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. starter"
                    value={newPlanData.key}
                    onChange={(e) => setNewPlanData({ ...newPlanData, key: e.target.value })}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-mono text-foreground outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Short summary of who this plan is for..."
                  value={newPlanData.description}
                  onChange={(e) => setNewPlanData({ ...newPlanData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Monthly price (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPlanData.priceMonthly}
                    onChange={(e) => setNewPlanData({ ...newPlanData, priceMonthly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Yearly price (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newPlanData.priceYearly}
                    onChange={(e) => setNewPlanData({ ...newPlanData, priceYearly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPlanData.isPopular}
                    onChange={(e) => setNewPlanData({ ...newPlanData, isPopular: e.target.checked })}
                    className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">Highlight as Popular</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newPlanData.isActive}
                    onChange={(e) => setNewPlanData({ ...newPlanData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">Active for signup</span>
                </label>
              </div>

              {/* Resource Limits */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Resource Limits
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">Use -1 for unlimited</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Invoices</label>
                    <input
                      type="number"
                      value={newPlanData.limits.invoices}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, invoices: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Quotations</label>
                    <input
                      type="number"
                      value={newPlanData.limits.quotations ?? 50}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, quotations: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Incomes</label>
                    <input
                      type="number"
                      value={newPlanData.limits.incomes}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, incomes: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Expenses</label>
                    <input
                      type="number"
                      value={newPlanData.limits.expenses}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, expenses: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Clients</label>
                    <input
                      type="number"
                      value={newPlanData.limits.clients}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, clients: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Bank Accounts</label>
                    <input
                      type="number"
                      value={newPlanData.limits.accounts}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, accounts: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Team Members</label>
                    <input
                      type="number"
                      value={newPlanData.limits.team_members}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        limits: { ...newPlanData.limits, team_members: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Features Configuration */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Included Features
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlanData.features.inventory}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        features: { ...newPlanData.features, inventory: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Inventory management</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlanData.features.advanced_reports}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        features: { ...newPlanData.features, advanced_reports: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Advanced reports</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlanData.features.two_factor}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        features: { ...newPlanData.features, two_factor: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Two-factor auth (2FA)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newPlanData.features.audit_logs}
                      onChange={(e) => setNewPlanData({
                        ...newPlanData,
                        features: { ...newPlanData.features, audit_logs: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Audit logs</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-1.5 px-6 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create plan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlan && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Edit {editingPlan.name}</h3>
                <span className="font-mono text-xs text-muted-foreground">key: {editingPlan.key}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="p-1.5 rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Monthly price (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editFormData.priceMonthly}
                    onChange={(e) => setEditFormData({ ...editFormData, priceMonthly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Yearly price (LKR)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editFormData.priceYearly}
                    onChange={(e) => setEditFormData({ ...editFormData, priceYearly: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-background border border-border rounded-xl text-sm font-bold text-foreground outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Status Toggles */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.isPopular}
                    onChange={(e) => setEditFormData({ ...editFormData, isPopular: e.target.checked })}
                    className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">Popular badge</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.isActive}
                    onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-foreground">Active for signup</span>
                </label>
              </div>

              {/* Resource Limits */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Limits (-1 for unlimited)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Invoices</label>
                    <input
                      type="number"
                      value={editFormData.limits.invoices}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, invoices: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Quotations</label>
                    <input
                      type="number"
                      value={editFormData.limits.quotations ?? 50}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, quotations: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Incomes</label>
                    <input
                      type="number"
                      value={editFormData.limits.incomes}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, incomes: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Expenses</label>
                    <input
                      type="number"
                      value={editFormData.limits.expenses}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, expenses: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Clients</label>
                    <input
                      type="number"
                      value={editFormData.limits.clients}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, clients: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Accounts</label>
                    <input
                      type="number"
                      value={editFormData.limits.accounts}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, accounts: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-0.5">Team</label>
                    <input
                      type="number"
                      value={editFormData.limits.team_members}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        limits: { ...editFormData.limits, team_members: Number(e.target.value) }
                      })}
                      className="w-full px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Features Configuration */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Features
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.features.inventory}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        features: { ...editFormData.features, inventory: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Inventory management</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.features.advanced_reports}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        features: { ...editFormData.features, advanced_reports: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Advanced reports</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.features.two_factor}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        features: { ...editFormData.features, two_factor: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Two-factor auth (2FA)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editFormData.features.audit_logs}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        features: { ...editFormData.features, audit_logs: e.target.checked }
                      })}
                      className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                    />
                    <span className="font-medium text-foreground">Audit logs</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/40 border border-border">
                <span className="text-xs font-semibold text-foreground">Apply to existing users</span>
                <input
                  type="checkbox"
                  checked={applyToExisting}
                  onChange={(e) => setApplyToExisting(e.target.checked)}
                  className="w-4 h-4 accent-brand-500 rounded cursor-pointer"
                />
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                {editingPlan.tenant_count === 0 ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(editingPlan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete plan</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    {editingPlan.tenant_count} active business(es)
                  </span>
                )}

                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingPlan(null)}
                    className="px-4 py-2 rounded-full text-xs font-semibold hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save plan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
