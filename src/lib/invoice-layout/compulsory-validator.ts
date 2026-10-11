// src/lib/invoice-layout/compulsory-validator.ts
import { InvoiceLayoutDefinition, BlockType } from "./types";

export interface CompulsoryCheckResult {
  valid: boolean;
  missingBlocks: string[];
}

export function validateCompulsoryBlocks(def: InvoiceLayoutDefinition): CompulsoryCheckResult {
  const presentTypes = new Set<BlockType>();

  if (Array.isArray(def.sections)) {
    for (const section of def.sections) {
      if (Array.isArray(section.columns)) {
        for (const col of section.columns) {
          if (Array.isArray(col.blocks)) {
            for (const b of col.blocks) {
              if (b?.type) presentTypes.add(b.type);
            }
          }
        }
      }
    }
  }

  const missingBlocks: string[] = [];

  // 1. Business Identity (satisfied if letterhead background stationery is uploaded)
  const hasBusiness =
    presentTypes.has('business_header') ||
    presentTypes.has('business_info') ||
    presentTypes.has('business_address') ||
    presentTypes.has('logo');
  if (!hasBusiness && !def.theme?.backgroundImage) {
    missingBlocks.push('Business Name / Logo');
  }

  // 2. Invoice Metadata (Number, Date)
  const hasMeta =
    presentTypes.has('invoice_meta') ||
    presentTypes.has('invoice_number') ||
    presentTypes.has('invoice_date');
  if (!hasMeta && !def.theme?.backgroundImage) {
    missingBlocks.push('Invoice Details (Number & Date)');
  }

  // 3. Client Information
  const hasClient =
    presentTypes.has('bill_to') ||
    presentTypes.has('client_name') ||
    presentTypes.has('client_header') ||
    presentTypes.has('client_address');
  if (!hasClient && !def.theme?.backgroundImage) {
    missingBlocks.push('Client Information (Name / Bill-To)');
  }

  // 4. Line Items Table / Columns
  const hasItems =
    presentTypes.has('items_table') ||
    presentTypes.has('items_col_desc') ||
    presentTypes.has('items_col_amount');
  if (!hasItems && !def.theme?.backgroundImage) {
    missingBlocks.push('Line Items');
  }

  // 5. Totals & Balance
  const hasTotals =
    presentTypes.has('totals_summary') ||
    presentTypes.has('amount_due_callout') ||
    presentTypes.has('total_due') ||
    presentTypes.has('total_invoice') ||
    presentTypes.has('total_subtotal');
  if (!hasTotals && !def.theme?.backgroundImage) {
    missingBlocks.push('Totals Summary & Balance Due');
  }

  return {
    valid: missingBlocks.length === 0,
    missingBlocks,
  };
}
