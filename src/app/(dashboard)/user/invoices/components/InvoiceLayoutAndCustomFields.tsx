// src/app/(dashboard)/user/invoices/components/InvoiceLayoutAndCustomFields.tsx
"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InvoiceLayoutRecord, CustomFieldDefinition } from "@/lib/invoice-layout/types";

interface InvoiceLayoutAndCustomFieldsProps {
  selectedLayoutId?: string;
  onLayoutChange?: (layoutId: string) => void;
  customFieldValues: Record<string, any>;
  onCustomFieldChange: (key: string, value: any) => void;
  layouts?: InvoiceLayoutRecord[];
  customFields: CustomFieldDefinition[];
  tenantPlan: string;
  documentType?: 'invoice' | 'quotation';
}

export function InvoiceLayoutAndCustomFields({
  customFieldValues,
  onCustomFieldChange,
  customFields = [],
  tenantPlan,
  documentType = 'invoice',
}: InvoiceLayoutAndCustomFieldsProps) {
  const canCustomize = tenantPlan === "Pro Plus";
  const isQuotation = documentType === 'quotation';

  if (!customFields || customFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Custom Fields Card (If active fields exist for workspace) */}
      <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {isQuotation ? "Custom Quotation Fields" : "Custom Invoice Fields"}
          </h2>
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
    </div>
  );
}
