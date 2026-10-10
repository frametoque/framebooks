// src/lib/invoice-layout/templates.ts
import { InvoiceLayoutDefinition } from "./types";

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  badge?: string;
  definition: InvoiceLayoutDefinition;
}

export const STANDARD_LAYOUT_DEFINITION: InvoiceLayoutDefinition = {
  version: 1,
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 15, right: 15, bottom: 15, left: 15 },
  theme: {
    fontFamily: "Helvetica",
    baseFontSize: 10,
    primaryColor: "#1A3A4A",
    textColor: "#222222",
    accentColor: "#00E35B",
    backgroundColor: "#ffffff",
  },
  sections: [
    // Header Row: Business Info / Logo on left, Invoice Meta on right
    {
      id: "header_section",
      name: "Header",
      paddingTop: 0,
      paddingBottom: 15,
      columns: [
        {
          id: "col_biz",
          widthRatio: 7,
          blocks: [
            {
              id: "b_logo",
              type: "logo",
              props: { maxHeight: 50 },
            },
            {
              id: "b_biz_name",
              type: "business_header",
              isCompulsory: true,
              props: {},
              styles: { fontSize: 18, fontWeight: "bold", color: "#1A3A4A", paddingTop: 6 },
            },
          ],
        },
        {
          id: "col_meta",
          widthRatio: 5,
          blocks: [
            {
              id: "b_meta",
              type: "invoice_meta",
              isCompulsory: true,
              props: { title: "INVOICE", showDueDate: true },
              styles: { align: "right" },
            },
          ],
        },
      ],
    },
    // Bill To & Amount Due Row
    {
      id: "billing_section",
      name: "Billing & Amount Due",
      paddingTop: 10,
      paddingBottom: 15,
      columns: [
        {
          id: "col_bill_to",
          widthRatio: 7,
          blocks: [
            {
              id: "b_bill_to",
              type: "bill_to",
              isCompulsory: true,
              props: { label: "Bill To:" },
              styles: { fontSize: 10 },
            },
          ],
        },
        {
          id: "col_amount_due",
          widthRatio: 5,
          blocks: [
            {
              id: "b_amount_due",
              type: "amount_due_callout",
              props: { label: "Amount Due" },
              styles: { align: "right" },
            },
          ],
        },
      ],
    },
    // Line Items Table Row
    {
      id: "items_section",
      name: "Line Items",
      paddingTop: 5,
      paddingBottom: 15,
      columns: [
        {
          id: "col_items",
          widthRatio: 12,
          blocks: [
            {
              id: "b_items",
              type: "items_table",
              isCompulsory: true,
              props: { showQuantity: true, showUnitPrice: true, striped: false },
            },
          ],
        },
      ],
    },
    // Summary & Bank Details Row
    {
      id: "summary_section",
      name: "Summary & Payment",
      paddingTop: 5,
      paddingBottom: 15,
      columns: [
        {
          id: "col_bank",
          widthRatio: 6,
          blocks: [
            {
              id: "b_bank",
              type: "bank_details",
              props: { title: "Bank Details" },
            },
            {
              id: "b_notes",
              type: "notes",
              props: { title: "Notes" },
              styles: { paddingTop: 10 },
            },
          ],
        },
        {
          id: "col_totals",
          widthRatio: 6,
          blocks: [
            {
              id: "b_totals",
              type: "totals_summary",
              isCompulsory: true,
              props: {},
              styles: { align: "right" },
            },
          ],
        },
      ],
    },
  ],
};

export const MODERN_MINIMAL_DEFINITION: InvoiceLayoutDefinition = {
  version: 1,
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
  theme: {
    fontFamily: "Inter",
    baseFontSize: 9.5,
    primaryColor: "#0F172A",
    textColor: "#334155",
    accentColor: "#2563EB",
    backgroundColor: "#ffffff",
  },
  sections: [
    {
      id: "sec_mod_1",
      name: "Modern Header",
      paddingTop: 0,
      paddingBottom: 20,
      columns: [
        {
          id: "col_m1",
          widthRatio: 6,
          blocks: [
            { id: "b_logo_m", type: "logo", props: { maxHeight: 42 } },
            { id: "b_biz_m", type: "business_header", isCompulsory: true, props: {}, styles: { fontSize: 16, fontWeight: "bold" } },
          ],
        },
        {
          id: "col_m2",
          widthRatio: 6,
          blocks: [
            { id: "b_meta_m", type: "invoice_meta", isCompulsory: true, props: { title: "Tax Invoice" }, styles: { align: "right" } },
          ],
        },
      ],
    },
    {
      id: "sec_mod_div",
      name: "Divider",
      paddingTop: 0,
      paddingBottom: 12,
      columns: [
        {
          id: "col_div",
          widthRatio: 12,
          blocks: [{ id: "b_div1", type: "divider", props: { color: "#E2E8F0" } }],
        },
      ],
    },
    {
      id: "sec_mod_bill",
      name: "Client",
      paddingTop: 0,
      paddingBottom: 18,
      columns: [
        {
          id: "col_mbill",
          widthRatio: 6,
          blocks: [{ id: "b_bill_m", type: "bill_to", isCompulsory: true, props: { label: "Invoiced To" } }],
        },
        {
          id: "col_mdue",
          widthRatio: 6,
          blocks: [{ id: "b_due_m", type: "amount_due_callout", props: { label: "Total Balance Due" }, styles: { align: "right" } }],
        },
      ],
    },
    {
      id: "sec_mod_items",
      name: "Items",
      paddingTop: 0,
      paddingBottom: 15,
      columns: [
        {
          id: "col_mitems",
          widthRatio: 12,
          blocks: [{ id: "b_items_m", type: "items_table", isCompulsory: true, props: { striped: true } }],
        },
      ],
    },
    {
      id: "sec_mod_footer",
      name: "Totals",
      paddingTop: 10,
      paddingBottom: 10,
      columns: [
        {
          id: "col_mnotes",
          widthRatio: 6,
          blocks: [
            { id: "b_mbank", type: "bank_details", props: { title: "Payment Info" } },
            { id: "b_mterms", type: "terms", props: { title: "Payment Terms" }, styles: { paddingTop: 8 } },
          ],
        },
        {
          id: "col_mtotals",
          widthRatio: 6,
          blocks: [{ id: "b_tot_m", type: "totals_summary", isCompulsory: true, props: {}, styles: { align: "right" } }],
        },
      ],
    },
  ],
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "standard",
    name: "Standard Classic",
    description: "Classic clean corporate layout matching Framebooks default styling.",
    badge: "Default",
    definition: STANDARD_LAYOUT_DEFINITION,
  },
  {
    id: "modern_minimal",
    name: "Modern Minimalist",
    description: "Sleek contemporary look with crisp dividers and balanced proportions.",
    badge: "Popular",
    definition: MODERN_MINIMAL_DEFINITION,
  },
];
