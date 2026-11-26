"use client";

import React, { useState, useEffect, useRef } from "react";
import { ShieldCheck, X, Camera, Lock, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { PosPromotion, verifyManagerPosCodeAction } from "@/app/(dashboard)/pos/actions/promotions";
import { CameraScannerModal } from "./CameraScannerModal";

interface ManagerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion?: PosPromotion | null;
  actionTitle?: string;
  actionBadge?: string;
  actionDescription?: string;
  onAuthorized: (promo: PosPromotion | null, managerName: string) => void;
}

export function ManagerApprovalModal({
  isOpen,
  onClose,
  promotion = null,
  actionTitle,
  actionBadge,
  actionDescription,
  onAuthorized,
}: ManagerApprovalModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setVerifying(false);
      // Autofocus input for rapid barcode/QR scanner or keyboard input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isCameraOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCameraOpen, onClose]);

  if (!isOpen || (!promotion && !actionTitle)) return null;

  const handleSubmitCode = async (codeToVerify: string) => {
    const clean = codeToVerify.trim();
    if (!clean) {
      setErrorMsg("Please scan a manager QR code or enter a valid access PIN.");
      return;
    }

    setVerifying(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const targetName = promotion ? promotion.name : (actionTitle || "Direct Discount");
      const res = await verifyManagerPosCodeAction(clean, targetName);
      if (res.success && res.managerName) {
        setSuccessMsg(`Authorized by ${res.managerName} (${res.managerRole || "Manager"})`);
        setTimeout(() => {
          onAuthorized(promotion || null, res.managerName!);
          onClose();
        }, 600);
      } else {
        setErrorMsg(res.error || "Invalid manager authorization code.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify manager authorization.");
    } finally {
      setVerifying(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitCode(code);
  };

  const handleCameraDetected = (scannedCode: string) => {
    setIsCameraOpen(false);
    setCode(scannedCode);
    handleSubmitCode(scannedCode);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-foreground">Manager Approval Required</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Cancel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Offer / Discount details highlight */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {promotion ? promotion.name : actionTitle}
                </span>
                {(promotion || actionBadge) && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                    {promotion
                      ? `${promotion.discount_value}${promotion.discount_type === 'percent' ? '%' : ' LKR'} OFF`
                      : actionBadge}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                {promotion
                  ? "This special offer is protected and requires manager or supervisor sign-off before being applied to the sale."
                  : actionDescription || "Cashiers require manager or supervisor access code authorization to apply direct discounts to this sale."}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-500 rounded-xl font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Scan Manager QR Badge or Enter PIN Code
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="password"
                    autoComplete="off"
                    placeholder="Scan QR or enter PIN..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={verifying || Boolean(successMsg)}
                    className="w-full pl-4 pr-11 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-500 rounded-lg transition-colors cursor-pointer"
                    title="Scan Manager QR Code with camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border text-gray-400 hover:text-foreground rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Cancel</span>
                  <kbd className="text-[10px] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-gray-400">Esc</kbd>
                </button>
                <button
                  type="submit"
                  disabled={verifying || !code.trim() || Boolean(successMsg)}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-40 text-brand-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2"
                >
                  {verifying ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>{actionTitle ? "Authorize Discount" : "Authorize Offer"}</span>
                      <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-1.5 py-0.5 rounded font-bold">Enter</kbd>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Camera scanner for scanning manager QR badge */}
      {isCameraOpen && (
        <CameraScannerModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onDetected={handleCameraDetected}
          title="Scan Manager QR Badge"
          continuous={false}
        />
      )}
    </>
  );
}
