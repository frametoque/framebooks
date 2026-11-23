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

const getCurrencyParts = (amount: number | string, currency = "LKR", showCurrency = true) => {
  const num = typeof amount === "number" ? amount : parseFloat(amount || "0");
  const formatted = isNaN(num)
    ? "0.00"
    : new Intl.NumberFormat("en-LK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
  const symbol = showCurrency ? (currency === "LKR" ? "Rs." : currency) : "";
  return { symbol, formatted };
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
    const isInteractive = Boolean(onSelectBlock);

    const blockStyle: React.CSSProperties = {
      color: textColor,
      textAlign: styles.align || "left",
      paddingTop: styles.paddingTop ? `${styles.paddingTop}px` : undefined,
      paddingBottom: styles.paddingBottom ? `${styles.paddingBottom}px` : undefined,
      fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
      fontWeight: styles.fontWeight || undefined,
      fontFamily: styles.fontFamily || undefined,
      fontStyle: styles.fontStyle || undefined,
    };

    let content: React.ReactNode = null;

    switch (block.type) {
      case "logo": {
        const logoUrl = tenantInfo?.logo_url ? tenantInfo.logo_url.trim().replace(/^http:\/\//i, "https://") : null;
        const maxHeight = block.props?.maxHeight || 50;
        content = logoUrl ? (
          <img
            src={logoUrl}
            alt="Business Logo"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
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
        const busWeight = styles.fontWeight || "bold";
        const busStyle = styles.fontStyle || "normal";
        content = (
          <div
            style={{
              color: styles.color || primaryColor,
              fontWeight: busWeight,
              fontStyle: busStyle,
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
            }}
            className="text-xl leading-tight"
          >
            {name}
          </div>
        );
        break;
      }

      case "business_address": {
        const label = block.props?.label !== undefined ? block.props.label : "";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const address = block.props?.address || tenantInfo?.address || (isInteractive ? "123 Business Street, Colombo 03" : "");
        if (!address) {
          content = null;
          break;
        }
        const addrWeight = styles.fontWeight || "normal";
        const addrStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs whitespace-pre-line leading-normal"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: addrWeight,
              fontStyle: addrStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{address}</span>
          </div>
        );
        break;
      }

      case "business_phone": {
        const label = block.props?.label !== undefined ? block.props.label : "Tel: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const phone = block.props?.phone || tenantInfo?.phone || (isInteractive ? "+94 11 234 5678" : "");
        if (!phone) {
          content = null;
          break;
        }
        const phoneWeight = styles.fontWeight || "normal";
        const phoneStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: phoneWeight,
              fontStyle: phoneStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{phone}</span>
          </div>
        );
        break;
      }

      case "business_email": {
        const label = block.props?.label !== undefined ? block.props.label : "Email: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const email = block.props?.email || tenantInfo?.email || (isInteractive ? "billing@company.com" : "");
        if (!email) {
          content = null;
          break;
        }
        const emailWeight = styles.fontWeight || "normal";
        const emailStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: emailWeight,
              fontStyle: emailStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{email}</span>
          </div>
        );
        break;
      }

      case "business_website": {
        const label = block.props?.label !== undefined ? block.props.label : "Web: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const website = block.props?.website || tenantInfo?.website || (isInteractive ? "www.company.com" : "");
        if (!website) {
          content = null;
          break;
        }
        const webWeight = styles.fontWeight || "normal";
        const webStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: webWeight,
              fontStyle: webStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{website}</span>
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
          <div
            className="text-xs space-y-0.5"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: styles.fontWeight,
              fontStyle: styles.fontStyle,
            }}
          >
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
        const titleWeight = styles.fontWeight || "bold";
        const titleStyle = styles.fontStyle || "normal";
        content = (
          <div
            style={{
              color: styles.color || primaryColor,
              fontWeight: titleWeight,
              fontStyle: titleStyle,
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
            }}
            className="text-2xl tracking-tight"
          >
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
        const valWeight = styles.fontWeight || "bold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{invNo}</span>
          </div>
        );
        break;
      }

      case "invoice_date": {
        const label = block.props?.label !== undefined ? block.props.label : "Date: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const dateVal = formatDate(invoice?.date);
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{dateVal}</span>
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
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{dueVal}</span>
          </div>
        );
        break;
      }

      case "client_header": {
        const label = block.props?.label !== undefined ? block.props.label : "Bill To:";
        const headWeight = styles.fontWeight || "bold";
        const headStyle = styles.fontStyle || "normal";
        content = (
          <div
            style={{
              color: styles.color || primaryColor,
              fontWeight: headWeight,
              fontStyle: headStyle,
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
            }}
            className="text-xs uppercase tracking-wider"
          >
            {label}
          </div>
        );
        break;
      }

      case "client_name": {
        const label = block.props?.label !== undefined ? block.props.label : "";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const clientName =
          block.props?.clientName ||
          invoice?.client_name ||
          invoice?.legal_name ||
          invoice?.client?.full_name ||
          invoice?.client?.name ||
          invoice?.user_email ||
          (isInteractive ? "Company Name" : "");
        if (!clientName) {
          content = null;
          break;
        }
        const nameWeight = styles.fontWeight || "bold";
        const nameStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-sm leading-normal"
            style={{ color: styles.color || textColor, fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}
          >
            {showLabel && <span className="text-gray-500 text-xs font-normal mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span style={{ fontWeight: nameWeight, fontStyle: nameStyle }}>{clientName}</span>
          </div>
        );
        break;
      }

      case "client_address": {
        const label = block.props?.label !== undefined ? block.props.label : "";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const billingAddress =
          block.props?.billingAddress ||
          invoice?.billing_address ||
          invoice?.client_address ||
          invoice?.client?.address ||
          invoice?.client?.billing_address ||
          (invoice?.client_phone ? `Tel: ${invoice.client_phone}` : "") ||
          (invoice?.client_email ? invoice.client_email : "") ||
          (isInteractive ? "Client Address" : "");
        if (!billingAddress) {
          content = null;
          break;
        }
        const addrWeight = styles.fontWeight || "normal";
        const addrStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs whitespace-pre-line leading-normal"
            style={{
              color: styles.color || "#4b5563",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: addrWeight,
              fontStyle: addrStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{billingAddress}</span>
          </div>
        );
        break;
      }

      case "client_email": {
        const label = block.props?.label !== undefined ? block.props.label : "Email: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const clientEmail =
          block.props?.clientEmail ||
          invoice?.client_email ||
          invoice?.user_email ||
          invoice?.client?.email ||
          (isInteractive ? "billing@company.com" : "");
        if (!clientEmail) {
          content = null;
          break;
        }
        const emailWeight = styles.fontWeight || "normal";
        const emailStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{
              color: styles.color || "#6b7280",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: emailWeight,
              fontStyle: emailStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{clientEmail}</span>
          </div>
        );
        break;
      }

      case "client_phone": {
        const label = block.props?.label !== undefined ? block.props.label : "Phone: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const clientPhone =
          block.props?.clientPhone ||
          invoice?.client_phone ||
          invoice?.client?.phone ||
          (isInteractive ? "+1 (555) 019-2834" : "");
        if (!clientPhone) {
          content = null;
          break;
        }
        const phoneWeight = styles.fontWeight || "normal";
        const phoneStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{
              color: styles.color || "#6b7280",
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              fontWeight: phoneWeight,
              fontStyle: phoneStyle,
            }}
          >
            {showLabel && <span className="text-gray-500 font-medium mr-1.5" style={{ fontStyle: "normal" }}>{label}</span>}
            <span>{clientPhone}</span>
          </div>
        );
        break;
      }

      case "bill_to": {
        const label = block.props?.label || "Bill To:";
        const clientName =
          block.props?.clientName ||
          invoice?.client_name ||
          invoice?.legal_name ||
          invoice?.client?.full_name ||
          invoice?.client?.name ||
          invoice?.user_email ||
          (isInteractive ? "Company Name" : "");
        const billingAddress =
          block.props?.billingAddress ||
          invoice?.billing_address ||
          invoice?.client_address ||
          invoice?.client?.address ||
          invoice?.client?.billing_address ||
          (invoice?.client_phone ? `Tel: ${invoice.client_phone}` : "") ||
          (invoice?.client_email ? invoice.client_email : "") ||
          (isInteractive ? "Client Address" : undefined);
        const clientEmail =
          block.props?.clientEmail ||
          invoice?.client_email ||
          invoice?.user_email ||
          invoice?.client?.email;
        content = (
          <div className="space-y-1" style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}>
            <div style={{ color: primaryColor }} className="font-bold text-xs uppercase tracking-wider">
              {label}
            </div>
            <div className="text-xs space-y-0.5">
              <div style={{ color: styles.color || textColor, fontWeight: styles.fontWeight || "bold", fontStyle: styles.fontStyle || "normal" }} className="text-sm">
                {clientName}
              </div>
              {billingAddress && (
                <div className="text-gray-600 whitespace-pre-line">{billingAddress}</div>
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
        const valWeight = styles.fontWeight || "bold";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div className="space-y-0.5">
            {Boolean(label) && (
              <div style={{ color: primaryColor }} className="font-bold text-xs uppercase tracking-wider">
                {label}
              </div>
            )}
            <div
              style={{
                color: styles.color || primaryColor,
                fontWeight: valWeight,
                fontStyle: valStyle,
                fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              }}
              className="text-xl"
            >
              {formatLKR(calculatedTotalDue, invoice?.currency)}
            </div>
          </div>
        );
        break;
      }

      case "items_table": {
        const rawItems = invoice?.items;
        const allItems = Array.isArray(rawItems)
          ? rawItems
          : typeof rawItems === "string"
            ? JSON.parse(rawItems || "[]")
            : [];
        const limit = block.props?.maxItems ?? layout?.lineItemsLimit;
        const items = limit && limit > 0 ? allItems.slice(0, limit) : allItems;
        const isStriped = Boolean(block.props?.striped);
        const showHeader = block.props?.showHeader !== false;
        const showBorder = block.props?.showBorder !== false;
        const rowHeight = block.props?.rowHeightMm ? Number(block.props.rowHeightMm) : undefined;

        content = (
          <div className={`w-full overflow-hidden ${showBorder ? "rounded-md border border-gray-200" : ""}`}>
            <table className="w-full text-left text-xs border-collapse">
              {showHeader && (
                <thead>
                  <tr className="bg-gray-100 font-semibold" style={{ color: primaryColor }}>
                    <th className="py-2 px-3">Description</th>
                    <th className="py-2 px-3 text-right">Price</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
              )}
              <tbody className={showBorder ? "divide-y divide-gray-200" : ""}>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 px-3 text-center text-gray-400">
                      No line items
                    </td>
                  </tr>
                ) : (
                  items.map((it: any, idx: number) => {
                    const qty = Number(it.quantity || it.qty) || 1;
                    const rowStyle = rowHeight ? { height: `${rowHeight}mm` } : undefined;
                    return (
                      <tr
                        key={idx}
                        style={rowStyle}
                        className={isStriped && idx % 2 === 1 ? "bg-gray-50/70" : ""}
                      >
                        <td className="py-2 px-3 font-medium" style={{ color: styles.color || textColor, fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, fontFamily: styles.fontFamily, fontWeight: styles.fontWeight }}>
                          {it.description || `Line Item ${idx + 1}`}
                        </td>
                        <td
                          className="py-2 px-3 text-right tabular-nums"
                          style={{
                            color: styles.color || "#6b7280",
                            fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
                            fontFamily: styles.fontFamily,
                            fontVariantNumeric: "tabular-nums",
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
                          {qty > 1 ? `${qty} × ` : ""}
                          {formatLKR(it.price, invoice?.currency)}
                        </td>
                        <td
                          className="py-2 px-3 text-right font-semibold tabular-nums"
                          style={{
                            color: styles.color || textColor,
                            fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
                            fontFamily: styles.fontFamily,
                            fontWeight: styles.fontWeight,
                            fontVariantNumeric: "tabular-nums",
                            fontFeatureSettings: '"tnum"',
                          }}
                        >
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

      case "items_col_desc":
      case "items_col_qty":
      case "items_col_price":
      case "items_col_amount": {
        const rawItems = invoice?.items;
        const allItems = Array.isArray(rawItems)
          ? rawItems
          : typeof rawItems === "string"
            ? JSON.parse(rawItems || "[]")
            : [];
        const limit = block.props?.maxItems ?? layout?.lineItemsLimit;
        const items = limit && limit > 0 ? allItems.slice(0, limit) : allItems;
        const showHeader = block.props?.showHeader === true;
        const rowHeight = block.props?.rowHeightMm ? Number(block.props.rowHeightMm) : 7;
        const defaultTitle = block.type === "items_col_desc" ? "Description"
          : block.type === "items_col_qty" ? "Qty"
          : block.type === "items_col_price" ? "Price"
          : "Total";
        const headerText = block.props?.headerLabel !== undefined ? block.props.headerLabel : defaultTitle;

        const isSingleItem = block.props?.itemIndex !== undefined;
        const itemIndex = isSingleItem ? Number(block.props.itemIndex) : 0;

        const itemTextStyle: React.CSSProperties = {
          fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
          fontFamily: styles.fontFamily || undefined,
          fontWeight: styles.fontWeight || undefined,
          fontStyle: styles.fontStyle || undefined,
          color: styles.color || textColor,
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum"',
        };

        const renderCurrencyCell = (
          amount: number | string,
          align: "left" | "center" | "right" | undefined
        ) => {
          const { symbol, formatted } = getCurrencyParts(amount, invoice?.currency);
          const effectiveAlign = align || "right";

          if (effectiveAlign === "left") {
            return (
              <div
                className="w-full flex items-center justify-start tabular-nums gap-1"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  gap: "0.25rem",
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {Boolean(symbol) && (
                  <span style={itemTextStyle} className="shrink-0 select-none">
                    {symbol}
                  </span>
                )}
                <span
                  style={{
                    ...itemTextStyle,
                    fontVariantNumeric: "tabular-nums",
                    fontFeatureSettings: '"tnum"',
                    textAlign: "left",
                  }}
                  className="tabular-nums text-left"
                >
                  {formatted}
                </span>
              </div>
            );
          }

          if (effectiveAlign === "center") {
            return (
              <div
                className="w-full flex items-center justify-center tabular-nums gap-1"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.25rem",
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum"',
                }}
              >
                {Boolean(symbol) && (
                  <span style={itemTextStyle} className="shrink-0 select-none">
                    {symbol}
                  </span>
                )}
                <span
                  style={{
                    ...itemTextStyle,
                    fontVariantNumeric: "tabular-nums",
                    fontFeatureSettings: '"tnum"',
                  }}
                  className="tabular-nums text-center"
                >
                  {formatted}
                </span>
              </div>
            );
          }

          return (
            <div
              className="w-full flex items-center justify-end tabular-nums gap-1"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "0.25rem",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {Boolean(symbol) && (
                <span style={itemTextStyle} className="shrink-0 select-none">
                  {symbol}
                </span>
              )}
              <span
                style={{
                  ...itemTextStyle,
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum"',
                  textAlign: "right",
                }}
                className="tabular-nums text-right"
              >
                {formatted}
              </span>
            </div>
          );
        };

        const alignStyle = styles.align === "left"
          ? "flex-start"
          : styles.align === "center"
            ? "center"
            : styles.align === "right"
              ? "flex-end"
              : (block.type === "items_col_desc" ? "flex-start" : "flex-end");

        if (isSingleItem) {
          // Render ONLY this specific line item
          const it = items[itemIndex] || (isInteractive ? {
            description: `Line Item ${itemIndex + 1}`,
            quantity: 1,
            price: itemIndex === 0 ? 180000 : itemIndex === 1 ? 120000 : itemIndex === 2 ? 50000 : 0,
            total: itemIndex === 0 ? 180000 : itemIndex === 1 ? 120000 : itemIndex === 2 ? 50000 : 0,
          } : null);

          if (!it) {
            content = isInteractive ? (
              <div className="text-[10px] text-gray-400 italic">Line Item {itemIndex + 1}</div>
            ) : null;
            break;
          }

          const qty = Number(it.quantity || it.qty) || 1;
          const price = Number(it.price || it.rate) || 0;
          const total = it.total !== undefined ? Number(it.total) : qty * price;

          content = (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: alignStyle,
                width: "100%",
                height: "100%",
                minHeight: `${rowHeight}mm`,
              }}
            >
              {block.type === "items_col_desc" && (
                <span style={itemTextStyle} className="w-full">
                  {it.description || `Line Item ${itemIndex + 1}`}
                </span>
              )}
              {block.type === "items_col_qty" && (
                <span
                  style={{
                    ...itemTextStyle,
                    width: "100%",
                    textAlign: styles.align || "center",
                  }}
                  className="tabular-nums"
                >
                  {qty}
                </span>
              )}
              {block.type === "items_col_price" && renderCurrencyCell(price, styles.align)}
              {block.type === "items_col_amount" && renderCurrencyCell(total, styles.align)}
            </div>
          );
          break;
        }

        // Grouped column mode
        content = (
          <div className="text-xs leading-normal w-full" style={{ width: "100%" }}>
            {showHeader && Boolean(headerText) && (
              <div
                className="font-bold uppercase tracking-wider text-[11px] pb-1 mb-1 border-b border-gray-200"
                style={{
                  color: styles.color || primaryColor,
                  textAlign: styles.align || (block.type === "items_col_desc" ? "left" : "right"),
                  fontFamily: styles.fontFamily,
                }}
              >
                {headerText}
              </div>
            )}
            <div className="space-y-0 w-full" style={{ width: "100%" }}>
              {items.length === 0 ? (
                <div className="text-gray-400 italic py-1 text-center">No items</div>
              ) : (
                items.map((it: any, idx: number) => {
                  const qty = Number(it.quantity || it.qty) || 1;
                  const price = Number(it.price || it.rate) || 0;
                  const total = it.total !== undefined ? Number(it.total) : qty * price;
                  return (
                    <div
                      key={idx}
                      style={{
                        minHeight: `${rowHeight}mm`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: alignStyle,
                        width: "100%",
                      }}
                      className="py-0.5 w-full"
                    >
                      {block.type === "items_col_desc" && (
                        <span style={itemTextStyle} className="w-full truncate">
                          {it.description || `Line Item ${idx + 1}`}
                        </span>
                      )}
                      {block.type === "items_col_qty" && (
                        <span
                          style={{
                            ...itemTextStyle,
                            width: "100%",
                            textAlign: styles.align || "center",
                          }}
                          className="tabular-nums"
                        >
                          {qty}
                        </span>
                      )}
                      {block.type === "items_col_price" && renderCurrencyCell(price, styles.align)}
                      {block.type === "items_col_amount" && renderCurrencyCell(total, styles.align)}
                    </div>
                  );
                })
              )}
            </div>
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
              <span className="font-semibold tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>{formatLKR(subtotal, invoice?.currency)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount:</span>
                <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>− {formatLKR(discount, invoice?.currency)}</span>
              </div>
            )}
            {taxRate > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Tax ({taxRate}%):</span>
                <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>+ {formatLKR((subtotal * taxRate) / 100, invoice?.currency)}</span>
              </div>
            )}
            {advance > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Advance Paid:</span>
                <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>− {formatLKR(advance, invoice?.currency)}</span>
              </div>
            )}
            <div className="border-t border-gray-300 pt-1 flex justify-between font-bold text-sm" style={{ color: primaryColor }}>
              <span>Total:</span>
              <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>{formatLKR(total, invoice?.currency)}</span>
            </div>
            <div className="flex justify-between font-bold text-base pt-0.5" style={{ color: primaryColor }}>
              <span>Amount Due:</span>
              <span className="tabular-nums" style={{ fontVariantNumeric: "tabular-nums", fontFeatureSettings: '"tnum"' }}>{formatLKR(totalDue, invoice?.currency)}</span>
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
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="flex justify-between items-center text-xs w-full"
            style={{
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              color: styles.color,
            }}
          >
            {showLabel && <span className="text-gray-500 mr-2" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span
              className="ml-auto tabular-nums text-right"
              style={{
                fontWeight: valWeight,
                fontStyle: valStyle,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {formatLKR(subtotal, invoice?.currency, showCurrency)}
            </span>
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
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="flex justify-between items-center text-xs text-red-600 w-full"
            style={{
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              color: styles.color || "#dc2626",
            }}
          >
            {showLabel && <span className="mr-2" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span
              className="ml-auto tabular-nums text-right"
              style={{
                fontWeight: valWeight,
                fontStyle: valStyle,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {prefix}{formatLKR(discount, invoice?.currency, showCurrency)}
            </span>
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
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="flex justify-between items-center text-xs w-full"
            style={{
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              color: styles.color,
            }}
          >
            {showLabel && <span className="text-gray-500 mr-2" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span
              className="ml-auto tabular-nums text-right"
              style={{
                fontWeight: valWeight,
                fontStyle: valStyle,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {prefix}{formatLKR(taxAmount, invoice?.currency, showCurrency)}
            </span>
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
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";

        content = (
          <div
            className="flex justify-between items-center text-xs text-emerald-600 w-full"
            style={{
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
              color: styles.color || "#059669",
            }}
          >
            {showLabel && <span className="mr-2" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span
              className="ml-auto tabular-nums text-right"
              style={{
                fontWeight: valWeight,
                fontStyle: valStyle,
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {prefix}{formatLKR(advance, invoice?.currency, showCurrency)}
            </span>
          </div>
        );
        break;
      }

      case "total_invoice": {
        const total = Number(invoice?.total || 0);
        const label = block.props?.label !== undefined ? block.props.label : "Total: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const showCurrency = block.props?.showCurrency !== false;
        const valWeight = styles.fontWeight || "bold";
        const valStyle = styles.fontStyle || "normal";
        const fontSizePt = styles.fontSize ? `${styles.fontSize}pt` : undefined;

        content = (
          <div
            className="flex justify-between items-center w-full"
            style={{
              color: styles.color || primaryColor,
              fontWeight: valWeight,
              fontStyle: valStyle,
              fontSize: fontSizePt,
            }}
          >
            {showLabel && <span className="mr-2" style={{ fontStyle: "normal", fontWeight: "normal", fontSize: fontSizePt }}>{label}</span>}
            <span
              className={`tabular-nums ${showLabel ? "ml-auto" : ""}`}
              style={{
                fontSize: fontSizePt,
                width: showLabel ? undefined : "100%",
                textAlign: styles.align || "right",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {formatLKR(total, invoice?.currency, showCurrency)}
            </span>
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
        const valWeight = styles.fontWeight || "bold";
        const valStyle = styles.fontStyle || "normal";
        const fontSizePt = styles.fontSize ? `${styles.fontSize}pt` : undefined;

        content = (
          <div
            className="flex justify-between items-center w-full"
            style={{
              color: styles.color || primaryColor,
              fontWeight: valWeight,
              fontStyle: valStyle,
              fontSize: fontSizePt,
            }}
          >
            {showLabel && <span className="mr-2" style={{ fontStyle: "normal", fontWeight: "normal", fontSize: fontSizePt }}>{label}</span>}
            <span
              className={`tabular-nums ${showLabel ? "ml-auto" : ""}`}
              style={{
                fontSize: fontSizePt,
                width: showLabel ? undefined : "100%",
                textAlign: styles.align || "right",
                fontVariantNumeric: "tabular-nums",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {formatLKR(totalDue, invoice?.currency, showCurrency)}
            </span>
          </div>
        );
        break;
      }

      case "bank_name": {
        const label = block.props?.label !== undefined ? block.props.label : "Bank: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const bankName = block.props?.bankName || invoice?.bank_acc_bank || (isInteractive ? "Commercial Bank" : "");
        if (!bankName) {
          content = null;
          break;
        }
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{bankName}</span>
          </div>
        );
        break;
      }

      case "bank_acc_name": {
        const label = block.props?.label !== undefined ? block.props.label : "A/C Name: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const accName = block.props?.accName || invoice?.bank_acc_name || (isInteractive ? "My Business Ltd" : "");
        if (!accName) {
          content = null;
          break;
        }
        const valWeight = styles.fontWeight || "normal";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{accName}</span>
          </div>
        );
        break;
      }

      case "bank_acc_number": {
        const label = block.props?.label !== undefined ? block.props.label : "A/C No: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const accNumber = block.props?.accNumber || invoice?.bank_acc_number || (isInteractive ? "1000982345" : "");
        if (!accNumber) {
          content = null;
          break;
        }
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span className="font-mono" style={{ fontWeight: valWeight, fontStyle: valStyle }}>{accNumber}</span>
          </div>
        );
        break;
      }

      case "bank_branch": {
        const label = block.props?.label !== undefined ? block.props.label : "Branch: ";
        const showLabel = block.props?.showLabel !== false && Boolean(label);
        const branch = block.props?.branch || invoice?.bank_acc_branch || (isInteractive ? "City Branch / CCEYLKLX" : "");
        if (!branch) {
          content = null;
          break;
        }
        const valWeight = styles.fontWeight || "normal";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="text-xs leading-normal"
            style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined, color: styles.color }}
          >
            {showLabel && <span className="text-gray-500 mr-1.5" style={{ fontStyle: "normal", fontWeight: "normal" }}>{label}</span>}
            <span style={{ fontWeight: valWeight, fontStyle: valStyle }}>{branch}</span>
          </div>
        );
        break;
      }

      case "bank_details": {
        const title = block.props?.title || "Bank Details";
        const isInteractive = Boolean(onSelectBlock);
        const accName = block.props?.accName || invoice?.bank_acc_name || (isInteractive ? "Company Name" : undefined);
        const bankName = block.props?.bankName || invoice?.bank_acc_bank || (isInteractive ? "Bank Name" : undefined);
        const accNumber = block.props?.accNumber || invoice?.bank_acc_number || (isInteractive ? "123456789" : undefined);
        const branch = block.props?.branch || invoice?.bank_acc_branch || (isInteractive ? "City Branch" : undefined);
        if (!accName && !bankName && !accNumber && !branch) {
          content = null;
          break;
        }
        content = (
          <div className="space-y-1 text-xs" style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}>
            <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
              {title}
            </div>
            <div
              className="space-y-0.5"
              style={{
                color: styles.color || "#4b5563",
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
              }}
            >
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
          <div className="space-y-1 text-xs" style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}>
            {Boolean(title) && (
              <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
                {title}
              </div>
            )}
            <div
              className="whitespace-pre-line"
              style={{
                color: styles.color || "#4b5563",
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
              }}
            >
              {noteText}
            </div>
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
          <div className="space-y-1 text-xs" style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}>
            {Boolean(title) && (
              <div style={{ color: primaryColor }} className="font-bold uppercase tracking-wider">
                {title}
              </div>
            )}
            <div
              className="whitespace-pre-line"
              style={{
                color: styles.color || "#4b5563",
                fontWeight: styles.fontWeight,
                fontStyle: styles.fontStyle,
              }}
            >
              {termsText}
            </div>
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
        const textWeight = styles.fontWeight || "normal";
        const textStyle = styles.fontStyle || "normal";
        content = (
          <div
            className="whitespace-pre-line leading-relaxed text-xs"
            style={{
              color: styles.color,
              fontWeight: textWeight,
              fontStyle: textStyle,
              fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined,
            }}
          >
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
            crossOrigin="anonymous"
            style={{
              maxHeight: `${maxHeight}px`,
              maxWidth: `${maxWidth}px`,
              objectFit: "contain",
              display: "inline-block",
            }}
          />
        ) : (
          <div className="border border-dashed border-gray-300 rounded-lg p-3 text-center text-xs text-gray-400">
            [ Custom Image / Stamp / QR ]
          </div>
        );
        break;
      }

      case "custom_field": {
        const key = block.props?.fieldKey;
        const label = block.props?.label || key || "Custom Field";
        const val = invoice?.custom_field_values?.[key] || block.props?.defaultValue || "—";
        const valWeight = styles.fontWeight || "semibold";
        const valStyle = styles.fontStyle || "normal";
        content = (
          <div className="text-xs" style={{ fontSize: styles.fontSize ? `${styles.fontSize}pt` : undefined }}>
            <span className="text-gray-500 font-medium" style={{ fontStyle: "normal" }}>{label}: </span>
            <span style={{ color: styles.color || textColor, fontWeight: valWeight, fontStyle: valStyle }}>{String(val)}</span>
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
                crossOrigin="anonymous"
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
        color: theme.textColor || "#222222",
      }}
      className={`relative bg-white text-gray-900 shadow-lg select-none [color-scheme:light] ${className}`}
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
            className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
            style={{
              backgroundImage: `url("${theme.backgroundImage}")`,
              backgroundSize: theme.backgroundFit === 'fill' ? '100% 100%' : theme.backgroundFit || 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: theme.backgroundOpacity !== undefined ? theme.backgroundOpacity : 1,
            }}
          >
            <img
              src={theme.backgroundImage}
              alt=""
              crossOrigin="anonymous"
              className="w-full h-full pointer-events-none"
              style={{
                objectFit: theme.backgroundFit === 'fill' ? 'fill' : theme.backgroundFit === 'contain' ? 'contain' : 'cover',
                objectPosition: 'center',
                opacity: theme.backgroundOpacity !== undefined ? theme.backgroundOpacity : 1,
                display: 'block',
              }}
            />
          </div>
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
