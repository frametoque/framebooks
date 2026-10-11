// src/lib/invoice-layout/export-pdf.ts
"use client";

import domtoimage from "dom-to-image-more";
import { jsPDF } from "jspdf";
import { createRoot } from "react-dom/client";
import React from "react";
import { InvoiceRenderer } from "./renderer";
import { InvoiceLayoutDefinition } from "./types";
import { generateInvoicePDF } from "@/lib/generateInvoicePDF";

interface DownloadInvoiceOptions {
  invoice: any;
  tenantInfo?: any;
  plan?: string;
  layoutDef?: InvoiceLayoutDefinition | null;
  fileName?: string;
}

/**
 * Downloads an invoice as a PDF.
 * If an active layout is configured in settings or attached to the invoice,
 * it renders and exports that bespoke layout.
 * Otherwise, it falls back to the Standard Classic PDF generator.
 */
export async function downloadInvoiceWithLayout({
  invoice,
  tenantInfo,
  plan = "Free",
  layoutDef,
  fileName,
}: DownloadInvoiceOptions): Promise<void> {
  const resolvedLayout =
    layoutDef ||
    invoice?.layout_snapshot ||
    invoice?.active_layout_definition ||
    null;

  const defaultFilename = `${
    invoice.invoice_number || invoice.invoice_id || "invoice"
  }.pdf`;
  const targetFilename = fileName || defaultFilename;

  // If no custom active layout exists, use standard classic generator
  if (!resolvedLayout) {
    const pdfBytes = await generateInvoicePDF(invoice, plan, tenantInfo);
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = targetFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
    return;
  }

  // Render the active layout in an off-screen container to capture exact styles
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(InvoiceRenderer, {
          layout: resolvedLayout,
          invoice,
          tenantInfo,
          plan,
        })
      );
      // Allow DOM repaint and fonts/images to resolve
      setTimeout(resolve, 300);
    });

    const targetEl = (container.firstElementChild || container) as HTMLElement;
    const isLetter = resolvedLayout.pageSize === "Letter";
    const paperWidthMm = isLetter ? 215.9 : 210;
    const minPaperHeightMm = isLetter ? 279.4 : 297;

    const imgData = await domtoimage.toPng(targetEl, {
      bgcolor: resolvedLayout.theme?.backgroundColor || "#ffffff",
      quality: 1.0,
      width: targetEl.offsetWidth * 2,
      height: targetEl.offsetHeight * 2,
      style: {
        transform: "scale(2)",
        transformOrigin: "top left",
        width: `${targetEl.offsetWidth}px`,
        height: `${targetEl.offsetHeight}px`,
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: isLetter ? "letter" : "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (targetEl.offsetHeight * pdfWidth) / targetEl.offsetWidth;

    pdf.addImage(
      imgData,
      "PNG",
      0,
      0,
      pdfWidth,
      Math.max(pdfHeight, minPaperHeightMm)
    );
    pdf.save(targetFilename);
  } finally {
    try {
      root.unmount();
    } catch {}
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Triggers direct browser printing for a PDF Blob via a hidden iframe
 * with automatic popup fallback if needed.
 */
export function printPdfBlob(blob: Blob): void {
  const blobUrl = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.src = blobUrl;
  document.body.appendChild(iframe);

  let printed = false;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      printed = true;
    } catch (e) {
      console.warn("Iframe print blocked, opening window:", e);
    }
  };

  setTimeout(() => {
    if (!printed) {
      const win = window.open(blobUrl, "_blank");
      if (win) {
        win.onload = () => win.print();
      }
    }
  }, 1200);

  setTimeout(() => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {}
    URL.revokeObjectURL(blobUrl);
  }, 120000);
}

/**
 * Direct print for an invoice/quotation with layout or classic generator.
 */
export async function printInvoiceWithLayout({
  invoice,
  tenantInfo,
  plan = "Free",
  layoutDef,
}: Omit<DownloadInvoiceOptions, "fileName">): Promise<void> {
  const resolvedLayout =
    layoutDef ||
    invoice?.layout_snapshot ||
    invoice?.active_layout_definition ||
    null;

  if (!resolvedLayout) {
    const pdfBytes = await generateInvoicePDF(invoice, plan, tenantInfo);
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    printPdfBlob(blob);
    return;
  }

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  container.style.background = "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(InvoiceRenderer, {
          layout: resolvedLayout,
          invoice,
          tenantInfo,
          plan,
        })
      );
      setTimeout(resolve, 300);
    });

    const targetEl = (container.firstElementChild || container) as HTMLElement;
    const isLetter = resolvedLayout.pageSize === "Letter";
    const paperWidthMm = isLetter ? 215.9 : 210;
    const minPaperHeightMm = isLetter ? 279.4 : 297;

    const imgData = await domtoimage.toPng(targetEl, {
      bgcolor: resolvedLayout.theme?.backgroundColor || "#ffffff",
      quality: 1.0,
      width: targetEl.offsetWidth * 2,
      height: targetEl.offsetHeight * 2,
      style: {
        transform: "scale(2)",
        transformOrigin: "top left",
        width: `${targetEl.offsetWidth}px`,
        height: `${targetEl.offsetHeight}px`,
      },
    });

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: isLetter ? "letter" : "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (targetEl.offsetHeight * pdfWidth) / targetEl.offsetWidth;

    pdf.addImage(
      imgData,
      "PNG",
      0,
      0,
      pdfWidth,
      Math.max(pdfHeight, minPaperHeightMm)
    );

    pdf.autoPrint();
    const blob = pdf.output("blob");
    printPdfBlob(blob);
  } finally {
    try {
      root.unmount();
    } catch {}
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
