// src/lib/invoice-layout/renderer.tsx
"use client";

import React from "react";
import { InvoiceLayoutDefinition, LayoutBlock, SectionRow, SectionColumn } from "./types";

interface InvoiceRendererProps {
  layout: InvoiceLayoutDefinition;
  invoice: any;
  tenantInfo?: any;
  plan?: string;
  className?: string;
  scale?: number;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
  paperRef?: React.RefObject<HTMLDivElement | null>;
  onBlockDragStart?: (e: React.MouseEvent, block: LayoutBlock) => void;
  onBlockResizeStart?: (e: React.MouseEvent, block: LayoutBlock) => void;
  onCanvasDrop?: (e: React.DragEvent) => void;
  onCanvasDragOver?: (e: React.DragEvent) => void;
  dragOverActive?: boolean;
}

const formatLKR = (amount: number | string, currency = "LKR", showCurrency = true) => {
  const num = typeof amount === "number" ? amount : parseFloat(amount || "0");
  if (isNaN(num)) return "0.00";
  const formatted = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
  if (!showCurrency) return formatted;
  return `${currency === "LKR" ? "Rs." : currency} ${formatted}`;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export function InvoiceRenderer({
  layout,
  invoice,
  tenantInfo,
  plan = "Free",
  className = "",
  scale = 1,
  selectedBlockId,
  onSelectBlock,
  paperRef,
  onBlockDragStart,
  onBlockResizeStart,
  onCanvasDrop,
  onCanvasDragOver,
  dragOverActive,
}: InvoiceRendererProps) {
  const { theme, margins, pageSize } = layout;

  // Paper dimensions in mm
  const isLetter = pageSize === "Letter";
  const paperWidthMm = isLetter ? 215.9 : 210;
  const minHeightMm = isLetter ? 279.4 : 297;

  // Collect all blocks to separate absolute vs flow blocks
  const allBlocks: LayoutBlock[] = [];
  layout.sections.forEach((sec) => {
    sec.columns?.forEach((col) => {
      if (Array.isArray(col.blocks)) {
        allBlocks.push(...col.blocks);
      }
    });
  });

  const allAbsoluteBlocks = allBlocks.filter((b) => b.x !== undefined && b.y !== undefined);
  const hasAbsoluteBlocks = allAbsoluteBlocks.length > 0;
  const hasFlowBlocks = allBlocks.some((b) => b.x === undefined || b.y === undefined);

  const fontFamilies: Record<string, string> = {
    Helvetica: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    Inter: "'Inter', sans-serif",
    "Product Sans": "'Google Sans', 'Product Sans', sans-serif",
    Times: "'Times New Roman', Times, serif",
    Courier: "'Courier New', Courier, monospace",
  };

  const currentFontFamily = fontFamilies[theme.fontFamily] || fontFamilies.Helvetica;

  const renderBlock = (block: LayoutBlock) => {
    const isSelected = selectedBlockId === block.id;
    const styles = block.styles || {};
    const primaryColor = theme.primaryColor || "#1a3a4a";
    const textColor = styles.color || theme.textColor || "#222222";
    const accentColor = theme.accentColor || "#00E35B";

    const blockStyle: React.CSSProperties = {
      color: textColor,
      textAlign: styles.align || "left",
      paddingTop: styles.paddingTop ? `${styles.paddingTop}px` : undefined,
      paddingBottom: styles.paddingBottom ? `${styles.paddingBottom}px` : undefined,
      fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
      fontWeight: styles.fontWeight || undefined,
    };

    let content: React.ReactNode = null;

    switch (block.type) {
      case "logo": {
        const logoUrl = tenantInfo?.logo_url;
        const maxHeight = block.props?.maxHeight || 50;
        content = logoUrl ? (
          <img
            src={logoUrl}
            alt="Business Logo"
            style={{ maxHeight: `${maxHeight}px`, objectFit: "contain" }}
            className="block"
          />
        ) : (
          <div className="text-xs uppercase tracking-wider text-gray-400 font-medium py-1">
            [ Business Logo ]
          </div>
        );
        break;
      }

      case "business_header": {
        const name = block.props?.name || tenantInfo?.name || "Business Name";
        content = (
          <div style={{ color: primaryColor, fontWeight: "bold" }} className="text-xl leading-tight">
            {name}
          </div>
        );
        break;
      }

      case "business_info": {
        const legalName = block.props?.legalName || tenantInfo?.legal_name;
        const industry = block.props?.industry || tenantInfo?.industry;
        const address = block.props?.address || tenantInfo?.address;
        const phone = block.props?.phone || tenantInfo?.phone;
        const email = block.props?.email || tenantInfo?.email;
        const website = block.props?.website || tenantInfo?.website;
        content = (
          <div className="text-xs space-y-0.5 text-gray-600 dark:text-gray-400">
            {legalName && <div>{legalName}</div>}
            {industry && <div>{industry}</div>}
            {address && <div>{address}</div>}
            {phone && <div>{phone}</div>}
            {email && <div>{email}</div>}
            {website && <div>{website}</div>}
          </div>
        );
        break;
      }

      case "invoice_meta": {
        const isQuotationDoc = Boolean(invoice?.isQuotation || invoice?.documentType === "quotation");
        const defaultTitle = isQuotationDoc ? "QUOTATION" : "INVOICE";
        const defaultDocNoLabel = isQuotationDoc ? "Quotation No: " : "Invoice No: ";
        const title = block.props?.title || defaultTitle;
        const invoiceNoLabel = block.props?.invoiceNoLabel !== undefined ? block.props.invoiceNoLabel : defaultDocNoLabel;
        const dateLabel = block.props?.dateLabel !== undefined ? block.props.dateLabel : "Date: ";
        const dueDateLabel = block.props?.dueDateLabel !== undefined ? block.props.dueDateLabel : "Due Date: ";
        content = (
          <div className="space-y-1">
            <div style={{ color: primaryColor }} className="text-2xl font-bold tracking-tight">
              {title}
            </div>
            <div className="text-xs space-y-0.5">
              <div>
                <span className="text-gray-500">{invoiceNoLabel}</span>
                <span className="font-semibold">
                  {invoice?.invoice_id || invoice?.quotation_id || (isQuotationDoc ? "QT-00001" : "INV-0001")}
                </span>
              </div>
              <div>
                <span className="text-gray-500">{dateLabel}</span>
                <span>{formatDate(invoice?.date)}</span>
              </div>
              {block.props?.showDueDate && (invoice?.due_date || block.props?.sampleDueDate) && (
                <div>
                  <span className="text-gray-500">{dueDateLabel}</span>
                  <span>{formatDate(invoice?.due_date || block.props?.sampleDueDate)}</span>
                </div>
              )}
            </div>
          </div>
        );
        break;
      }

      case "document_title": {
        const isQuotationDoc = Boolean(invoice?.isQuotation || invoice?.documentType === "quotation");
        const defaultTitle = isQuotationDoc ? "QUOTATION" : "INVOICE";
        const title = block.props?.title || defaultTitle;
        content = (
          <div style={{ color: styles.color || primaryColor }} className="text-2xl font-bold tracking-tight">
            {title}
          </div>
        );
        break;
      }

      case "invoice_number": {
        const isQuotationDoc = Boolean(invoice?.isQuotation || invoice?.documentType === "quotation");
        const defaultLabel = isQuotationDoc ? "Quotation No: " : "Invoice No: ";
        const label = block.props?.label !== undefined ? block.props.label : defaultLabel;
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const invNo = invoice?.invoice_id || invoice?.quotation_id || (isQuotationDoc ? "QT-00001" : "INV-2026-0842");

        content = (
          <div className="text-xs leading-normal">
            {showLabel && <span className="text-gray-500 mr-1.5">{label}</span>}
            <span className="font-bold">{invNo}</span>
          </div>
        );
        break;
      }

      case "invoice_date": {
        const label = block.props?.label !== undefined ? block.props.label : "Date: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const dateVal = formatDate(invoice?.date);

        content = (
          <div className="text-xs leading-normal">
            {showLabel && <span className="text-gray-500 mr-1.5">{label}</span>}
            <span className="font-semibold">{dateVal}</span>
          </div>
        );
        break;
      }

      case "due_date": {
        const label = block.props?.label !== undefined ? block.props.label : "Due Date: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const dueVal = formatDate(
          invoice?.due_date ||
          block.props?.sampleDueDate ||
          (invoice?.date ? new Date(new Date(invoice.date).getTime() + 14 * 86400000).toISOString() : new Date().toISOString())
        );

        content = (
          <div className="text-xs leading-normal">
            {showLabel && <span className="text-gray-500 mr-1.5">{label}</span>}
            <span className="font-semibold">{dueVal}</span>
          </div>
        );
        break;
      }

      case "bill_to": {
        const label = block.props?.label || "Bill To:";
        const clientName = block.props?.clientName || invoice?.legal_name || "Client Name";
        const billingAddress = block.props?.billingAddress || invoice?.billing_address;
        const clientEmail = block.props?.clientEmail || invoice?.client_email;
        content = (
          <div className="space-y-1">
            <div style={{ color: primaryColor }} className="font-bold text-xs uppercase tracking-wider">
              {label}
            </div>
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-sm text-foreground">{clientName}</div>
              {billingAddress && (
                <div className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{billingAddress}</div>
              )}
              {clientEmail && (
                <div className="text-gray-500">{clientEmail}</div>
              )}
            </div>
          </div>
        );
        break;
      }

      case "amount_due_callout": {
        const calculatedTotalDue =
          invoice?.total_due !== undefined && invoice?.total_due !== null
            ? invoice.total_due
            : Math.max(0, (invoice?.total || 0) - (invoice?.advance || 0));
        const label = block.props?.label || "Amount Due";
        content = (
          <div className="space-y-0.5">
            <div style={{ color: primaryColor }} className="font-bold text-xs uppercase tracking-wider">
              {label}
            </div>
            <div style={{ color: primaryColor }} className="text-xl font-bold">
              {formatLKR(calculatedTotalDue, invoice?.currency)}
            </div>
          </div>
        );
        break;
      }

      case "items_table": {
        const rawItems = invoice?.items;
        const items = Array.isArray(rawItems)
          ? rawItems
          : typeof rawItems === "string"
            ? JSON.parse(rawItems || "[]")
            : [];
        const isStriped = Boolean(block.props?.striped);

        content = (
          <div className="w-full overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800/60 font-semibold" style={{ color: primaryColor }}>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-center text-gray-400">
                      No line items
                    </td>
                  </tr>
                ) : (
                  items.map((it: any, idx: number) => {
                    const qty = Number(it.quantity || it.qty) || 1;
                    return (
                      <tr
                        key={idx}
                        className={isStriped && idx % 2 === 1 ? "bg-gray-50/70 dark:bg-gray-800/20" : ""}
                      >
                        <td className="py-2 px-3 font-medium text-foreground">{it.description || "Item"}</td>
                        <td className="py-2 px-3 text-right text-gray-500">
                          {qty > 1 ? `${qty} × ` : ""}
                          {formatLKR(it.price, invoice?.currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-foreground">
                          {formatLKR(it.total, invoice?.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        );
        break;
      }

      case "totals_summary": {
        const subtotal = Number(invoice?.subtotal || 0);
        const discount = Number(invoice?.discount || 0);
        const taxRate = Number(invoice?.tax_rate || 0);
        const advance = Number(invoice?.advance || 0);
        const total = Number(invoice?.total || 0);
        const totalDue =
          invoice?.total_due !== undefined && invoice?.total_due !== null
            ? Number(invoice.total_due)
            : Math.max(0, total - advance);

        content = (
          <div className="space-y-1.5 text-xs ml-auto max-w-[260px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span className="font-semibold">{formatLKR(subtotal, invoice?.currency)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span>− {formatLKR(discount, invoice?.currency)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tax ({taxRate}%):</span>
                <span>+ {formatLKR((subtotal * taxRate) / 100, invoice?.currency)}</span>
              </div>
            )}
            {advance > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Advance Paid:</span>
                <span>− {formatLKR(advance, invoice?.currency)}</span>
              </div>
            )}
            <div className="border-t border-gray-300 dark:border-gray-700 pt-1 flex justify-between font-bold text-sm" style={{ color: primaryColor }}>
              <span>Total:</span>
              <span>{formatLKR(total, invoice?.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-0.5" style={{ color: primaryColor }}>
              <span>Amount Due:</span>
              <span>{formatLKR(totalDue, invoice?.currency)}</span>
            </div>
          </div>
        );
        break;
      }

      case "total_subtotal": {
        const subtotal = Number(invoice?.subtotal || 0);
        const label = block.props?.label !== undefined ? block.props.label : "Subtotal: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;

        content = (
          <div className="flex justify-between items-center text-xs w-full">
            {showLabel && <span className="text-gray-500 mr-2">{label}</span>}
            <span className="font-semibold ml-auto">{formatLKR(subtotal, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "total_discount": {
        const discount = Number(invoice?.discount || 0);
        const label = block.props?.label !== undefined ? block.props.label : "Discount: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;
        const prefix = block.props?.showPrefix !== false ? (block.props?.prefix ?? "− ") : "";

        content = (
          <div className="flex justify-between items-center text-xs text-red-600 w-full">
            {showLabel && <span className="mr-2">{label}</span>}
            <span className="font-semibold ml-auto">{prefix}{formatLKR(discount, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "total_tax": {
        const subtotal = Number(invoice?.subtotal || 0);
        const taxRate = Number(invoice?.tax_rate || 0);
        const taxAmount = (subtotal * taxRate) / 100;
        const label = block.props?.label !== undefined ? block.props.label : (taxRate > 0 ? `Tax (${taxRate}%): ` : "Tax: ");
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;
        const prefix = block.props?.showPrefix !== false ? (block.props?.prefix ?? "+ ") : "";

        content = (
          <div className="flex justify-between items-center text-xs w-full">
            {showLabel && <span className="text-gray-500 mr-2">{label}</span>}
            <span className="font-semibold ml-auto">{prefix}{formatLKR(taxAmount, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "total_advance": {
        const advance = Number(invoice?.advance || 0);
        const label = block.props?.label !== undefined ? block.props.label : "Advance Paid: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;
        const prefix = block.props?.showPrefix !== false ? (block.props?.prefix ?? "− ") : "";

        content = (
          <div className="flex justify-between items-center text-xs text-emerald-600 w-full">
            {showLabel && <span className="mr-2">{label}</span>}
            <span className="font-semibold ml-auto">{prefix}{formatLKR(advance, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "total_invoice": {
        const total = Number(invoice?.total || 0);
        const label = block.props?.label !== undefined ? block.props.label : "Total: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;

        content = (
          <div className="flex justify-between items-center font-bold text-sm w-full" style={{ color: styles.color || primaryColor }}>
            {showLabel && <span className="mr-2">{label}</span>}
            <span className="ml-auto">{formatLKR(total, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "total_due": {
        const total = Number(invoice?.total || 0);
        const advance = Number(invoice?.advance || 0);
        const totalDue =
          invoice?.total_due !== undefined && invoice?.total_due !== null
            ? Number(invoice.total_due)
            : Math.max(0, total - advance);
        const label = block.props?.label !== undefined ? block.props.label : "Balance Due: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;

        content = (
          <div className="flex justify-between items-center font-bold text-sm w-full" style={{ color: styles.color || primaryColor }}>
            {showLabel && <span className="mr-2">{label}</span>}
            <span className="ml-auto">{formatLKR(totalDue, invoice?.currency, showCurrency)}</span>
          </div>
        );
        break;
      }

      case "bank_details": {
        const title = block.props?.title || "Bank Details";
        const isInteractive = Boolean(onSelectBlock);
        const accName = block.props?.accName || invoice?.bank_acc_name || (isInteractive ? "ABC Company" : undefined);
        const bankName = block.props?.bankName || invoice?.bank_acc_bank || (isInteractive ? "Bank Name" : undefined);
        const accNumber = block.props?.accNumber || invoice?.bank_acc_number || (isInteractive ? "123456789" : undefined);
        const branch = block.props?.branch || invoice?.bank_acc_branch || (isInteractive ? "City Branch" : undefined);
        if (!accName && !bankName && !accNumber && !branch) {
          content = null;
          break;
        }
        content = (
          <div className="space-y-1 text-xs">
            <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
              {title}
            </div>
            <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
              {accName && <div>A/C Name: {accName}</div>}
              {bankName && <div>Bank: {bankName}</div>}
              {accNumber && <div>A/C No: {accNumber}</div>}
              {branch && <div>Branch: {branch}</div>}
            </div>
          </div>
        );
        break;
      }

      case "notes": {
        const title = block.props?.title || "Notes";
        const noteText = block.props?.content !== undefined && block.props?.content !== ""
          ? block.props.content
          : invoice?.notes;
        if (!noteText) {
          content = null;
          break;
        }
        content = (
          <div className="space-y-1 text-xs">
            <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
              {title}
            </div>
            <div className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{noteText}</div>
          </div>
        );
        break;
      }

      case "terms": {
        const title = block.props?.title || "Terms & Conditions";
        const termsText = block.props?.content !== undefined && block.props?.content !== ""
          ? block.props.content
          : invoice?.terms;
        if (!termsText) {
          content = null;
          break;
        }
        content = (
          <div className="space-y-1 text-xs">
            <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
              {title}
            </div>
            <div className="text-gray-600 dark:text-gray-400 whitespace-pre-line">{termsText}</div>
          </div>
        );
        break;
      }

      case "divider": {
        const color = block.props?.color || "#E5E7EB";
        content = <hr style={{ borderColor: color }} className="my-2 border-t" />;
        break;
      }

      case "spacer": {
        const height = block.props?.height || 16;
        content = <div style={{ height: `${height}px` }} />;
        break;
      }

      case "text_block": {
        const text = block.props?.content || "Static text block. Double-click or select in inspector to edit this message.";
        content = (
          <div className="text-xs whitespace-pre-line leading-relaxed" style={{ color: styles.color }}>
            {text}
          </div>
        );
        break;
      }

      case "image_block": {
        const url = block.props?.url;
        const alt = block.props?.alt || "Custom Image";
        const maxHeight = block.props?.maxHeight || 80;
        const maxWidth = block.props?.maxWidth || 180;
        content = url ? (
          <img
            src={url}
            alt={alt}
            style={{
              maxHeight: `${maxHeight}px`,
              maxWidth: `${maxWidth}px`,
              objectFit: "contain",
              display: "inline-block",
            }}
          />
        ) : (
          <div className="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-3 text-center text-xs text-gray-400">
            [ Custom Image / Stamp / QR ]
          </div>
        );
        break;
      }

      case "custom_field": {
        const key = block.props?.fieldKey;
        const label = block.props?.label || key || "Custom Field";
        const val = invoice?.custom_field_values?.[key] || block.props?.defaultValue || "—";
        content = (
          <div className="text-xs">
            <span className="text-gray-500 font-medium">{label}: </span>
            <span className="font-semibold text-foreground">{String(val)}</span>
          </div>
        );
        break;
      }

      case "signature": {
        const label = block.props?.label || "Authorized Signature";
        const signUrl = block.props?.signatureImageUrl;
        content = (
          <div className="inline-block pt-4 text-center text-xs">
            {signUrl ? (
              <img
                src={signUrl}
                alt="Signature"
                style={{ maxHeight: "40px", objectFit: "contain" }}
                className="mx-auto mb-1"
              />
            ) : null}
            <div className="border-t border-gray-400 min-w-[160px] pt-1 text-gray-600 font-medium">
              {label}
            </div>
            {block.props?.subtext && (
              <div className="text-[10px] text-gray-400">{block.props.subtext}</div>
            )}
          </div>
        );
        break;
      }

      default:
        content = <div className="text-xs text-gray-400">[ {block.type} ]</div>;
    }

    const isAbsolute = block.x !== undefined && block.y !== undefined;

    const wrapperStyle: React.CSSProperties = isAbsolute
      ? {
        position: "absolute",
        left: `${block.x}mm`,
        top: `${block.y}mm`,
        width: block.width ? `${block.width}mm` : undefined,
        zIndex: isSelected ? 40 : block.zIndex || 20,
        ...blockStyle,
      }
      : {
        ...blockStyle,
      };

    return (
      <div
        key={block.id}
        onMouseDown={(e) => {
          if (onBlockDragStart && isAbsolute) {
            onBlockDragStart(e, block);
          }
        }}
        onClick={(e) => {
          if (onSelectBlock) {
            e.stopPropagation();
            onSelectBlock(block.id);
          }
        }}
        style={wrapperStyle}
        className={`transition-shadow ${onSelectBlock
            ? isAbsolute
              ? "cursor-move hover:ring-2 hover:ring-brand-500/70 select-none"
              : "cursor-pointer hover:ring-1 hover:ring-brand-500/50 rounded-sm select-none relative"
            : isAbsolute
              ? ""
              : "relative"
          } ${isSelected ? "ring-2 ring-brand-500 shadow-md" : ""}`}
      >
        {/* Photoshop-like coordinate tag badge */}
        {onSelectBlock && isSelected && isAbsolute && (
          <div className="absolute -top-6 left-0 flex items-center gap-1.5 bg-brand-500 text-brand-950 font-bold text-[9px] px-2 py-0.5 rounded shadow-sm pointer-events-none whitespace-nowrap z-50">
            <span>X: {Math.round(block.x!)}mm</span>
            <span>•</span>
            <span>Y: {Math.round(block.y!)}mm</span>
            {block.width && (
              <>
                <span>•</span>
                <span>W: {Math.round(block.width)}mm</span>
              </>
            )}
          </div>
        )}

        {/* Content */}
        {content}

        {/* Resize handle at bottom-right corner */}
        {onSelectBlock && isSelected && isAbsolute && onBlockResizeStart && (
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              onBlockResizeStart(e, block);
            }}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-brand-500 border-2 border-white rounded-full cursor-nwse-resize shadow-md z-50 hover:scale-125 transition-transform"
            title="Drag to resize width"
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: "top center",
      }}
      className={`relative bg-white text-gray-900 shadow-lg select-none transition-transform ${className}`}
    >
      <div
        ref={paperRef}
        onDrop={onCanvasDrop}
        onDragOver={onCanvasDragOver}
        style={{
          width: `${paperWidthMm}mm`,
          minHeight: `${minHeightMm}mm`,
          paddingTop: hasAbsoluteBlocks && !hasFlowBlocks ? 0 : `${margins.top}mm`,
          paddingRight: hasAbsoluteBlocks && !hasFlowBlocks ? 0 : `${margins.right}mm`,
          paddingBottom: hasAbsoluteBlocks && !hasFlowBlocks ? 0 : `${margins.bottom}mm`,
          paddingLeft: hasAbsoluteBlocks && !hasFlowBlocks ? 0 : `${margins.left}mm`,
          fontFamily: currentFontFamily,
          fontSize: `${theme.baseFontSize}pt`,
          backgroundColor: theme.backgroundColor || "#ffffff",
        }}
        className={`flex flex-col justify-between relative overflow-hidden transition-all ${dragOverActive ? "ring-4 ring-brand-500 ring-offset-2" : ""
          }`}
      >
        {/* Background Stationery / Letterhead Template Image */}
        {theme.backgroundImage && (
          <div
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `url(${theme.backgroundImage})`,
              backgroundSize: theme.backgroundFit === 'fill' ? '100% 100%' : theme.backgroundFit || 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: theme.backgroundOpacity !== undefined ? theme.backgroundOpacity : 1,
            }}
          />
        )}

        {/* Freeform Absolute Blocks Layer (Photoshop layers) */}
        {allAbsoluteBlocks.map((block: LayoutBlock) => renderBlock(block))}

        {/* Main Content Sections (for flow blocks) */}
        <div className="space-y-4 flex-1 relative z-10">
          {layout.sections.map((section: SectionRow) => (
            <div
              key={section.id}
              style={{
                paddingTop: section.paddingTop ? `${section.paddingTop}px` : undefined,
                paddingBottom: section.paddingBottom ? `${section.paddingBottom}px` : undefined,
              }}
              className="grid grid-cols-12 gap-4 items-start"
            >
              {section.columns.map((col: SectionColumn) => {
                const colSpan = Math.min(12, Math.max(1, col.widthRatio || 12));
                const flowBlocks = col.blocks.filter((b) => b.x === undefined || b.y === undefined);
                return (
                  <div
                    key={col.id}
                    style={{ gridColumn: `span ${colSpan} / span ${colSpan}` }}
                    className="space-y-3"
                  >
                    {flowBlocks.map((block: LayoutBlock) => renderBlock(block))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Free Plan System Footer (Non-removable system watermark for Free plan) */}
        {plan === "Free" && (
          <div className="pt-6 pb-2 text-center border-t border-gray-200 mt-6 text-[8pt] text-gray-400 select-none">
            <span>Generated by </span>
            <span className="font-semibold text-gray-600">Framebooks</span>
            <span> • </span>
            <span className="text-blue-500 font-medium">framebooks.com</span>
          </div>
        )}
      </div>
    </div>
  );
}
