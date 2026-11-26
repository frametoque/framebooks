"use client";

import { useEffect, useRef } from "react";

interface HardwareBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
}

/**
 * Web Audio API synthesizer for instant POS hardware feedback without external audio files.
 */
export function playScanSound(type: 'success' | 'error' | 'beep' | 'drawer') {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'drawer') {
      // Cash drawer latch click + bell chime
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(360, ctx.currentTime);
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.06);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1480, ctx.currentTime + 0.04); // Bright bell chime
      gain2.gain.setValueAtTime(0.18, ctx.currentTime + 0.04);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.38);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.04);
      osc2.stop(ctx.currentTime + 0.38);
      return;
    }

    if (type === 'success' || type === 'beep') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note (clean POS beep)
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // Error double-buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch {
    // AudioContext blocked or not allowed until interaction
  }
}

/**
 * Global Hardware Barcode & QR Scanner Listener (USB / Bluetooth).
 * Detects rapid automated keyboard stroke streams ending with 'Enter'.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxIntervalMs = 65,
}: HardwareBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const timingDeltasRef = useRef<number[]>([]);
  const lastHardwareScanTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = performance.now();
      const delta = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // If an Enter / LF keystroke arrives within 350ms of a scanner completion (e.g. CRLF burst), swallow it
      if (e.key === "Enter" && now - lastHardwareScanTimeRef.current < 350) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      // If key is Enter, evaluate if we have a scanned sequence
      if (e.key === "Enter") {
        const buffer = bufferRef.current.trim();
        const deltas = timingDeltasRef.current;

        // Calculate average time between keys
        const avgInterval = deltas.length > 0
          ? deltas.reduce((a, b) => a + b, 0) / deltas.length
          : 999;

        // Standard hardware barcode/QR scanners operate at 10-60ms per keystroke.
        // Human typing is typically > 100ms.
        const isHardwareRapid = deltas.length >= minChars - 1 && avgInterval < maxIntervalMs;
        const isBodyTarget = e.target === document.body;

        if (buffer.length >= minChars && (isHardwareRapid || isBodyTarget)) {
          // Scanner detected - prevent duplicate propagation and clear input text
          lastHardwareScanTimeRef.current = now;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (e.target && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.target.value = "";
          }

          onScan(buffer);
        }

        // Reset buffer
        bufferRef.current = "";
        timingDeltasRef.current = [];
        return;
      }

      // Ignore modifier keys
      if (e.key.length > 1 && e.key !== "Backspace") {
        return;
      }

      // If interval between consecutive keys is too long, reset buffer (user paused or was manual typing)
      if (delta > 300) {
        bufferRef.current = "";
        timingDeltasRef.current = [];
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;
        timingDeltasRef.current.push(delta);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, onScan, minChars, maxIntervalMs]);
}
