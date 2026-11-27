"use client";

import { useEffect, useRef } from "react";

interface HardwareBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  minChars?: number;
  maxIntervalMs?: number;
}

let currentBellAudioCtx: AudioContext | null = null;
let bellRepeatTimer: any = null;

export function stopManagerBellSound() {
  if (bellRepeatTimer) {
    clearInterval(bellRepeatTimer);
    bellRepeatTimer = null;
  }
  if (currentBellAudioCtx) {
    try {
      currentBellAudioCtx.close();
    } catch {}
    currentBellAudioCtx = null;
  }
}

/**
 * Manager Alert Service Desk Bell Synthesizer.
 * Synthesizes a realistic double-strike brass service/counter bell (Ding-Dong)
 * to alert store managers across the floor when an offer or discount requires manager approval.
 * Distinct from standard barcode scan beeps, error buzzes, or cash drawer clicks.
 */
export function playManagerBellSound() {
  if (typeof window === 'undefined') return;
  stopManagerBellSound();
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    currentBellAudioCtx = ctx;
    const t0 = ctx.currentTime;

    const playBellChime = (startTime: number, freq: number, duration: number, volume: number) => {
      // 1. Primary brass chime oscillator (pure sine)
      const oscPrimary = ctx.createOscillator();
      const gainPrimary = ctx.createGain();
      oscPrimary.type = 'sine';
      oscPrimary.frequency.setValueAtTime(freq, startTime);

      gainPrimary.gain.setValueAtTime(0, startTime);
      gainPrimary.gain.linearRampToValueAtTime(volume, startTime + 0.003);
      gainPrimary.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      oscPrimary.connect(gainPrimary);
      gainPrimary.connect(ctx.destination);
      oscPrimary.start(startTime);
      oscPrimary.stop(startTime + duration);

      // 2. High metallic strike transient (hammer strike ping)
      const oscTransient = ctx.createOscillator();
      const gainTransient = ctx.createGain();
      oscTransient.type = 'triangle';
      oscTransient.frequency.setValueAtTime(freq * 1.5, startTime);

      gainTransient.gain.setValueAtTime(volume * 0.45, startTime);
      gainTransient.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12);

      oscTransient.connect(gainTransient);
      gainTransient.connect(ctx.destination);
      oscTransient.start(startTime);
      oscTransient.stop(startTime + 0.12);

      // 3. Shimmer overtone (lingering brass bell ring)
      const oscShimmer = ctx.createOscillator();
      const gainShimmer = ctx.createGain();
      oscShimmer.type = 'sine';
      oscShimmer.frequency.setValueAtTime(freq * 2.02, startTime);

      gainShimmer.gain.setValueAtTime(volume * 0.3, startTime);
      gainShimmer.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

      oscShimmer.connect(gainShimmer);
      gainShimmer.connect(ctx.destination);
      oscShimmer.start(startTime);
      oscShimmer.stop(startTime + duration * 0.7);
    };

    // First strike: High C7 bell chime (2093 Hz)
    playBellChime(t0, 2093, 0.95, 0.3);

    // Second strike: Harmonious E7 brass bell chime (2637 Hz) at +160ms (Ding-Dong)
    playBellChime(t0 + 0.16, 2637, 1.15, 0.35);
  } catch {
    // AudioContext blocked or user hasn't interacted with page yet
  }
}

/**
 * Web Audio API synthesizer for instant POS hardware feedback without external audio files.
 */
export function playScanSound(type: 'success' | 'error' | 'beep' | 'drawer' | 'bell' = 'beep') {
  if (typeof window === 'undefined') return;
  try {
    if (type === 'bell') {
      playManagerBellSound();
      return;
    }

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
 * Strips hardware scanner AIM symbology prefixes (e.g., ]C1, ]e0, ]Q1),
 * control characters, carriage returns, and trims whitespace.
 */
export function sanitizeBarcode(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  // Strip AIM Symbology Identifiers (e.g., ]C1, ]e0, ]Q1, ]A0)
  clean = clean.replace(/^\][a-zA-Z0-9]{2,3}/, "");
  // Remove non-printable / control ASCII characters
  clean = clean.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  return clean;
}

/**
 * Global Hardware Barcode & QR Scanner Listener (USB / Bluetooth / 2.4GHz).
 * Detects rapid automated keyboard stroke streams ending with 'Enter'.
 */
export function useHardwareBarcodeScanner({
  onScan,
  enabled = true,
  minChars = 3,
  maxIntervalMs = 95,
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
        const rawBuffer = bufferRef.current;
        const cleaned = sanitizeBarcode(rawBuffer);
        const deltas = timingDeltasRef.current;

        // Calculate average time between keys (excluding idle time before first char)
        const avgInterval = deltas.length > 0
          ? deltas.reduce((a, b) => a + b, 0) / deltas.length
          : 0;

        const isTargetInput =
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          Boolean((e.target as HTMLElement)?.isContentEditable);

        // Rapid hardware typing (most scanners 10-60ms per keystroke, up to 95ms over Bluetooth)
        const isHardwareRapid = deltas.length >= 2 && avgInterval < maxIntervalMs;
        // Non-input ambient scan: user is not typing in any text box, scanning directly into the page
        const isAmbientScan = !isTargetInput && rawBuffer.length >= minChars;

        if (cleaned.length >= minChars && (isHardwareRapid || isAmbientScan)) {
          // Scanner detected - prevent duplicate propagation and clear input text
          lastHardwareScanTimeRef.current = now;
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          if (isTargetInput && e.target && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.target.value = "";
          }

          onScan(cleaned);
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
      if (delta > 250) {
        bufferRef.current = "";
        timingDeltasRef.current = [];
      }

      if (e.key.length === 1) {
        // Only record intervals between characters (char 2 onwards), NOT the idle time before char 1!
        if (bufferRef.current.length > 0) {
          timingDeltasRef.current.push(delta);
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, onScan, minChars, maxIntervalMs]);
}
