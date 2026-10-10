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
  if (!presentTypes.has('business_header') && !presentTypes.has('business_info') && !presentTypes.has('logo')) {
    if (!def.theme?.backgroundImage) {
      missingBlocks.push('Business Name / Logo');
    }
  }

  // 2. Invoice Metadata (Number, Date)
  const hasMeta =
    presentTypes.has('invoice_meta') ||
    presentTypes.has('invoice_number') ||
    presentTypes.has('invoice_date');
  if (!hasMeta && !def.theme?.backgroundImage) {
    missingBlocks.push('Invoice Details (Number & Date)');
  }

  // 3. Client Bill-To
  if (!presentTypes.has('bill_to') && !def.theme?.backgroundImage) {
    missingBlocks.push('Bill To (Client Information)');
  }

  // 4. Items Table
  if (!presentTypes.has('items_table') && !def.theme?.backgroundImage) {
    missingBlocks.push('Line Items Table');
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
