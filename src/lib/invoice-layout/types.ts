// src/lib/invoice-layout/types.ts

export type PageSize = 'A4' | 'Letter';
export type PageOrientation = 'portrait';

export type BlockType =
  | 'business_header'
  | 'logo'
  | 'business_info'
  | 'invoice_meta'
  | 'document_title'
  | 'invoice_number'
  | 'invoice_date'
  | 'due_date'
  | 'bill_to'
  | 'items_table'
  | 'totals_summary'
  | 'amount_due_callout'
  | 'total_subtotal'
  | 'total_discount'
  | 'total_tax'
  | 'total_advance'
  | 'total_invoice'
  | 'total_due'
  | 'bank_details'
  | 'notes'
  | 'terms'
  | 'signature'
  | 'custom_field'
  | 'image_block'
  | 'divider'
  | 'spacer'
  | 'text_block';

export interface BlockStyle {
  fontSize?: number; // pt (min 8)
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: string; // hex
  align?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingBottom?: number;
  borderBottom?: boolean;
  borderColor?: string;
  backgroundColor?: string;
}

export interface LayoutBlock {
  id: string;
  type: BlockType;
  isCompulsory?: boolean; // Cannot be deleted or hidden
  props: Record<string, any>;
  styles?: BlockStyle;
  x?: number; // X coordinate in mm (Photoshop freeform drag-and-drop)
  y?: number; // Y coordinate in mm (Photoshop freeform drag-and-drop)
  width?: number; // Width in mm
  height?: number; // Height in mm
  zIndex?: number;
}

export interface SectionColumn {
  id: string;
  widthRatio: number; // 1 to 12 grid span (sum in a row = 12)
  blocks: LayoutBlock[];
}

export interface SectionRow {
  id: string;
  name?: string;
  columns: SectionColumn[];
  paddingTop?: number;
  paddingBottom?: number;
}

export interface LayoutTheme {
  fontFamily: 'Helvetica' | 'Inter' | 'Product Sans' | 'Times' | 'Courier';
  baseFontSize: number; // pt, default 10, min 8, max 16
  primaryColor: string; // brand/header color hex
  textColor: string; // text body color hex
  accentColor: string; // highlight color hex
  backgroundColor: string; // default #ffffff
  backgroundImage?: string; // Data URL or Image URL for blank format overlay
  backgroundOpacity?: number; // 0 to 1, default 1
  backgroundFit?: 'cover' | 'contain' | 'fill';
}

export interface InvoiceLayoutDefinition {
  version: number;
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: {
    top: number; // mm
    right: number;
    bottom: number;
    left: number;
  };
  theme: LayoutTheme;
  sections: SectionRow[];
}

export interface CustomFieldDefinition {
  id: string;
  tenant_id?: number;
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'dropdown' | 'boolean';
  options?: string[];
  default_value?: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type LayoutDocumentType = 'invoice' | 'quotation' | 'both';

export interface InvoiceLayoutRecord {
  id: string;
  tenant_id: number;
  name: string;
  document_type: LayoutDocumentType | string;
  page_size: PageSize;
  orientation: PageOrientation;
  definition: InvoiceLayoutDefinition;
  is_default: boolean;
  is_active: boolean;
  thumbnail_url?: string | null;
  version: number;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  usage_count?: number;
}
