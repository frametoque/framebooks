// src/app/(dashboard)/user/settings/invoice-layout/InvoiceLayoutTab.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Check, Star, Trash2, Edit3, Eye, Settings2, AlertCircle, Copy, X, Lock } from "lucide-react";
import { InvoiceLayoutRecord, LayoutDocumentType } from "@/lib/invoice-layout/types";
import { getInvoiceLayouts, setLayoutFormat, deleteInvoiceLayout, duplicateInvoiceLayout, canCustomizeInvoices } from "../../actions/invoice-layouts";
import { STARTER_TEMPLATES, STANDARD_LAYOUT_DEFINITION } from "@/lib/invoice-layout/templates";
import { InvoiceRenderer } from "@/lib/invoice-layout/renderer";
import { SAMPLE_INVOICE_DATA, SAMPLE_TENANT_INFO } from "@/lib/invoice-layout/sample-data";
import { Loader } from "@/components/ui/Loader";

function getLayoutDef(def: any) {
  if (!def) return STANDARD_LAYOUT_DEFINITION;
  if (typeof def === "string") {
    try {
      return JSON.parse(def);
    } catch {
      return STANDARD_LAYOUT_DEFINITION;
    }
  }
  return def;
}

export default function InvoiceLayoutTab({ canManage: initialCanManage = true, isProPlus = false }: { canManage?: boolean; isProPlus?: boolean }) {
  const [canManage, setCanManage] = useState(initialCanManage);
  const [layouts, setLayouts] = useState<InvoiceLayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLayout, setPreviewLayout] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [updatingFormatId, setUpdatingFormatId] = useState<string | null>(null);

  const handleUpgradePrompt = (featureName = "custom invoice layouts") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("upgrade-modal:open", {
          detail: `Custom invoice layouts and templates are exclusive to Pro Plus. Upgrade to Pro Plus to create, edit, and apply ${featureName}.`,
        })
      );
    }
  };

  const loadData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [lData, hasPerm] = await Promise.all([
        getInvoiceLayouts(),
        canCustomizeInvoices(),
      ]);
      setLayouts(lData || []);
      setCanManage(hasPerm);
    } catch (err: any) {
      setActionError(err.message || "Failed to load layouts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSetFormat = async (id: string | "standard", target: "invoice" | "quotation" | "all") => {
    if (!canManage) return;
    if (id !== "standard" && !isProPlus) {
      handleUpgradePrompt("custom layouts");
      return;
    }
    setUpdatingFormatId(id);
    setActionError(null);
    try {
      const res = await setLayoutFormat(id, target);
      if (res.success) {
        setActionSuccess("Layout format updated.");
        setTimeout(() => setActionSuccess(null), 2500);
        await loadData();
      } else {
        setActionError(res.error || "Failed to update layout format.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setUpdatingFormatId(null);
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

  const handleDuplicate = async (id: string) => {
    if (!canManage) return;
    if (!isProPlus) {
      handleUpgradePrompt("custom layouts");
      return;
    }
    setDuplicatingId(id);
    setActionError(null);
    try {
      const res = await duplicateInvoiceLayout(id);
      if (res.success) {
        setActionSuccess("Layout duplicated successfully.");
        setTimeout(() => setActionSuccess(null), 3000);
        await loadData();
      } else {
        setActionError(res.error || "Failed to duplicate layout.");
      }
    } catch (err: any) {
      setActionError(err.message || "An error occurred.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const activeInvoiceLayout = layouts.find(
    (l) => l.document_type === "invoice" || l.document_type === "all" || l.document_type === "both"
  );
  const activeQuotationLayout = layouts.find(
    (l) => l.document_type === "quotation" || l.document_type === "all" || l.document_type === "both"
  );

  const standardStatus: "all" | "invoice" | "quotation" | "off" =
    !activeInvoiceLayout && !activeQuotationLayout
      ? "all"
      : !activeInvoiceLayout && activeQuotationLayout
      ? "invoice"
      : activeInvoiceLayout && !activeQuotationLayout
      ? "quotation"
      : "off";

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

      {/* Action button */}
      {canManage && (
        <div className="flex justify-end">
          {!isProPlus ? (
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
              href="/settings/invoice-layout/builder/new"
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Layout</span>
            </Link>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader size="lg" />
        </div>
      ) : (
        /* Layouts Grid */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* 1. Default Standard Layout */}
            <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-row gap-3.5 sm:gap-4 md:gap-5 transition-all hover:border-brand-500/30 group relative">
              {/* Left: Portrait Preview Thumbnail */}
              <div
                onClick={() => setPreviewLayout(STANDARD_LAYOUT_DEFINITION)}
                className="relative w-[115px] sm:w-[125px] xl:w-[130px] 2xl:w-[140px] aspect-[210/297] rounded-xl border border-border/70 bg-white overflow-hidden shrink-0 flex justify-center items-start cursor-pointer group/thumb transition-colors hover:border-brand-500/50 shadow-2xs"
                title="Click to preview layout"
              >
                <div className="pointer-events-none transform scale-[0.145] sm:scale-[0.158] xl:scale-[0.164] 2xl:scale-[0.176] origin-top select-none">
                  <InvoiceRenderer
                    layout={STANDARD_LAYOUT_DEFINITION}
                    invoice={SAMPLE_INVOICE_DATA}
                    tenantInfo={SAMPLE_TENANT_INFO}
                    plan="Pro Plus"
                    scale={1}
                  />
                </div>
                {/* Hover Overlay with Preview Button */}
                <div className="absolute inset-0 bg-black/45 backdrop-blur-[1.5px] opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 z-20">
                  <div className="px-2.5 py-1 rounded-full bg-white/95 dark:bg-card text-foreground flex items-center gap-1.5 shadow-lg transform group-hover/thumb:scale-105 transition-transform text-[11px] font-bold">
                    <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                    <span>Preview</span>
                  </div>
                </div>
              </div>

              {/* Right: Title, Selector Buttons, Edit Buttons & Actions */}
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                  {/* Title & Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base sm:text-lg text-foreground truncate" title="Standard Classic">
                        Standard Classic
                      </h3>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      {standardStatus === "all" && (
                        <span className="text-[10px] sm:text-[11px] font-bold text-brand-500 bg-brand-500/10 border border-brand-500/25 px-2.5 py-0.5 rounded-full inline-block">
                          ALL
                        </span>
                      )}
                      {standardStatus === "invoice" && (
                        <span className="text-[10px] sm:text-[11px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/25 px-2.5 py-0.5 rounded-full inline-block">
                          Invoice Only
                        </span>
                      )}
                      {standardStatus === "quotation" && (
                        <span className="text-[10px] sm:text-[11px] font-bold text-purple-500 bg-purple-500/10 border border-purple-500/25 px-2.5 py-0.5 rounded-full inline-block">
                          Quotation Only
                        </span>
                      )}
                      {standardStatus === "off" && (
                        <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground bg-muted/60 border border-border px-2.5 py-0.5 rounded-full inline-block">
                          Off
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selector Buttons */}
                  <div className="mt-3">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      Assign To
                    </span>
                    <div className="inline-flex items-center bg-muted/50 p-0.5 rounded-xl border border-border flex-wrap gap-0.5">
                      <button
                        type="button"
                        disabled={!canManage || updatingFormatId === "standard"}
                        onClick={() => handleSetFormat("standard", "invoice")}
                        className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          standardStatus === "invoice"
                            ? "bg-brand-500 text-brand-950 shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title="Use Standard layout for Invoices"
                      >
                        Invoice
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || updatingFormatId === "standard"}
                        onClick={() => handleSetFormat("standard", "quotation")}
                        className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          standardStatus === "quotation"
                            ? "bg-brand-500 text-brand-950 shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title="Use Standard layout for Quotations"
                      >
                        Quotation
                      </button>
                      <button
                        type="button"
                        disabled={!canManage || updatingFormatId === "standard"}
                        onClick={() => handleSetFormat("standard", "all")}
                        className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                          standardStatus === "all"
                            ? "bg-brand-500 text-brand-950 shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                        title="Use Standard layout for ALL Documents (Invoices & Quotations)"
                      >
                        ALL
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Row */}
                <div className="flex items-center justify-between gap-2 pt-3 mt-4 border-t border-border/60">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewLayout(STANDARD_LAYOUT_DEFINITION)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Preview Standard Classic Layout"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canManage && isProPlus && (
                      <button
                        type="button"
                        disabled={duplicatingId === "standard"}
                        onClick={() => handleDuplicate("standard")}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                        title="Duplicate Standard Classic Layout"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                  </div>

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
                        href="/settings/invoice-layout/builder/new"
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
            </div>

            {/* Custom Layouts */}
            {layouts.map((l) => {
              const cStatus: "all" | "both" | "invoice" | "quotation" | "off" =
                l.document_type === "all" || l.document_type === "both"
                  ? "all"
                  : l.document_type === "invoice"
                  ? "invoice"
                  : l.document_type === "quotation"
                  ? "quotation"
                  : "off";

              return (
                <div
                  key={l.id}
                  className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-row gap-3.5 sm:gap-4 md:gap-5 transition-all hover:border-brand-500/30 group relative"
                >
                  {/* Left: Portrait Preview Thumbnail */}
                  <div
                    onClick={() => setPreviewLayout(getLayoutDef(l.definition))}
                    className="relative w-[115px] sm:w-[125px] xl:w-[130px] 2xl:w-[140px] aspect-[210/297] rounded-xl border border-border/70 bg-white overflow-hidden shrink-0 flex justify-center items-start cursor-pointer group/thumb transition-colors hover:border-brand-500/50 shadow-2xs"
                    title="Click to preview layout"
                  >
                    <div className="pointer-events-none transform scale-[0.145] sm:scale-[0.158] xl:scale-[0.164] 2xl:scale-[0.176] origin-top select-none">
                      <InvoiceRenderer
                        layout={getLayoutDef(l.definition)}
                        invoice={SAMPLE_INVOICE_DATA}
                        tenantInfo={SAMPLE_TENANT_INFO}
                        plan="Pro Plus"
                        scale={1}
                      />
                    </div>
                    {/* Hover Overlay with Preview Button */}
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[1.5px] opacity-0 group-hover/thumb:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 z-20">
                      <div className="px-2.5 py-1 rounded-full bg-white/95 dark:bg-card text-foreground flex items-center gap-1.5 shadow-lg transform group-hover/thumb:scale-105 transition-transform text-[11px] font-bold">
                        <Eye className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                        <span>Preview</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Title, Selector Buttons, Edit Buttons & Actions */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      {/* Title & Status Badge */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base sm:text-lg text-foreground truncate" title={l.name}>
                            {l.name}
                          </h3>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {cStatus === "all" && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-brand-500 bg-brand-500/10 border border-brand-500/25 px-2.5 py-0.5 rounded-full inline-block">
                              ALL
                            </span>
                          )}
                          {cStatus === "invoice" && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/25 px-2.5 py-0.5 rounded-full inline-block">
                              Invoice Only
                            </span>
                          )}
                          {cStatus === "quotation" && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-purple-500 bg-purple-500/10 border border-purple-500/25 px-2.5 py-0.5 rounded-full inline-block">
                              Quotation Only
                            </span>
                          )}
                          {cStatus === "off" && (
                            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground bg-muted/60 border border-border px-2.5 py-0.5 rounded-full inline-block">
                              Off
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selector Buttons */}
                      <div className="mt-3">
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          Assign To
                        </span>
                        <div className="inline-flex items-center bg-muted/50 p-0.5 rounded-xl border border-border flex-wrap gap-0.5">
                          <button
                            type="button"
                            disabled={!canManage || updatingFormatId === l.id}
                            onClick={() => handleSetFormat(l.id, "invoice")}
                            className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                              cStatus === "invoice"
                                ? "bg-brand-500 text-brand-950 shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title="Assign to Invoice"
                          >
                            Invoice
                          </button>
                          <button
                            type="button"
                            disabled={!canManage || updatingFormatId === l.id}
                            onClick={() => handleSetFormat(l.id, "quotation")}
                            className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                              cStatus === "quotation"
                                ? "bg-brand-500 text-brand-950 shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title="Assign to Quotation"
                          >
                            Quotation
                          </button>
                          <button
                            type="button"
                            disabled={!canManage || updatingFormatId === l.id}
                            onClick={() => handleSetFormat(l.id, "all")}
                            className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                              cStatus === "all"
                                ? "bg-brand-500 text-brand-950 shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                            title="Assign to ALL Documents (Invoices & Quotations)"
                          >
                            ALL
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between gap-2 pt-3 mt-4 border-t border-border/60">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewLayout(getLayoutDef(l.definition))}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="Preview Layout"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            disabled={duplicatingId === l.id}
                            onClick={() => handleDuplicate(l.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
                            title="Duplicate Layout"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
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
                            href={`/settings/invoice-layout/builder/${l.id}`}
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
                </div>
              );
            })}
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
    </div>
  );
}
