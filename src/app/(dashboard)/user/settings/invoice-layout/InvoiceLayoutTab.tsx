// src/app/(dashboard)/user/settings/invoice-layout/InvoiceLayoutTab.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Check, Star, Trash2, Edit3, Eye, FileText, Settings2, AlertCircle, Copy, Sparkles, X, Lock, Search } from "lucide-react";
import { InvoiceLayoutRecord, CustomFieldDefinition, LayoutDocumentType } from "@/lib/invoice-layout/types";
import { getInvoiceLayouts, setDefaultInvoiceLayout, deleteInvoiceLayout, getCustomFields, saveCustomField, deleteCustomField, updateLayoutDocumentType } from "../../actions/invoice-layouts";
import { STARTER_TEMPLATES, STANDARD_LAYOUT_DEFINITION } from "@/lib/invoice-layout/templates";
import { STANDARD_INVOICE_FIELDS, StandardInvoiceField } from "@/lib/invoice-layout/standard-fields";
import { InvoiceRenderer } from "@/lib/invoice-layout/renderer";
import { SAMPLE_INVOICE_DATA, SAMPLE_TENANT_INFO } from "@/lib/invoice-layout/sample-data";
import { Loader } from "@/components/ui/Loader";

export default function InvoiceLayoutTab({ canManage = true, isProPlus = false }: { canManage?: boolean; isProPlus?: boolean }) {
  const [activeSubTab, setActiveSubTab] = useState<"layouts" | "custom_fields">("layouts");
  const [layouts, setLayouts] = useState<InvoiceLayoutRecord[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLayout, setPreviewLayout] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [fieldFilter, setFieldFilter] = useState<"all" | "standard" | "custom">("all");
  const [fieldSearch, setFieldSearch] = useState("");

  const handleUpgradePrompt = (featureName = "custom invoice layouts") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("upgrade-modal:open", {
          detail: `Custom invoice layouts, templates, and custom fields are exclusive to Pro Plus. Upgrade to Pro Plus to create, edit, and apply ${featureName}.`,
        })
      );
    }
  };

  // Custom field modal state
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fieldForm, setFieldForm] = useState<{
    id?: string;
    key: string;
    label: string;
    type: "text" | "number" | "date" | "dropdown" | "boolean";
    optionsText: string;
    defaultValue: string;
    isRequired: boolean;
  }>({
    key: "",
    label: "",
    type: "text",
    optionsText: "",
    defaultValue: "",
    isRequired: false,
  });
  const [savingField, setSavingField] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [lData, fData] = await Promise.all([getInvoiceLayouts(), getCustomFields()]);
      setLayouts(lData || []);
      setCustomFields(fData || []);
    } catch (err: any) {
      setActionError(err.message || "Failed to load layouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetDefault = async (id: string | null) => {
    if (!canManage) return;
    if (!isProPlus) {
      handleUpgradePrompt("custom layouts as default");
      return;
    }
    try {
      const res = await setDefaultInvoiceLayout(id);
      if (res.success) {
        setActionSuccess("Default layout updated.");
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
      } else {
        setActionError(res.error || "Failed to set default.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    if (!isProPlus) {
      handleUpgradePrompt("custom layouts");
      return;
    }
    if (!confirm("Are you sure you want to delete this custom layout?")) return;
    try {
      const res = await deleteInvoiceLayout(id);
      if (res.success) {
        setActionSuccess("Layout deleted.");
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
      } else {
        setActionError(res.error || "Failed to delete layout.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    }
  };

  const handleUpdateDocumentType = async (id: string, newType: LayoutDocumentType) => {
    if (!canManage) return;
    if (!isProPlus) {
      handleUpgradePrompt("custom layouts");
      return;
    }
    try {
      const res = await updateLayoutDocumentType(id, newType);
      if (res.success) {
        setLayouts((prev) =>
          prev.map((l) => (l.id === id ? { ...l, document_type: newType } : l))
        );
        setActionSuccess("Format scope updated.");
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(res.error || "Failed to update format scope.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    }
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldForm.label.trim()) return;
    if (!isProPlus) {
      handleUpgradePrompt("custom invoice fields");
      return;
    }

    setSavingField(true);
    setActionError(null);
    try {
      const options =
        fieldForm.type === "dropdown"
          ? fieldForm.optionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
          : [];

      const res = await saveCustomField({
        id: fieldForm.id,
        key: fieldForm.key || fieldForm.label.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        label: fieldForm.label,
        type: fieldForm.type,
        options,
        defaultValue: fieldForm.defaultValue,
        isRequired: fieldForm.isRequired,
      });

      if (res.success) {
        setIsFieldModalOpen(false);
        setActionSuccess("Custom field saved.");
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
      } else {
        setActionError(res.error || "Failed to save field.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setSavingField(false);
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!isProPlus) {
      handleUpgradePrompt("custom invoice fields");
      return;
    }
    if (!confirm("Are you sure you want to delete this custom field?")) return;
    try {
      const res = await deleteCustomField(id);
      if (res.success) {
        setActionSuccess("Custom field deleted.");
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
      } else {
        setActionError(res.error || "Failed to delete field.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {actionSuccess && (
        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm font-medium flex items-center gap-2">
          <Check className="w-4 h-4" /> {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {actionError}
        </div>
      )}

      {/* Sub-tabs header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("layouts")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubTab === "layouts"
                ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
              }`}
          >
            Invoice Layouts ({layouts.length + 1})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("custom_fields")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeSubTab === "custom_fields"
                ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
              }`}
          >
            Invoice Fields ({STANDARD_INVOICE_FIELDS.length + customFields.length})
          </button>
        </div>

        {canManage && activeSubTab === "layouts" && (
          !isProPlus ? (
            <button
              type="button"
              onClick={() => handleUpgradePrompt("custom layouts")}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Lock className="w-4 h-4" />
              <span>Upgrade to Pro Plus to Create</span>
            </button>
          ) : (
            <Link
              href="/user/settings/invoice-layout/builder/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Layout</span>
            </Link>
          )
        )}

        {canManage && activeSubTab === "custom_fields" && (
          !isProPlus ? (
            <button
              type="button"
              onClick={() => handleUpgradePrompt("custom invoice fields")}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Lock className="w-4 h-4" />
              <span>Upgrade to Pro Plus to Add Field</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFieldForm({
                  key: "",
                  label: "",
                  type: "text",
                  optionsText: "",
                  defaultValue: "",
                  isRequired: false,
                });
                setIsFieldModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Field</span>
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader size="lg" />
        </div>
      ) : activeSubTab === "layouts" ? (
        /* Layouts Grid */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Default Standard Layout */}
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-brand-500/30 group">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>

                    {/* Active Layout Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${layouts.every((l) => !l.is_default) ? "text-brand-500" : "text-muted-foreground"}`}>
                        {layouts.every((l) => !l.is_default) ? "Active Default" : "Set Default"}
                      </span>
                      <button
                        type="button"
                        disabled={!canManage || layouts.every((l) => !l.is_default)}
                        onClick={() => handleSetDefault(null)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${layouts.every((l) => !l.is_default) ? "bg-brand-500" : "bg-muted hover:bg-muted-foreground/30"
                          }`}
                        title={layouts.every((l) => !l.is_default) ? "Currently active default" : "Activate Standard Classic"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${layouts.every((l) => !l.is_default) ? "translate-x-4" : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                      Invoice & Quotation
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-foreground mb-1">Standard Classic</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Default layout.
                  </p>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewLayout(STANDARD_LAYOUT_DEFINITION)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold py-1.5 px-2.5 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  {canManage && (
                    !isProPlus ? (
                      <button
                        type="button"
                        onClick={() => handleUpgradePrompt("custom layouts")}
                        className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-400 font-semibold py-1.5 px-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/20 transition-colors cursor-pointer"
                        title="Upgrade to Pro Plus to customize"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Customize (Pro Plus)</span>
                      </button>
                    ) : (
                      <Link
                        href="/user/settings/invoice-layout/builder/new"
                        className="flex items-center gap-1.5 text-xs text-brand-500 hover:text-brand-400 font-semibold py-1.5 px-3 rounded-lg bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/20 transition-colors cursor-pointer"
                        title="Customize into a new custom layout"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Customize</span>
                      </Link>
                    )
                  )}
                </div>
              </div>

            {/* Custom Layouts */}
            {layouts.map((l) => (
              <div
                key={l.id}
                className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-brand-500/30 group relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-500 shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>

                    {/* Active Default Layout Toggle */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-semibold ${l.is_default ? "text-brand-500" : "text-muted-foreground"}`}>
                        {l.is_default ? "Active Default" : "Set Default"}
                      </span>
                      <button
                        type="button"
                        disabled={!canManage || l.is_default}
                        onClick={() => handleSetDefault(l.id)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed ${l.is_default ? "bg-brand-500" : "bg-muted hover:bg-muted-foreground/30"
                          }`}
                        title={l.is_default ? "Currently active default" : "Activate this layout as default"}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${l.is_default ? "translate-x-4" : "translate-x-0"
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Format Scope Badge & Quick Switcher */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20 capitalize">
                      {(l.document_type || "both") === "both"
                        ? "Both (Invoice & Quotation)"
                        : (l.document_type || "both") === "invoice"
                        ? "Invoice Only"
                        : "Quotation Only"}
                    </span>

                    {canManage && isProPlus && (
                      <select
                        value={l.document_type || "both"}
                        onChange={(e) => handleUpdateDocumentType(l.id, e.target.value as any)}
                        className="text-[10px] font-medium bg-muted/40 hover:bg-muted/70 text-foreground border border-border rounded-lg px-2 py-0.5 cursor-pointer outline-none focus:border-brand-500 transition-colors"
                        title="Change document format applicability"
                      >
                        <option value="both">Both</option>
                        <option value="invoice">Invoice Only</option>
                        <option value="quotation">Quotation Only</option>
                      </select>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-foreground mb-1 truncate">{l.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Custom {l.page_size} template (v{l.version}). Used on {l.usage_count || 0} document{l.usage_count === 1 ? "" : "s"}.
                  </p>
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewLayout(l.definition)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Preview Layout"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDelete(l.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Layout"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {canManage && (
                    !isProPlus ? (
                      <button
                        type="button"
                        onClick={() => handleUpgradePrompt("custom layouts")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 border border-brand-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        title="Upgrade to Pro Plus to edit"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Edit (Pro Plus)</span>
                      </button>
                    ) : (
                      <Link
                        href={`/user/settings/invoice-layout/builder/${l.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 border border-brand-500/25 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                        title="Edit this format in the Builder Studio"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Format</span>
                      </Link>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Fields Tab: Shows Both Existing Standard Fields & User Custom Fields */
        <div className="space-y-4">
          {/* Controls Bar: Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFieldFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${fieldFilter === "all"
                    ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                All Fields ({STANDARD_INVOICE_FIELDS.length + customFields.length})
              </button>
              <button
                type="button"
                onClick={() => setFieldFilter("standard")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${fieldFilter === "standard"
                    ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Standard ({STANDARD_INVOICE_FIELDS.length})
              </button>
              <button
                type="button"
                onClick={() => setFieldFilter("custom")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${fieldFilter === "custom"
                    ? "bg-brand-500 text-brand-900 font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                Custom ({customFields.length})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                placeholder="Search fields by label or key..."
                className="w-full bg-background border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand-500 outline-none"
              />
              {fieldSearch && (
                <button
                  type="button"
                  onClick={() => setFieldSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Fields Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/40 font-semibold">
                  <th className="py-3 px-4">Field Label</th>
                  <th className="py-3 px-4">Key / Slug</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Required</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* 1. Custom Fields */}
                {(fieldFilter === "all" || fieldFilter === "custom") &&
                  customFields
                    .filter((f) => {
                      if (!fieldSearch) return true;
                      const q = fieldSearch.toLowerCase();
                      return f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q);
                    })
                    .map((f) => (
                      <tr key={`custom-${f.id}`} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{f.label}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-500/15 text-brand-500 border border-brand-500/25">
                              Custom
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-brand-500/90">{f.key}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">Custom Field</td>
                        <td className="py-3 px-4 capitalize text-xs">{f.type}</td>
                        <td className="py-3 px-4">
                          {f.is_required ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">
                              Required
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Optional</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteField(f.id)}
                              className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Delete Field"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                {/* 2. Standard Built-in Fields */}
                {(fieldFilter === "all" || fieldFilter === "standard") &&
                  STANDARD_INVOICE_FIELDS.filter((f) => {
                    if (!fieldSearch) return true;
                    const q = fieldSearch.toLowerCase();
                    return (
                      f.label.toLowerCase().includes(q) ||
                      f.key.toLowerCase().includes(q) ||
                      f.category.toLowerCase().includes(q)
                    );
                  }).map((f) => (
                    <tr key={`standard-${f.key}`} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{f.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground border border-border">
                            Standard
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{f.key}</td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">{f.category}</td>
                      <td className="py-3 px-4 capitalize text-xs">{f.type}</td>
                      <td className="py-3 px-4">
                        {f.isRequired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Optional</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-muted-foreground/80 bg-muted/60"
                          title="System field — permanently built into Framebooks"
                        >
                          <Lock className="w-3 h-3 text-muted-foreground" />
                          <span>Built-in</span>
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewLayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-bold text-foreground">Layout Preview</h3>
              <button
                type="button"
                onClick={() => setPreviewLayout(null)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex justify-center bg-gray-100 dark:bg-gray-950/70">
              <InvoiceRenderer
                layout={previewLayout}
                invoice={SAMPLE_INVOICE_DATA}
                tenantInfo={SAMPLE_TENANT_INFO}
                plan="Pro Plus"
                scale={0.85}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Field Modal */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveField}
            className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Add Custom Invoice Field</h3>
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Field Label *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Purchase Order (PO) Number"
                  value={fieldForm.label}
                  onChange={(e) => setFieldForm({ ...fieldForm, label: e.target.value })}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Field Type</label>
                <select
                  value={fieldForm.type}
                  onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value as any })}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-brand-500 outline-none"
                >
                  <option value="text">Single Line Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="dropdown">Dropdown Selection</option>
                  <option value="boolean">Checkbox (Yes / No)</option>
                </select>
              </div>

              {fieldForm.type === "dropdown" && (
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Options (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Urgent, Normal, Low"
                    value={fieldForm.optionsText}
                    onChange={(e) => setFieldForm({ ...fieldForm, optionsText: e.target.value })}
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:border-brand-500 outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="req_check"
                  checked={fieldForm.isRequired}
                  onChange={(e) => setFieldForm({ ...fieldForm, isRequired: e.target.checked })}
                  className="rounded border-border text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="req_check" className="text-xs text-foreground cursor-pointer select-none">
                  Compulsory on all new invoices
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setIsFieldModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingField}
                className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {savingField ? "Saving..." : "Save Field"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
