"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Camera, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  ZapOff, 
  RefreshCw 
} from "lucide-react";
import { PosPromotion, verifyManagerPosCodeAction } from "@/app/(dashboard)/pos/actions/promotions";
import { playManagerBellSound, stopManagerBellSound } from "./useHardwareBarcodeScanner";

interface ManagerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotion?: PosPromotion | null;
  actionTitle?: string;
  actionBadge?: string;
  actionDescription?: string;
  onAuthorized: (promo: PosPromotion | null, managerName: string) => void;
  overlayMode?: "fixed" | "section";
}

export function ManagerApprovalModal({
  isOpen,
  onClose,
  promotion = null,
  actionTitle,
  actionBadge,
  actionDescription,
  onAuthorized,
  overlayMode = "section",
}: ManagerApprovalModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Camera scanner state: active and scanning by default
  const [cameraActive, setCameraActive] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(false);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    stopCamera();
    stopManagerBellSound();
    onClose();
  };

  useEffect(() => {
    isMountedRef.current = isOpen;

    if (isOpen) {
      // Ring service desk bell sound to alert managers
      if (promotion?.requires_manager_approval || actionTitle) {
        playManagerBellSound();
      }
      setCode("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setVerifying(false);
      setCameraActive(true);

      // Start camera scanner on modal open
      startCamera();

      // Focus input as keyboard / barcode gun fallback
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    } else {
      stopCamera();
      stopManagerBellSound();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener("keydown", handleKeyDown);
      stopCamera();
      stopManagerBellSound();
    };
  }, [isOpen, promotion, actionTitle]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setHasCamera(false);
        setCameraError("Camera is not supported on this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const track = stream.getVideoTracks()[0];
      const caps = (track?.getCapabilities ? track.getCapabilities() : {}) as any;
      if (caps && caps.torch) {
        setHasTorch(true);
      }

      setHasCamera(true);
      setCameraActive(true);
      scanVideoFrames();
    } catch (err: any) {
      console.warn("Manager scanner camera init notice:", err);
      setHasCamera(false);
      setCameraError(err.message || "Unable to access camera.");
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    isDetectingRef.current = false;
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      } catch {}
    }
  };

  const toggleCamera = () => {
    if (cameraActive) {
      stopCamera();
      setCameraActive(false);
    } else {
      setCameraActive(true);
      startCamera();
    }
  };

  const scanVideoFrames = async () => {
    if (!isMountedRef.current) return;

    if (!videoRef.current || videoRef.current.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrames);
      return;
    }

    if (isDetectingRef.current) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrames);
      return;
    }

    const BarcodeDetectorClass = typeof window !== "undefined" ? (window as any).BarcodeDetector : null;
    if (BarcodeDetectorClass) {
      isDetectingRef.current = true;
      try {
        const detector = new BarcodeDetectorClass({
          formats: ["qr_code", "ean_13", "ean_8", "upc_a", "code_128", "code_39"],
        });

        const barcodes = await detector.detect(videoRef.current);
        if (isMountedRef.current && barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            handleDetectedCode(rawValue);
          }
        }
      } catch {} finally {
        setTimeout(() => {
          if (isMountedRef.current) {
            isDetectingRef.current = false;
          }
        }, 500);
      }
    }

    if (isMountedRef.current) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrames);
    }
  };

  const handleDetectedCode = (scannedCode: string) => {
    const clean = scannedCode.trim();
    if (!clean || !isMountedRef.current || verifying || successMsg) return;

    const now = Date.now();
    if (lastScanRef.current) {
      const isSameCode = lastScanRef.current.code.toLowerCase() === clean.toLowerCase();
      const elapsed = now - lastScanRef.current.time;
      if (isSameCode && elapsed < 2500) return;
    }

    lastScanRef.current = { code: clean, time: now };
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 400);

    // Stop alert bell once scanned
    stopManagerBellSound();

    setCode(clean);
    handleSubmitCode(clean);
  };

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
        stopCamera();
        stopManagerBellSound();
        setTimeout(() => {
          onAuthorized(promotion || null, res.managerName!);
          handleClose();
        }, 500);
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

  if (!isOpen || (!promotion && !actionTitle)) return null;

  return (
    <div
      className={
        overlayMode === "section"
          ? "absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
          : "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
      }
      onClick={handleClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative ring-1 ring-border/50 flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-black/5 dark:bg-white/5 shrink-0">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
              Manager Approval Required to Apply offer
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Cancel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5 overflow-y-auto">
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

          {/* Live Camera Scanner Viewport (Active on open) */}
          {cameraActive && hasCamera && (
            <div className="relative w-full aspect-16/10 sm:aspect-16/9 bg-black rounded-2xl overflow-hidden border border-border shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Aim Target */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                <div
                  className={`relative w-44 h-32 sm:w-52 sm:h-36 border-2 rounded-2xl overflow-hidden transition-colors ${
                    isFlashing ? "border-emerald-400 bg-emerald-500/15" : "border-brand-500/70"
                  }`}
                >
                  {/* Corner brackets */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-3 border-l-3 border-brand-500 rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-3 border-r-3 border-brand-500 rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-3 border-l-3 border-brand-500 rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-3 border-r-3 border-brand-500 rounded-br-md" />

                  {/* Laser scan line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 shadow-[0_0_8px_#00E35B] animate-[scan_2s_ease-in-out_infinite]" />
                </div>
              </div>

              {/* Torch Toggle */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`absolute top-2.5 right-2.5 p-2 rounded-xl backdrop-blur-md transition-colors cursor-pointer ${
                    torchOn ? "bg-amber-400 text-black shadow-md" : "bg-black/60 text-white hover:bg-black/80"
                  }`}
                  title={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                >
                  {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}

              {/* Aiming Guide Banner */}
              <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/70 text-gray-200 backdrop-blur-sm border border-white/10">
                  Point camera at manager QR badge to authorize
                </span>
              </div>
            </div>
          )}

          {/* Camera fallback if camera is not available */}
          {(!hasCamera || cameraError) && (
            <div className="p-3 bg-black/5 dark:bg-white/5 border border-border rounded-2xl flex items-center justify-between text-xs text-muted-foreground">
              <span className="text-[11px]">Camera unavailable — enter PIN below</span>
              <button
                type="button"
                onClick={startCamera}
                className="px-2 py-1 bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Manual PIN / Code Form */}
          <form onSubmit={handleFormSubmit} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Scan Manager QR Badge or Enter PIN Code
                </label>
                {hasCamera && (
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="text-[11px] text-brand-500 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{cameraActive ? "Hide Camera" : "Show Camera"}</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="password"
                  autoComplete="off"
                  placeholder="Scan QR or enter PIN..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={verifying || Boolean(successMsg)}
                  className="w-full px-4 py-2.5 bg-black/5 dark:bg-white/5 border border-border rounded-xl text-sm font-bold text-foreground placeholder:text-gray-500 placeholder:font-normal focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-1 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
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
  );
}
