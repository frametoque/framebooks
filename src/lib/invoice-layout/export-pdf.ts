// src/lib/invoice-layout/export-pdf.ts
"use client";

import { createRoot } from "react-dom/client";
import React from "react";
import { InvoiceRenderer } from "./renderer";
import { InvoiceLayoutDefinition } from "./types";

interface DownloadInvoiceOptions {
  invoice: any;
  tenantInfo?: any;
  plan?: string;
  layoutDef?: InvoiceLayoutDefinition | null;
  fileName?: string;
}

/**
 * Converts any image URL (remote CDN / S3 / R2) to a base64 Data URL
 * to ensure 100% reliable SVG foreignObject rendering without CORS or cache drops.
 */
async function convertUrlToDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url || typeof url !== "string") return undefined;
  if (url.startsWith("data:")) return url;

  // 1. Direct client fetch with CORS
  try {
    const res = await fetch(url, { cache: "no-store", mode: "cors" });
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl && dataUrl.startsWith("data:")) {
        return dataUrl;
      }
    }
  } catch {
    // Direct fetch failed (e.g. CORS restrictions on remote CDN)
  }

  // 2. Next.js image proxy fallback (bypasses browser CORS completely via same-origin)
  try {
    const proxyUrl = `/api/invoice-layout/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (dataUrl && dataUrl.startsWith("data:")) {
        return dataUrl;
      }
    }
  } catch {
    // Proxy fallback failed
  }

  // 3. HTML5 Canvas draw fallback
  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 1100;
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = reject;
      img.src = url;
    });
    if (dataUrl && dataUrl.startsWith("data:")) {
      return dataUrl;
    }
  } catch {
    // Canvas fallback failed
  }

  return url;
}

/**
 * Pre-processes layout definition and tenant info to inline all image assets as base64 Data URLs.
 */
async function prepareLayoutWithInlinedImages(
  layout: InvoiceLayoutDefinition,
  tenantInfo?: any
): Promise<{ layout: InvoiceLayoutDefinition; tenantInfo?: any }> {
  const clonedLayout: InvoiceLayoutDefinition = JSON.parse(JSON.stringify(layout));
  const clonedTenantInfo = tenantInfo ? JSON.parse(JSON.stringify(tenantInfo)) : tenantInfo;

  const tasks: Promise<any>[] = [];

  // Theme background image
  if (clonedLayout.theme?.backgroundImage) {
    tasks.push(
      convertUrlToDataUrl(clonedLayout.theme.backgroundImage).then((dataUrl) => {
        if (dataUrl) clonedLayout.theme.backgroundImage = dataUrl;
      })
    );
  }

  // Tenant logo
  if (clonedTenantInfo?.logo_url) {
    tasks.push(
      convertUrlToDataUrl(clonedTenantInfo.logo_url).then((dataUrl) => {
        if (dataUrl) clonedTenantInfo.logo_url = dataUrl;
      })
    );
  }

  // Section blocks (logo, image blocks, signature blocks)
  if (Array.isArray(clonedLayout.sections)) {
    for (const section of clonedLayout.sections) {
      if (Array.isArray(section.columns)) {
        for (const col of section.columns) {
          if (Array.isArray(col.blocks)) {
            for (const block of col.blocks) {
              if (block.props?.url && typeof block.props.url === "string") {
                tasks.push(
                  convertUrlToDataUrl(block.props.url).then((dataUrl) => {
                    if (dataUrl && block.props) block.props.url = dataUrl;
                  })
                );
              }
              if (block.props?.signatureImageUrl && typeof block.props.signatureImageUrl === "string") {
                tasks.push(
                  convertUrlToDataUrl(block.props.signatureImageUrl).then((dataUrl) => {
                    if (dataUrl && block.props) block.props.signatureImageUrl = dataUrl;
                  })
                );
              }
            }
          }
        }
      }
    }
  }

  await Promise.all(tasks);
  return { layout: clonedLayout, tenantInfo: clonedTenantInfo };
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
  let resolvedLayout =
    layoutDef ||
    invoice?.layout_snapshot ||
    invoice?.active_layout_definition ||
    null;

  if (typeof resolvedLayout === "string") {
    try {
      resolvedLayout = JSON.parse(resolvedLayout);
    } catch {
      resolvedLayout = null;
    }
  }

  const defaultFilename = `${
    invoice.invoice_number || invoice.invoice_id || "invoice"
  }.pdf`;
  const targetFilename = fileName || defaultFilename;

  // If no custom active layout exists, use standard classic generator
  if (!resolvedLayout) {
    const { generateInvoicePDF } = await import("@/lib/generateInvoicePDF");
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

  // Pre-inline all background and block images to base64 Data URLs
  const { layout: inlinedLayout, tenantInfo: inlinedTenantInfo } =
    await prepareLayoutWithInlinedImages(resolvedLayout, tenantInfo);

  const isLetter = inlinedLayout.pageSize === "Letter";
  const paperWidthMm = isLetter ? 215.9 : 210;
  const minPaperHeightMm = isLetter ? 279.4 : 297;

  // Render the active layout in an off-screen container with explicit paper bounds
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${paperWidthMm}mm`;
  container.style.minHeight = `${minPaperHeightMm}mm`;
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  container.style.background = inlinedLayout.theme?.backgroundColor || "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(InvoiceRenderer, {
          layout: inlinedLayout,
          invoice,
          tenantInfo: inlinedTenantInfo,
          plan,
        })
      );

      // Ensure images in DOM are fully loaded and decoded before rasterizing
      setTimeout(async () => {
        try {
          const imgs = Array.from(container.querySelectorAll("img"));
          await Promise.all(
            imgs.map(async (img) => {
              if (img.complete && img.naturalWidth > 0) {
                if (typeof img.decode === "function") {
                  try {
                    await img.decode();
                  } catch {}
                }
                return;
              }
              await new Promise<void>((imgRes) => {
                img.onload = () => imgRes();
                img.onerror = () => imgRes();
                setTimeout(imgRes, 3000);
              });
            })
          );
        } catch {}
        setTimeout(resolve, 150);
      }, 80);
    });

    const targetEl = (container.firstElementChild || container) as HTMLElement;

    const [{ default: domtoimage }, { jsPDF }] = await Promise.all([
      import("dom-to-image-more"),
      import("jspdf"),
    ]);

    const imgData = await domtoimage.toPng(targetEl, {
      bgcolor: inlinedLayout.theme?.backgroundColor || "#ffffff",
      quality: 1.0,
      cacheBust: true,
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
  let resolvedLayout =
    layoutDef ||
    invoice?.layout_snapshot ||
    invoice?.active_layout_definition ||
    null;

  if (typeof resolvedLayout === "string") {
    try {
      resolvedLayout = JSON.parse(resolvedLayout);
    } catch {
      resolvedLayout = null;
    }
  }

  if (!resolvedLayout) {
    const { generateInvoicePDF } = await import("@/lib/generateInvoicePDF");
    const pdfBytes = await generateInvoicePDF(invoice, plan, tenantInfo);
    const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
    printPdfBlob(blob);
    return;
  }

  // Pre-inline all background and block images to base64 Data URLs
  const { layout: inlinedLayout, tenantInfo: inlinedTenantInfo } =
    await prepareLayoutWithInlinedImages(resolvedLayout, tenantInfo);

  const isLetter = inlinedLayout.pageSize === "Letter";
  const paperWidthMm = isLetter ? 215.9 : 210;
  const minPaperHeightMm = isLetter ? 279.4 : 297;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${paperWidthMm}mm`;
  container.style.minHeight = `${minPaperHeightMm}mm`;
  container.style.zIndex = "-9999";
  container.style.pointerEvents = "none";
  container.style.background = inlinedLayout.theme?.backgroundColor || "#ffffff";
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    await new Promise<void>((resolve) => {
      root.render(
        React.createElement(InvoiceRenderer, {
          layout: inlinedLayout,
          invoice,
          tenantInfo: inlinedTenantInfo,
          plan,
        })
      );

      // Ensure images in DOM are fully loaded and decoded before rasterizing
      setTimeout(async () => {
        try {
          const imgs = Array.from(container.querySelectorAll("img"));
          await Promise.all(
            imgs.map(async (img) => {
              if (img.complete && img.naturalWidth > 0) {
                if (typeof img.decode === "function") {
                  try {
                    await img.decode();
                  } catch {}
                }
                return;
              }
              await new Promise<void>((imgRes) => {
                img.onload = () => imgRes();
                img.onerror = () => imgRes();
                setTimeout(imgRes, 3000);
              });
            })
          );
        } catch {}
        setTimeout(resolve, 150);
      }, 80);
    });

    const targetEl = (container.firstElementChild || container) as HTMLElement;

    const [{ default: domtoimage }, { jsPDF }] = await Promise.all([
      import("dom-to-image-more"),
      import("jspdf"),
    ]);

    const imgData = await domtoimage.toPng(targetEl, {
      bgcolor: inlinedLayout.theme?.backgroundColor || "#ffffff",
      quality: 1.0,
      cacheBust: true,
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
