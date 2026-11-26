"use client";

import React, { useState, useEffect } from "react";
import { Printer, X, Tag } from "lucide-react";
import { generateBarcodeSvg, generateQrCodeSvg } from "@/lib/pos/barcode-generator";
import { StockItem } from "@/lib/pos/stock-service";

interface BarcodeLabelPrinterProps {
  product: StockItem | null;
  isOpen: boolean;
  onClose: () => void;
}

// Standard thermal sticker roll size (58mm x 40mm)
const labelSize = { width: 58, height: 40 };

export function BarcodeLabelPrinter({ product, isOpen, onClose }: BarcodeLabelPrinterProps) {
  const [copies, setCopies] = useState<number>(1);
  const [labelType, setLabelType] = useState<"combo" | "barcode_only" | "qr_only">("barcode_only");

  useEffect(() => {
    if (!isOpen || !product) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handlePrint();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, product, copies, labelType, onClose]);

  if (!isOpen || !product) return null;

  const displaySku = product.sku || product.barcode || `ITEM-${product.id}`;
  const codeToEncode = displaySku;

  // Optimized barcodes for barcode-only vs combo layouts
  const barcodeSvgOnly = generateBarcodeSvg(codeToEncode, {
    height: labelSize.height <= 30 ? 28 : 36,
    barWidth: 1.4,
    showText: true,
    quietZone: 4,
  });

  const barcodeSvgCombo = generateBarcodeSvg(codeToEncode, {
    height: labelSize.height <= 30 ? 24 : 30,
    barWidth: 1.3,
    showText: true,
    quietZone: 3,
  });

  const qrSvg = generateQrCodeSvg(codeToEncode, 80);

  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const decodeHtmlEntities = (str: string) => {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&times;|&#215;/g, "×")
      .replace(/&nbsp;/g, " ");
  };

  const decodedName = decodeHtmlEntities(product.item_name);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print barcode labels.");
      return;
    }

    const labelsHtml = Array.from({ length: copies })
      .map(
        () => `
        <div class="label-card">
          <div class="product-name">${decodedName}</div>
          <div class="product-sku">SKU: ${displaySku}</div>
          
          <div class="code-container">
            ${
              labelType === "qr_only"
                ? `<div class="qr-box">${qrSvg}</div>`
                : labelType === "barcode_only"
                ? `<div class="barcode-box">${barcodeSvgOnly}</div>`
                : `
                  <div class="combo-row">
                    <div class="qr-col">${qrSvg}</div>
                    <div class="bar-col">${barcodeSvgCombo}</div>
                  </div>
                `
            }
          </div>

          <div class="price-tag">${formatLKR(product.selling_price)}</div>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Labels - ${decodedName}</title>
          <style>
            @page {
              size: ${labelSize.width}mm ${labelSize.height}mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .labels-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin: 0;
              padding: 0;
            }
            .label-card {
              width: ${labelSize.width}mm;
              height: ${labelSize.height}mm;
              max-width: ${labelSize.width}mm;
              max-height: ${labelSize.height}mm;
              padding: 2mm 3mm;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
              overflow: hidden;
              page-break-inside: avoid;
              break-inside: avoid;
              page-break-after: always;
              break-after: page;
              background: #fff;
            }
            .label-card:last-child {
              page-break-after: auto;
              break-after: auto;
            }
            .product-name {
              font-size: ${labelSize.width <= 40 ? 8 : 9.5}px;
              font-weight: 700;
              line-height: 1.15;
              color: #000;
              word-break: break-word;
              overflow-wrap: break-word;
              max-width: 100%;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .product-sku {
              font-size: 7.5px;
              font-weight: 600;
              color: #444;
              letter-spacing: 0.3px;
              margin-top: 0.5mm;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .code-container {
              width: 100%;
              max-width: 100%;
              margin: 1mm 0;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .combo-row {
              width: 100%;
              max-width: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 5px;
              overflow: hidden;
            }
            .combo-row .qr-col {
              width: ${labelSize.height <= 30 ? 9 : 11}mm;
              height: ${labelSize.height <= 30 ? 9 : 11}mm;
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .combo-row .qr-col svg {
              width: 100% !important;
              height: 100% !important;
              max-width: 100% !important;
              max-height: 100% !important;
              display: block;
            }
            .combo-row .bar-col {
              flex: 1;
              min-width: 0;
              max-width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .combo-row .bar-col svg {
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: ${labelSize.height <= 30 ? 9 : 12}mm;
              display: block;
            }
            .barcode-box {
              width: 100%;
              max-width: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .barcode-box svg {
              width: 100% !important;
              max-width: 100% !important;
              height: auto !important;
              max-height: ${labelSize.height <= 30 ? 11 : 14}mm;
              display: block;
            }
            .qr-box {
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-box svg {
              width: ${labelSize.height <= 30 ? 12 : 15}mm !important;
              height: ${labelSize.height <= 30 ? 12 : 15}mm !important;
              display: block;
            }
            .price-tag {
              font-size: ${labelSize.width <= 40 ? 10 : 12}px;
              font-weight: 900;
              color: #000;
              line-height: 1;
            }

            @media screen {
              body {
                background: #f0f2f5;
                padding: 20px;
              }
              .labels-container {
                gap: 16px;
              }
              .label-card {
                border: 1px dashed #bbb;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                border-radius: 4px;
              }
            }

            @media print {
              body {
                margin: 0;
                padding: 0;
              }
              .label-card {
                border: none;
                box-shadow: none;
                border-radius: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
            ${labelsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 600);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-bold text-foreground">Print Product Labels</h3>
            <p className="text-xs text-gray-400 break-words">{decodedName} ({displaySku})</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Body */}
        <div className="p-6 space-y-5">
          {/* Label Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Label Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLabelType("barcode_only")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  labelType === "barcode_only"
                    ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400 shadow-sm"
                    : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                Barcode Only
              </button>
              <button
                type="button"
                onClick={() => setLabelType("combo")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  labelType === "combo"
                    ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400 shadow-sm"
                    : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                Barcode + QR
              </button>
              <button
                type="button"
                onClick={() => setLabelType("qr_only")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                  labelType === "qr_only"
                    ? "bg-brand-500/15 border-brand-500 text-brand-700 dark:text-brand-400 shadow-sm"
                    : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                QR Code Only
              </button>
            </div>
          </div>

          {/* Number of Copies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Copies to Print
              </label>
              <span className="text-xs font-bold text-foreground">{copies} {copies === 1 ? 'sticker' : 'stickers'}</span>
            </div>
            <div className="flex items-center gap-2">
              {[1, 5, 10, 20, 50].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setCopies(num)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    copies === num
                      ? "bg-brand-500 text-brand-950 border-brand-500 shadow-sm"
                      : "border-border text-gray-400 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Label Preview Card */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Label Preview
              </label>
              <span className="text-[10px] text-gray-400 font-medium">Auto-fitted to sticker roll</span>
            </div>
            <div
              className="bg-white text-black p-3.5 rounded-xl border border-gray-300 shadow-md flex flex-col items-center justify-between text-center mx-auto transition-all overflow-hidden"
              style={{
                width: "260px",
                minHeight: labelSize.height <= 30 ? "130px" : "150px",
              }}
            >
              <div className="w-full">
                <div className="font-bold text-xs max-w-full text-black leading-snug break-words line-clamp-2">
                  {decodedName}
                </div>
                <div className="text-[10px] text-gray-600 font-semibold mt-0.5 tracking-wide truncate max-w-full">
                  SKU: {displaySku}
                </div>
              </div>

              <div className="my-1.5 w-full flex items-center justify-center overflow-hidden">
                {labelType === "combo" ? (
                  <div className="w-full flex items-center justify-between gap-2 overflow-hidden px-1">
                    <div
                      className="w-10 h-10 shrink-0 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    <div
                      className="flex-1 min-w-0 max-w-full flex items-center justify-center overflow-hidden [&_svg]:w-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:max-h-10 [&_svg]:block"
                      dangerouslySetInnerHTML={{ __html: barcodeSvgCombo }}
                    />
                  </div>
                ) : labelType === "barcode_only" ? (
                  <div
                    className="w-full flex items-center justify-center overflow-hidden px-1 [&_svg]:w-full [&_svg]:max-w-full [&_svg]:h-auto [&_svg]:max-h-12 [&_svg]:block"
                    dangerouslySetInnerHTML={{ __html: barcodeSvgOnly }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:block"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                )}
              </div>

              <div className="font-black text-sm text-black tracking-tight">
                {formatLKR(product.selling_price)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 bg-card border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border border-border text-gray-400 hover:text-foreground text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>Cancel</span>
            <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print {copies} {copies === 1 ? 'Label' : 'Labels'}</span>
            <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
