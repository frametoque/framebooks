"use client";

import { generateBarcodeSvg } from "./barcode-generator.ts";

export interface PosOrderReceiptData {
  order_number?: string;
  orderNumber?: string;
  items?: Array<{
    name?: string;
    item_name?: string;
    quantity?: number;
    price?: number;
    sku?: string;
  }>;
  subtotal?: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  payment_method?: string;
  amount_tendered?: number;
  change_returned?: number;
  customer_name?: string;
  customer_phone?: string | null;
  user_name?: string;
  created_at?: string | Date;
}

export interface ReceiptPrinterOptions {
  order: PosOrderReceiptData;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  receiptHeader?: string;
  receiptFooter?: string;
  customLayout?: { id: string; name: string; definition: any } | null;
  fileName?: string;
}

function formatLKR(amount: number | undefined | null): string {
  return new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Builds the complete HTML string for an 80mm thermal receipt.
 */
export function buildPosReceiptHtml({
  order,
  tenantName = "Framebooks Store",
  tenantLogoUrl = null,
  receiptHeader = "",
  receiptFooter = "Thank you for shopping with us!",
  customLayout = null,
}: ReceiptPrinterOptions): string {
  const items = Array.isArray(order.items) ? order.items : [];
  const orderNumber = order.order_number || order.orderNumber || "REC-SALE";
  const barcodeSvg = generateBarcodeSvg(orderNumber, { height: 35, barWidth: 1.5 });

  const themeFont = customLayout?.definition?.theme?.fontFamily
    ? `${customLayout.definition.theme.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const primaryColor = customLayout?.definition?.theme?.primaryColor || "#000000";

  const itemsRows = items
    .map(
      (it: any) => `
    <tr>
      <td style="text-align: left; padding: 4px 0;">
        <div style="font-weight: 600;">${it.name || it.item_name || "Item"}</div>
        <div style="font-size: 10px; color: #555;">${it.quantity || 1} x ${formatLKR(it.price || 0)}</div>
      </td>
      <td style="text-align: right; padding: 4px 0; font-weight: 600;">
        ${formatLKR((it.quantity || 1) * (it.price || 0))}
      </td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${orderNumber}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body {
            font-family: ${themeFont};
            width: 72mm;
            margin: 0 auto;
            padding: 6px;
            color: #000;
            background: #fff;
            font-size: 12px;
            line-height: 1.3;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .header-title { font-size: 16px; font-weight: bold; margin-bottom: 2px; color: ${primaryColor}; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          .total-row td { font-size: 14px; font-weight: bold; padding-top: 6px; color: ${primaryColor}; }
          .barcode-wrap { text-align: center; margin: 10px 0; }
          .barcode-wrap svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="center">
          ${tenantLogoUrl ? `<img src="${tenantLogoUrl}" alt="${tenantName}" style="max-height: 44px; max-width: 140px; object-fit: contain; margin: 0 auto 6px auto; display: block;" />` : ""}
          <div class="header-title">${tenantName}</div>
          ${receiptHeader ? `<div style="font-size: 11px;">${receiptHeader}</div>` : ""}
          <div style="font-size: 11px; margin-top: 4px;">Receipt #${orderNumber}</div>
          <div style="font-size: 10px; color: #444;">${new Date(order.created_at || Date.now()).toLocaleString()}</div>
          <div style="font-size: 10px;">Cashier: ${order.user_name || "Cashier"}</div>
        </div>

        <div class="divider"></div>

        <div style="font-size: 11px; text-align: left; padding: 2px 0;">
          <div style="font-weight: bold; font-size: 9px; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">CLIENT DETAILS</div>
          <div style="font-weight: 600; font-size: 11px;">Customer: ${order.customer_name || "Walk-in Customer"}</div>
          ${order.customer_phone ? `<div style="font-size: 10px; color: #333;">Phone: ${order.customer_phone}</div>` : ""}
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr style="border-bottom: 1px solid #000; font-size: 11px;">
              <th style="text-align: left; padding-bottom: 4px;">ITEM</th>
              <th style="text-align: right; padding-bottom: 4px;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="divider"></div>

        <table>
          <tr>
            <td>Subtotal</td>
            <td style="text-align: right;">${formatLKR(order.subtotal)}</td>
          </tr>
          ${(order.discount_amount || 0) > 0 ? `
            <tr>
              <td>Discount</td>
              <td style="text-align: right;">-${formatLKR(order.discount_amount)}</td>
            </tr>
          ` : ""}
          ${(order.tax_amount || 0) > 0 ? `
            <tr>
              <td>Tax</td>
              <td style="text-align: right;">+${formatLKR(order.tax_amount)}</td>
            </tr>
          ` : ""}
          <tr class="total-row">
            <td>TOTAL</td>
            <td style="text-align: right;">LKR ${formatLKR(order.total_amount)}</td>
          </tr>
          <tr>
            <td style="padding-top: 6px;">Paid (${order.payment_method || "Cash"})</td>
            <td style="text-align: right; padding-top: 6px;">${formatLKR(order.amount_tendered || order.total_amount)}</td>
          </tr>
          ${(order.change_returned || 0) > 0 ? `
            <tr>
              <td>Change Due</td>
              <td style="text-align: right; font-weight: bold;">${formatLKR(order.change_returned)}</td>
            </tr>
          ` : ""}
        </table>

        <div class="divider"></div>

        <div class="barcode-wrap">
          ${barcodeSvg}
        </div>

        <div class="center" style="font-size: 11px; margin-top: 6px;">
          ${receiptFooter}
        </div>

        <div class="center" style="font-size: 8px; color: #888; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
          Powered by Framebooks POS
        </div>
      </body>
    </html>
  `;
}

/**
 * Prints HTML content silently in the current tab via a hidden iframe.
 * Prevents opening new browser tabs or windows, eliminating popup blocker issues
 * and preventing customer-facing screens or secondary displays from exiting fullscreen.
 */
export function printHtmlViaHiddenIframe(htmlContent: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  // Remove any previous print frame to avoid stale document states
  const oldFrame = document.getElementById("__pos_silent_print_frame");
  if (oldFrame) {
    oldFrame.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "__pos_silent_print_frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("tabindex", "-1");
  // Non-zero dimensions ensure Chrome, Safari and Firefox layout the document for printing,
  // while keeping it completely invisible and offscreen without opening any new tab.
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "300px";
  iframe.style.height = "300px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.style.zIndex = "-9999";

  let printed = false;
  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    try {
      const win = iframe.contentWindow;
      if (win) {
        win.onafterprint = () => {
          try {
            if (iframe.parentNode) iframe.remove();
          } catch {}
        };
        win.print();
        // Fallback cleanup if onafterprint does not fire
        setTimeout(() => {
          try {
            if (iframe.parentNode) iframe.remove();
          } catch {}
        }, 30000);
      }
    } catch (e) {
      console.error("POS print error:", e);
    }
  };

  iframe.onload = () => {
    // Brief delay to allow thermal receipt CSS and SVG barcodes to paint
    setTimeout(triggerPrint, 150);
  };

  iframe.srcdoc = htmlContent;
  document.body.appendChild(iframe);

  // Safety fallback in case iframe onload does not fire in certain webview environments
  setTimeout(triggerPrint, 500);
}

/**
 * Directly prints a POS receipt using browser print dialog formatted for 80mm thermal printer.
 * Uses a hidden iframe so the customer-facing secondary display never exits fullscreen.
 */
export function printPosReceipt(options: ReceiptPrinterOptions): void {
  const html = buildPosReceiptHtml(options);
  printHtmlViaHiddenIframe(html);
}

/**
 * Downloads a POS thermal receipt as an 80mm PDF file.
 */
export async function downloadPosReceiptPdf(options: ReceiptPrinterOptions): Promise<void> {
  const orderNumber = options.order.order_number || options.order.orderNumber || "receipt";
  const targetFilename = options.fileName || `Receipt-${orderNumber}.pdf`;

  // Render the receipt body in an offscreen 80mm container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "80mm";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.padding = "4mm";
  container.style.boxSizing = "border-box";
  container.style.zIndex = "-9999";

  const rawHtml = buildPosReceiptHtml(options);
  // Extract body content
  const bodyMatch = rawHtml.match(/<body>([\s\S]*?)<\/body>/i);
  container.innerHTML = bodyMatch ? bodyMatch[1] : rawHtml;
  document.body.appendChild(container);

  try {
    const [{ default: domtoimage }, { jsPDF }] = await Promise.all([
      import("dom-to-image-more"),
      import("jspdf"),
    ]);

    // Ensure images inside container are loaded
    const imgs = Array.from(container.querySelectorAll("img"));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise<void>((res) => {
          img.onload = () => res();
          img.onerror = () => res();
          setTimeout(res, 2000);
        });
      })
    );

    const imgData = await domtoimage.toPng(container, {
      bgcolor: "#ffffff",
      quality: 1.0,
      cacheBust: true,
      width: container.offsetWidth * 2,
      height: container.offsetHeight * 2,
      style: {
        transform: "scale(2)",
        transformOrigin: "top left",
        width: `${container.offsetWidth}px`,
        height: `${container.offsetHeight}px`,
      },
    });

    const targetWidthMm = 80;
    const computedHeightMm = (container.offsetHeight * targetWidthMm) / container.offsetWidth;
    const targetHeightMm = Math.max(90, Math.ceil(computedHeightMm));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [targetWidthMm, targetHeightMm],
    });

    pdf.addImage(imgData, "PNG", 0, 0, targetWidthMm, computedHeightMm);
    pdf.save(targetFilename);
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}
