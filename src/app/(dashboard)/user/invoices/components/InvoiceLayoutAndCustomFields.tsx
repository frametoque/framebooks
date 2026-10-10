// src/app/(dashboard)/user/invoices/components/InvoiceLayoutAndCustomFields.tsx
"use client";

import React from "react";
import Link from "next/link";
import { Layout, Sparkles, Lock, ArrowUpRight } from "lucide-react";
import { InvoiceLayoutRecord, CustomFieldDefinition } from "@/lib/invoice-layout/types";

interface InvoiceLayoutAndCustomFieldsProps {
  selectedLayoutId: string;
  onLayoutChange: (layoutId: string) => void;
  customFieldValues: Record<string, any>;
  onCustomFieldChange: (key: string, value: any) => void;
  layouts: InvoiceLayoutRecord[];
  customFields: CustomFieldDefinition[];
  tenantPlan: string;
  documentType?: 'invoice' | 'quotation';
}

export function InvoiceLayoutAndCustomFields({
  selectedLayoutId,
  onLayoutChange,
  customFieldValues,
  onCustomFieldChange,
  layouts,
  customFields,
  tenantPlan,
  documentType = 'invoice',
}: InvoiceLayoutAndCustomFieldsProps) {
  const canCustomize = tenantPlan === "Pro Plus";

  const applicableLayouts = layouts.filter((l) => {
    const docType = l.document_type || 'both';
    if (docType === 'both') return true;
    return docType === documentType;
  });

  const isQuotation = documentType === 'quotation';
  const docTitle = isQuotation ? "Quotation Layout" : "Invoice Layout";
  const docDescription = isQuotation
    ? "Choose the design template applied when printing, sharing, or downloading this quotation."
    : "Choose the design template applied when printing, sharing, or downloading this invoice.";

  const handleOpenUpgrade = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("upgrade-modal:open", {
          detail: `Custom ${isQuotation ? "quotation" : "invoice"} layouts and custom fields are exclusive to Pro Plus. Upgrade to Pro Plus to customize your templates.`,
        })
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Layout Selector Card */}
      <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-brand-400" />
            <h2 className="text-xl font-semibold">{docTitle}</h2>
          </div>
          {canCustomize && (
            <Link
              href="/user/settings/invoice-layout"
              target="_blank"
              className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
            >
              <span>Manage layouts</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        <p className="text-xs text-gray-400">
          {docDescription}
        </p>

        {canCustomize ? (
          <div className="space-y-2">
            <select
              value={selectedLayoutId}
              onChange={(e) => onLayoutChange(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors appearance-none shadow-2xs text-sm"
            >
              <option value="">Standard Classic (Default)</option>
              {applicableLayouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.is_default ? "★ (Workspace Default)" : ""}
                </option>
              ))}
            </select>
            {applicableLayouts.length === 0 && (
              <p className="text-[11px] text-gray-500">
                You have not created any {isQuotation ? "quotation" : "invoice"} formats yet.{" "}
                <Link
                  href="/user/settings/invoice-layout"
                  className="text-brand-400 underline hover:text-brand-300"
                >
                  Create your first layout
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-black/5 dark:bg-white/[0.02] border border-border rounded-2xl">
              <div>
                <p className="text-sm font-medium text-foreground">Standard Framebooks Layout</p>
                <p className="text-xs text-gray-400">Current active layout for your workspace</p>
              </div>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Active
              </span>
            </div>

            <div
              onClick={handleOpenUpgrade}
              className="group cursor-pointer flex items-center justify-between p-3.5 bg-gradient-to-r from-brand-500/5 via-blue-500/5 to-purple-500/5 border border-brand-500/20 hover:border-brand-500/40 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground group-hover:text-brand-400 transition-colors">
                      Custom Layout Builder
                    </p>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> PRO PLUS
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Design bespoke multi-column invoices, drag & drop blocks, custom brand fonts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-brand-500/20 text-brand-400 hover:bg-brand-500 hover:text-black transition-all"
              >
                Upgrade
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Custom Fields Card (If active fields exist for workspace) */}
      {customFields.length > 0 && (
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Custom Invoice Fields</h2>
            {canCustomize && (
              <Link
                href="/user/settings/invoice-layout"
                target="_blank"
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors"
              >
                <span>Manage fields</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {customFields.map((field) => {
              const val = customFieldValues[field.key] ?? field.default_value ?? "";

              if (field.type === "boolean") {
                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-3 border border-border rounded-xl col-span-1 sm:col-span-2"
                  >
                    <div>
                      <label className="text-sm font-medium text-foreground">{field.label}</label>
                      {field.is_required && <span className="text-red-400 ml-1">*</span>}
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(customFieldValues[field.key])}
                      onChange={(e) => onCustomFieldChange(field.key, e.target.checked)}
                      className="w-4 h-4 rounded text-brand-500 border-border focus:ring-brand-500"
                    />
                  </div>
                );
              }

              if (field.type === "dropdown") {
                const options = Array.isArray(field.options) ? field.options : [];
                return (
                  <div key={field.id} className="space-y-1">
                    <label className="text-sm text-gray-400">
                      {field.label}
                      {field.is_required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    <select
                      value={String(val)}
                      onChange={(e) => onCustomFieldChange(field.key, e.target.value)}
                      className="w-full bg-card border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                    >
                      <option value="">— Select {field.label} —</option>
                      {options.map((opt: string, idx: number) => (
                        <option key={idx} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              return (
                <div key={field.id} className="space-y-1">
                  <label className="text-sm text-gray-400">
                    {field.label}
                    {field.is_required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    value={val}
                    onChange={(e) => onCustomFieldChange(field.key, e.target.value)}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className="w-full bg-transparent border border-border rounded-xl px-4 py-2.5 outline-none focus:border-brand-500 transition-colors text-sm"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
