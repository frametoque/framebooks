"use client";

import React, { useState } from "react";
import { X, RefreshCw, Check, Printer, Shield, KeyRound, AlertCircle } from "lucide-react";
import { generateQrCodeSvg } from "@/lib/pos/barcode-generator";
import { updateUserPosCodeAction } from "@/app/(dashboard)/pos/actions/promotions";

interface TeamPosCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: number;
    full_name: string;
    email: string;
    role: string;
    pos_manager_code?: string | null;
  } | null;
  tenantName?: string;
  onUpdated: (memberId: number, newCode: string) => void;
}

export function TeamPosCodeModal({
  isOpen,
  onClose,
  member,
  tenantName = "Framebooks POS",
  onUpdated,
}: TeamPosCodeModalProps) {
  const [code, setCode] = useState(member?.pos_manager_code || "");
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sync initial code if member changes
  React.useEffect(() => {
    if (member) {
      setCode(member.pos_manager_code || "");
      setStatusMsg(null);
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const handleGenerateRandom = () => {
    // Generate a clean 6-digit PIN code
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    setCode(randomDigits);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim();
    if (!clean || clean.length < 4) {
      setStatusMsg({ type: "error", text: "Passcode must be at least 4 characters." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);

    try {
      const res = await updateUserPosCodeAction(member.id, clean);
      if (res.success && res.posCode) {
        setStatusMsg({ type: "success", text: "POS Access Code successfully saved." });
        onUpdated(member.id, res.posCode);
      } else {
        setStatusMsg({ type: "error", text: res.error || "Failed to update access code." });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const activeCode = code.trim() || member.pos_manager_code || "123456";
  const qrSvg = generateQrCodeSvg(`POS_MGR:${activeCode}`, 140);

  const handlePrintBadge = () => {
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) {
      alert("Please allow popups to print the manager QR badge.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>POS Authorization Badge - ${member.full_name || member.email}</title>
          <style>
            @page { size: auto; margin: 10mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              background: #fff;
              color: #000;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .badge {
              width: 280px;
              border: 2px solid #000;
              border-radius: 16px;
              padding: 20px;
              text-align: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .tenant {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #666;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              margin: 4px 0 12px 0;
            }
            .qr-box {
              display: flex;
              justify-content: center;
              margin: 12px 0;
            }
            .qr-box svg {
              width: 140px;
              height: 140px;
            }
            .code {
              font-family: monospace;
              font-size: 18px;
              font-weight: bold;
              letter-spacing: 2px;
              background: #f0f0f0;
              padding: 6px 12px;
              border-radius: 8px;
              display: inline-block;
              margin: 8px 0;
            }
            .footer {
              font-size: 10px;
              color: #777;
              margin-top: 10px;
              line-height: 1.3;
            }
          </style>
        </head>
        <body>
          <div class="badge">
            <div class="tenant">${tenantName}</div>
            <div class="title">${member.full_name || member.email}</div>
            <div style="font-size: 11px; font-weight: bold; color: #16a34a; text-transform: uppercase;">
              ${member.role} Authorization Pass
            </div>
            <div class="qr-box">
              ${qrSvg}
            </div>
            <div class="code">PIN: ${activeCode}</div>
            <div class="footer">
              Scan QR code or enter PIN at POS terminal to authorize protected discounts & offers.
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-foreground rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground">POS Access Code & QR Badge</h3>
            <p className="text-xs text-gray-400 truncate">
              {member.full_name || member.email} ({member.role})
            </p>
          </div>
        </div>

        {statusMsg && (
          <div
            className={`p-3 text-xs rounded-xl font-semibold flex items-center gap-2 ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-500"
            }`}
          >
            {statusMsg.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Code Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              POS Passcode / PIN
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 123456 or MGR-8902"
                className="flex-1 px-4 py-2 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-mono font-bold text-foreground focus:outline-none focus:border-brand-500 transition-colors"
                required
              />
              <button
                type="button"
                onClick={handleGenerateRandom}
                className="px-3 py-2 border border-border hover:bg-black/5 dark:hover:bg-white/5 text-gray-300 hover:text-foreground text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Generate 6-digit random PIN"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Random</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-400 text-brand-950 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>{saving ? "Saving..." : "Save Code"}</span>
              </button>
            </div>
          </div>
        </form>

        {/* QR Badge Card Preview */}
        <div className="bg-black/5 dark:bg-white/5 border border-border rounded-2xl p-5 text-center space-y-3">
          <div className="inline-block p-3 bg-white rounded-2xl shadow-md">
            <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          </div>

          <div className="font-mono text-sm font-black text-foreground tracking-widest">
            PIN: {activeCode}
          </div>

          <button
            type="button"
            onClick={handlePrintBadge}
            className="w-full py-2 px-4 rounded-xl border border-border hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold text-foreground transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-brand-500" />
            <span>Print Badge / Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
