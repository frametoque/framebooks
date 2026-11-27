"use client";

import React, { useState } from "react";
import { X, RefreshCw, Check, Printer, Shield, KeyRound, AlertCircle, Loader2 } from "lucide-react";
import { generateQrCodeSvg } from "@/lib/pos/barcode-generator";
import { updateUserPosCodeAction } from "@/app/(dashboard)/pos/actions/promotions";
import { printHtmlViaHiddenIframe } from "@/lib/pos/receipt-printer";

const AppleWalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path
      fill="currentColor"
      d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
    />
  </svg>
);

const GoogleWalletIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

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
  const [addingToWallet, setAddingToWallet] = useState<"apple" | "google" | null>(null);
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

  const handleAppleWallet = async () => {
    setAddingToWallet("apple");
    setStatusMsg(null);
    try {
      const res = await fetch("/api/pos/pass/apple-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, code: activeCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `Server error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `framebooks-pos-pass-${member.id}.pkpass`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg({ type: "success", text: "Apple Wallet pass downloaded successfully." });
    } catch (err: any) {
      console.error("Apple Wallet error:", err);
      setStatusMsg({ type: "error", text: `Apple Wallet: ${err?.message ?? "Failed to create pass"}` });
    } finally {
      setAddingToWallet(null);
    }
  };

  const handleGoogleWallet = async () => {
    setAddingToWallet("google");
    setStatusMsg(null);
    try {
      const res = await fetch("/api/pos/pass/google-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: member.id, code: activeCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const { saveUrl } = await res.json();
      if (!saveUrl) throw new Error("No Google Wallet save URL returned");
      window.open(saveUrl, "_blank");
      setStatusMsg({ type: "success", text: "Google Wallet pass ready. Opening link..." });
    } catch (err: any) {
      console.error("Google Wallet error:", err);
      setStatusMsg({ type: "error", text: `Google Wallet: ${err?.message ?? "Failed to create pass"}` });
    } finally {
      setAddingToWallet(null);
    }
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
    const badgeHtml = `
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
        </body>
      </html>
    `;

    printHtmlViaHiddenIframe(badgeHtml);
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
            <h3 className="text-base font-bold text-foreground">POS Access Code</h3>
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

        {/* Elegant Obsidian QR Badge Card Preview */}
        <div className="bg-[#0B0F17] text-white border border-white/10 rounded-2xl p-5 text-center space-y-3.5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] text-white/50 px-1 pt-1">
            <span className="font-bold tracking-wider uppercase text-white/80">Framebooks</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-[#00E35B]/15 text-[#00E35B] border border-[#00E35B]/30">
              {member.role || "Admin"}
            </span>
          </div>

          <div className="text-left px-1">
            <h4 className="text-sm font-bold text-white truncate">{member.full_name || member.email}</h4>
            <p className="text-[11px] text-white/50 truncate">{tenantName}</p>
          </div>

          <div className="flex justify-center py-1">
            <div className="p-3 bg-white rounded-2xl shadow-lg ring-1 ring-black/5">
              <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="font-mono text-xs font-bold text-[#00E35B] tracking-widest bg-white/5 py-1.5 px-3 rounded-lg border border-white/5 inline-block">
              PIN: {activeCode}
            </div>
            <p className="text-[10px] text-white/40">
              Scan QR or enter PIN at POS to authorize manager actions
            </p>
          </div>
        </div>

        {/* Action Buttons: Apple Wallet, Google Wallet & Print */}
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Apple Wallet Button */}
            <button
              type="button"
              onClick={handleAppleWallet}
              disabled={addingToWallet !== null}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-black text-white hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              title="Add POS Access Pass to Apple Wallet"
            >
              {addingToWallet === "apple" ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <AppleWalletIcon />
              )}
              <div className="text-left leading-tight">
                <span className="block text-[9px] uppercase tracking-wider text-white/50 font-medium">
                  {addingToWallet === "apple" ? "Adding..." : "Add to"}
                </span>
                <span className="block text-xs font-bold text-white">Apple Wallet</span>
              </div>
            </button>

            {/* Google Wallet Button */}
            <button
              type="button"
              onClick={handleGoogleWallet}
              disabled={addingToWallet !== null}
              className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-foreground shadow-xs"
              title="Save POS Access Pass to Google Wallet"
            >
              {addingToWallet === "google" ? (
                <Loader2 className="w-4 h-4 text-foreground animate-spin" />
              ) : (
                <GoogleWalletIcon />
              )}
              <div className="text-left leading-tight">
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                  {addingToWallet === "google" ? "Opening..." : "Save to"}
                </span>
                <span className="block text-xs font-bold text-foreground">Google Wallet</span>
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrintBadge}
            className="w-full py-2 px-4 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-brand-500" />
            <span>Print Badge / Slip</span>
          </button>
        </div>
      </div>
    </div>
  );
}
