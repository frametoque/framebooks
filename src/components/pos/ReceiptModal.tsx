"use client";

import React, { useEffect, useCallback } from "react";
import { Printer, X, CheckCircle2, RotateCcw, Palette } from "lucide-react";
import { generateBarcodeSvg, generateQrCodeSvg } from "@/lib/pos/barcode-generator";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  receiptHeader?: string;
  receiptFooter?: string;
  onNewSale?: () => void;
  customLayout?: { id: string; name: string; definition: any } | null;
}

export function ReceiptModal({
  isOpen,
  onClose,
  order,
  tenantName = "Framebooks Store",
  tenantLogoUrl = null,
  receiptHeader = "",
  receiptFooter = "Thank you for shopping with us!",
  onNewSale,
  customLayout = null,
}: ReceiptModalProps) {
  if (!isOpen || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const orderNumber = order.order_number || order.orderNumber || "POS-SALE";
  const barcodeSvg = generateBarcodeSvg(orderNumber, { height: 35, barWidth: 1.5 });

  const themeFont = customLayout?.definition?.theme?.fontFamily
    ? `${customLayout.definition.theme.fontFamily}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const primaryColor = customLayout?.definition?.theme?.primaryColor || "#000000";

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print receipt.");
      return;
    }

    const itemsRows = items
      .map(
        (it: any) => `
      <tr>
        <td style="text-align: left; padding: 4px 0;">
          <div style="font-weight: 600;">${it.name || it.item_name}</div>
          <div style="font-size: 10px; color: #555;">${it.quantity} x ${formatLKR(it.price)}</div>
        </td>
        <td style="text-align: right; padding: 4px 0; font-weight: 600;">
          ${formatLKR((it.quantity || 1) * (it.price || 0))}
        </td>
      </tr>
    `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
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
            ${order.discount_amount > 0 ? `
              <tr>
                <td>Discount</td>
                <td style="text-align: right;">-${formatLKR(order.discount_amount)}</td>
              </tr>
            ` : ""}
            ${order.tax_amount > 0 ? `
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
              <td style="padding-top: 6px;">Paid (${order.payment_method})</td>
              <td style="text-align: right; padding-top: 6px;">${formatLKR(order.amount_tendered || order.total_amount)}</td>
            </tr>
            ${order.change_returned > 0 ? `
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

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
    // Auto-close receipt modal and trigger clean state so receipt modal does not linger
    setTimeout(() => {
      onClose();
      if (onNewSale) onNewSale();
    }, 350);
  }, [items, orderNumber, themeFont, primaryColor, tenantLogoUrl, tenantName, receiptHeader, order, barcodeSvg, receiptFooter, onClose, onNewSale]);

  // Keyboard navigation inside Receipt Modal (Enter/P to print, Esc to close/next)
  useEffect(() => {
    if (!isOpen) return;

    const handleReceiptKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        if (onNewSale) onNewSale();
      }
    };

    window.addEventListener("keydown", handleReceiptKeyDown);
    return () => window.removeEventListener("keydown", handleReceiptKeyDown);
  }, [isOpen, handlePrint, onClose, onNewSale]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-brand-500/10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-500" />
            <div>
              <h3 className="text-base font-bold text-foreground">Sale Completed</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Slip Preview */}
        <div className="p-6 overflow-y-auto">
          <div 
            className="bg-white text-black p-6 rounded-2xl shadow-inner text-xs space-y-3 border border-gray-200"
            style={{ fontFamily: themeFont }}
          >
            <div className="text-center space-y-1">
              {tenantLogoUrl && (
                <img
                  src={tenantLogoUrl}
                  alt={tenantName}
                  className="max-h-11 max-w-[140px] object-contain mx-auto mb-1.5 block"
                />
              )}
              <h4 className="font-bold text-base tracking-tight" style={{ color: primaryColor }}>{tenantName}</h4>
              {receiptHeader && <p className="text-[11px] text-gray-600">{receiptHeader}</p>}
              <p className="text-[11px] text-gray-700">Receipt #{orderNumber}</p>
              <p className="text-[10px] text-gray-500">{new Date(order.created_at || Date.now()).toLocaleString()}</p>
              <p className="text-[10px] text-gray-600">Cashier: {order.user_name || "Cashier"}</p>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Client Details */}
            <div className="text-left space-y-0.5 px-0.5">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block">Client Details</span>
              <p className="text-[11px] font-semibold text-gray-900">
                Customer: {order.customer_name || "Walk-in Customer"}
              </p>
              {order.customer_phone && (
                <p className="text-[10px] text-gray-600">
                  Phone: {order.customer_phone}
                </p>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="space-y-2">
              {items.map((it: any, idx: number) => (
                <div key={idx} className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{it.name || it.item_name}</div>
                    <div className="text-[10px] text-gray-500">{it.quantity} × {formatLKR(it.price)}</div>
                  </div>
                  <div className="font-semibold">{formatLKR((it.quantity || 1) * (it.price || 0))}</div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div className="space-y-1 text-gray-800">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatLKR(order.subtotal)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount</span>
                  <span>-{formatLKR(order.discount_amount)}</span>
                </div>
              )}
              {order.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>+{formatLKR(order.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-gray-300">
                <span>TOTAL</span>
                <span>LKR {formatLKR(order.total_amount)}</span>
              </div>
              <div className="flex justify-between pt-1 text-[11px]">
                <span>Paid ({order.payment_method})</span>
                <span>{formatLKR(order.amount_tendered || order.total_amount)}</span>
              </div>
              {order.change_returned > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Change Due</span>
                  <span>{formatLKR(order.change_returned)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            <div
              className="flex justify-center my-2 max-w-full overflow-hidden"
              dangerouslySetInnerHTML={{ __html: barcodeSvg }}
            />

            <div className="text-center text-[10px] text-gray-600 pt-1">
              {receiptFooter}
            </div>

            <div className="text-center text-[8px] text-gray-400 uppercase tracking-widest pt-2 font-medium select-none">
              Powered by Framebooks POS
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-card border-t border-border flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 px-4 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
            <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-2 py-0.5 rounded-md font-sans font-bold">Enter</kbd>
          </button>
          {onNewSale && (
            <button
              onClick={() => {
                onClose();
                onNewSale();
              }}
              className="py-3 px-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-foreground font-semibold rounded-xl text-sm transition-colors flex items-center gap-2 cursor-pointer border border-border"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Next Sale</span>
              <kbd className="text-[10px] bg-black/10 dark:bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-md font-sans font-semibold">Esc</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
