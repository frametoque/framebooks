// src/lib/invoice-layout/schema.ts
import { InvoiceLayoutDefinition, LayoutBlock, BlockType } from "./types";

const MAX_PAYLOAD_BYTES = 200 * 1024; // 200 KB
const MAX_BLOCKS_PER_LAYOUT = 40;

const ALLOWED_BLOCK_TYPES: BlockType[] = [
  'business_header',
  'logo',
  'business_info',
  'invoice_meta',
  'document_title',
  'invoice_number',
  'invoice_date',
  'due_date',
  'bill_to',
  'items_table',
  'totals_summary',
  'amount_due_callout',
  'total_subtotal',
  'total_discount',
  'total_tax',
  'total_advance',
  'total_invoice',
  'total_due',
  'bank_details',
  'notes',
  'terms',
  'signature',
  'custom_field',
  'image_block',
  'divider',
  'spacer',
  'text_block',
];

const MALICIOUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /<iframe\b/gi,
  /<object\b/gi,
  /<embed\b/gi,
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateLayoutDefinition(def: any): ValidationResult {
  const errors: string[] = [];

  if (!def || typeof def !== 'object') {
    return { valid: false, errors: ['Layout definition must be a valid JSON object.'] };
  }

  // Size check
  const jsonStr = JSON.stringify(def);
  if (jsonStr.length > MAX_PAYLOAD_BYTES) {
    errors.push(`Layout definition exceeds the 200 KB size limit (current: ${(jsonStr.length / 1024).toFixed(1)} KB).`);
  }

  // Security check: reject potential script injection
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(jsonStr)) {
      errors.push('Layout definition contains disallowed HTML or script patterns.');
      break;
    }
  }

  // Basic structure
  if (def.version !== 1) {
    errors.push('Unsupported layout schema version (must be 1).');
  }

  if (def.pageSize !== 'A4' && def.pageSize !== 'Letter') {
    errors.push("Invalid pageSize (must be 'A4' or 'Letter').");
  }

  if (def.orientation !== 'portrait') {
    errors.push("Invalid orientation (only 'portrait' is supported).");
  }

  // Margins
  if (!def.margins || typeof def.margins !== 'object') {
    errors.push('Margins object is required.');
  } else {
    const { top, right, bottom, left } = def.margins;
    if (typeof top !== 'number' || top < 0 || top > 50) errors.push('Top margin must be between 0 and 50 mm.');
    if (typeof right !== 'number' || right < 0 || right > 50) errors.push('Right margin must be between 0 and 50 mm.');
    if (typeof bottom !== 'number' || bottom < 0 || bottom > 50) errors.push('Bottom margin must be between 0 and 50 mm.');
    if (typeof left !== 'number' || left < 0 || left > 50) errors.push('Left margin must be between 0 and 50 mm.');
  }

  // Theme
  if (!def.theme || typeof def.theme !== 'object') {
    errors.push('Theme object is required.');
  } else {
    if (typeof def.theme.baseFontSize === 'number' && (def.theme.baseFontSize < 8 || def.theme.baseFontSize > 18)) {
      errors.push('Base font size must be between 8 pt and 18 pt.');
    }
  }

  // Sections & Blocks
  if (!Array.isArray(def.sections)) {
    errors.push('Sections must be an array.');
  } else {
    let blockCount = 0;

    for (let rIdx = 0; rIdx < def.sections.length; rIdx++) {
      const row = def.sections[rIdx];
      if (!row || !Array.isArray(row.columns)) {
        errors.push(`Section row at index ${rIdx} must contain an array of columns.`);
        continue;
      }

      let totalWidth = 0;
      for (let cIdx = 0; cIdx < row.columns.length; cIdx++) {
        const col = row.columns[cIdx];
        if (!col || typeof col.widthRatio !== 'number') {
          errors.push(`Column at row ${rIdx}, col ${cIdx} has an invalid widthRatio.`);
          continue;
        }
        totalWidth += col.widthRatio;

        if (!Array.isArray(col.blocks)) {
          errors.push(`Column at row ${rIdx}, col ${cIdx} must contain an array of blocks.`);
          continue;
        }

        for (const block of col.blocks) {
          blockCount++;
          if (!block || typeof block !== 'object') {
            errors.push('Invalid block structure.');
            continue;
          }

          if (!ALLOWED_BLOCK_TYPES.includes(block.type)) {
            errors.push(`Unknown or unsupported block type: "${block.type}".`);
          }

          if (block.styles?.fontSize && (block.styles.fontSize < 7 || block.styles.fontSize > 36)) {
            errors.push(`Block font size must be between 7 and 36 pt.`);
          }
        }
      }

      if (totalWidth !== 12) {
        errors.push(`Section row at index ${rIdx} column widths sum to ${totalWidth}, but must equal 12.`);
      }
    }

    if (blockCount > MAX_BLOCKS_PER_LAYOUT) {
      errors.push(`Layout exceeds the maximum block limit of ${MAX_BLOCKS_PER_LAYOUT} blocks (current: ${blockCount}).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
