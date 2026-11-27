"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2, Zap, ZapOff } from "lucide-react";
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library";
import { playScanSound } from "./useHardwareBarcodeScanner";

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  title?: string;
  continuous?: boolean;
  overlayMode?: "fixed" | "section";
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onDetected,
  title = "Point Camera at Barcode or QR Scanner",
  continuous = true,
  overlayMode = "fixed",
}: CameraScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; time: number } | null>(null);
  const isDetectingRef = useRef(false);
  const isMountedRef = useRef(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [hasCamera, setHasCamera] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannedCount, setScannedCount] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    isMountedRef.current = isOpen;

    if (!isOpen) {
      stopCamera();
      setScannedCount(0);
      setLastScannedCode(null);
      return;
    }

    startCamera();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener("keydown", handleKeyDown);
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMsg("");
    setLastScannedCode(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported on this browser or connection.");
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
        await videoRef.current.play();

        if (!isMountedRef.current) return;

        // Check torch support
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (caps.torch) {
          setHasTorch(true);
        }

        // Initialize ZXing Universal Reader (Code 128, Code 39, EAN-13, EAN-8, UPC-A, UPC-E, QR, etc.)
        try {
          const hints = new Map();
          const formats = [
            BarcodeFormat.QR_CODE,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.ITF,
            BarcodeFormat.DATA_MATRIX,
            BarcodeFormat.CODABAR,
          ];
          hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
          hints.set(DecodeHintType.TRY_HARDER, true);

          const reader = new BrowserMultiFormatReader(hints, 250);
          zxingReaderRef.current = reader;

          reader.decodeFromStream(stream, videoRef.current, (result) => {
            if (!isMountedRef.current) return;
            if (result) {
              const text = result.getText();
              if (text) {
                handleDetection(text);
              }
            }
          });
        } catch (zxingErr) {
          console.warn("ZXing scanner init fallback:", zxingErr);
        }

        // Also run secondary native BarcodeDetector if available for hardware acceleration
        scanVideoFrames();
      }
    } catch (err: any) {
      console.warn("Camera init failed:", err);
      setHasCamera(false);
      setErrorMsg(err.message || "Unable to access camera. Please grant camera permission.");
    }
  };

  const stopCamera = () => {
    if (zxingReaderRef.current) {
      try {
        zxingReaderRef.current.reset();
      } catch {}
      zxingReaderRef.current = null;
    }

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

    // Native BarcodeDetector API for browsers that support it
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
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
            handleDetection(rawValue);
          }
        }
      } catch {} finally {
        setTimeout(() => {
          if (isMountedRef.current) {
            isDetectingRef.current = false;
          }
        }, 300);
      }
    }

    if (isMountedRef.current) {
      animFrameRef.current = requestAnimationFrame(scanVideoFrames);
    }
  };

  const handleDetection = (code: string) => {
    const clean = code.trim();
    if (!clean || !isMountedRef.current) return;

    const now = Date.now();
    // Debounce: prevent duplicate scan of identical barcode within 1800ms, and allow distinct items after 350ms
    if (lastScanRef.current) {
      const isSameCode = lastScanRef.current.code.toLowerCase() === clean.toLowerCase();
      const elapsed = now - lastScanRef.current.time;
      if (isSameCode && elapsed < 1800) {
        return;
      }
      if (elapsed < 350) {
        return;
      }
    }

    lastScanRef.current = { code: clean, time: now };
    setLastScannedCode(clean);
    setScannedCount((prev) => prev + 1);
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 400);

    onDetectedRef.current(clean);

    if (!continuous) {
      stopCamera();
      setTimeout(() => {
        onCloseRef.current();
      }, 400);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDetection(manualCode);
    setManualCode("");
  };

  if (!isOpen) return null;

  return (
    <div
      className={
        overlayMode === "section"
          ? "absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          : "fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      }
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-border/50 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-black/5 dark:bg-white/5">
          <div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-foreground rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Close scanner (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport */}
        <div
          className={`relative w-full aspect-4/3 bg-black flex items-center justify-center overflow-hidden transition-all duration-200 ${
            isFlashing ? "ring-4 ring-emerald-400" : ""
          }`}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Scanner Overlay / Aim Target */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-8">
            <div
              className={`relative w-64 h-48 border-2 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-colors ${
                isFlashing ? "border-emerald-400 bg-emerald-500/10" : "border-brand-500/50"
              }`}
            >
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-brand-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-brand-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-brand-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-brand-500 rounded-br-lg" />

              {/* Animated Laser Scanning Line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-500 shadow-[0_0_8px_#00E35B] animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>

          {/* Live Scanned Counter / Feedback */}
          {lastScannedCode && (
            <div className="absolute inset-x-6 top-6 bg-brand-500 text-brand-950 px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-between shadow-2xl animate-in zoom-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="truncate max-w-[260px]">Added: {lastScannedCode}</span>
              </div>
              <span className="bg-brand-600/30 text-brand-950 px-2 py-0.5 rounded-full text-[10px]">
                {scannedCount} items in batch
              </span>
            </div>
          )}

          {/* Torch & Camera Controls */}
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`absolute top-4 right-4 p-3 rounded-2xl backdrop-blur-md transition-colors ${
                torchOn ? "bg-amber-400 text-black shadow-lg" : "bg-black/50 text-white hover:bg-black/70"
              }`}
              title={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
            >
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {/* Error / Fallback State */}
          {errorMsg && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
              <h4 className="text-white font-bold text-sm mb-1">Camera Stream Unavailable</h4>
              <p className="text-gray-400 text-xs max-w-xs mb-4">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-brand-900 rounded-xl font-bold text-xs hover:bg-brand-400 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Footer: End Product Scan Button & Manual Code Input */}
        <div className="p-5 bg-card border-t border-border flex flex-col gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 px-4 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>End Product Scan ({scannedCount} scanned)</span>
            <kbd className="text-[10px] bg-brand-600/30 text-brand-950 px-2 py-0.5 rounded-md font-sans font-bold">Esc</kbd>
          </button>

          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Or enter barcode / SKU manually..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-black/5 dark:bg-white/5 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground outline-none focus:border-brand-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-black/10 dark:bg-white/10 hover:bg-brand-500 hover:text-brand-950 disabled:opacity-40 text-foreground font-bold rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap border border-border flex items-center gap-1.5"
            >
              <span>Add Code</span>
              <kbd className="text-[10px] bg-black/20 dark:bg-white/20 px-1 py-0.5 rounded font-bold">Enter</kbd>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
