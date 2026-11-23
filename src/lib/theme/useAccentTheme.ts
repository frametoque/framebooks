"use client";

import { useEffect, useState } from "react";
import { 
  DEFAULT_ACCENT_HEX, 
  generateChartPalette, 
  isGta6Palette, 
  isF1Palette, 
  isSlCricketPalette,
  isSlFlagPalette,
  isChristmasPalette,
  GTA6_PALETTE_ID, 
  F1_PALETTE_ID,
  SL_CRICKET_PALETTE_ID,
  SL_FLAG_PALETTE_ID,
  CHRISTMAS_PALETTE_ID,
  resolvePaletteId,
  resolveHeroAccentHex
} from "./accent";

export function useAccentTheme() {
  const [accent, setAccent] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const match = document.cookie.match(/(?:^|;\s*)fb_accent_color=([^;]+)/);
        if (match?.[1]) {
          const val = decodeURIComponent(match[1]).trim();
          const resolved = resolvePaletteId(val);
          if (resolved) return resolved;
        }
        const cached = localStorage.getItem("framebooks_accent_color");
        if (cached) {
          const resolved = resolvePaletteId(cached);
          if (resolved) return resolved;
        }
      } catch {}
    }
    return DEFAULT_ACCENT_HEX;
  });

  useEffect(() => {
    const readCurrentAccent = (): string => {
      // 1. Live preview style tag (when user is interacting in Appearance tab)
      const previewTag = document.getElementById("tenant-accent-theme-live-preview");
      if (previewTag && previewTag.textContent) {
        if (previewTag.textContent.includes("--palette-deep-violet")) return GTA6_PALETTE_ID;
        if (previewTag.textContent.includes("--palette-crimson")) return F1_PALETTE_ID;
        if (previewTag.textContent.includes("--palette-sl-blue")) return SL_CRICKET_PALETTE_ID;
        if (previewTag.textContent.includes("--palette-flag-maroon")) return SL_FLAG_PALETTE_ID;
        if (previewTag.textContent.includes("--palette-xmas-crimson")) return CHRISTMAS_PALETTE_ID;
        const match = previewTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 2. Client layout style tag
      const clientTag = document.getElementById("tenant-accent-theme-client");
      if (clientTag && clientTag.textContent) {
        if (clientTag.textContent.includes("--palette-deep-violet")) return GTA6_PALETTE_ID;
        if (clientTag.textContent.includes("--palette-crimson")) return F1_PALETTE_ID;
        if (clientTag.textContent.includes("--palette-sl-blue")) return SL_CRICKET_PALETTE_ID;
        if (clientTag.textContent.includes("--palette-flag-maroon")) return SL_FLAG_PALETTE_ID;
        if (clientTag.textContent.includes("--palette-xmas-crimson")) return CHRISTMAS_PALETTE_ID;
        const match = clientTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 3. SSR style tag
      const ssrTag = document.getElementById("tenant-accent-theme-ssr");
      if (ssrTag && ssrTag.textContent) {
        if (ssrTag.textContent.includes("--palette-deep-violet")) return GTA6_PALETTE_ID;
        if (ssrTag.textContent.includes("--palette-crimson")) return F1_PALETTE_ID;
        if (ssrTag.textContent.includes("--palette-sl-blue")) return SL_CRICKET_PALETTE_ID;
        if (ssrTag.textContent.includes("--palette-flag-maroon")) return SL_FLAG_PALETTE_ID;
        if (ssrTag.textContent.includes("--palette-xmas-crimson")) return CHRISTMAS_PALETTE_ID;
        const match = ssrTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 4. Cookie
      if (typeof window !== "undefined") {
        try {
          const match = document.cookie.match(/(?:^|;\s*)fb_accent_color=([^;]+)/);
          if (match?.[1]) {
            const val = decodeURIComponent(match[1]).trim();
            const resolved = resolvePaletteId(val);
            if (resolved) return resolved;
          }
        } catch {}

        // 5. Local storage cache
        try {
          const cached = localStorage.getItem("framebooks_accent_color");
          if (cached) {
            const resolved = resolvePaletteId(cached);
            if (resolved) return resolved;
          }
        } catch {}

        // 6. Computed style from root element
        const comp = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
        if (comp && /^#[0-9a-fA-F]{6}$/i.test(comp)) {
          return comp.toUpperCase();
        }
      }

      return DEFAULT_ACCENT_HEX;
    };

    setAccent(readCurrentAccent());

    const handleAccentChange = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        const resolved = resolvePaletteId(custom.detail);
        if (resolved) {
          setAccent(resolved);
        } else {
          setAccent(readCurrentAccent());
        }
      } else {
        setAccent(readCurrentAccent());
      }
    };

    window.addEventListener("accent:change", handleAccentChange);

    // Observe document head and body for style changes
    const observer = new MutationObserver(() => {
      setAccent(readCurrentAccent());
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    return () => {
      window.removeEventListener("accent:change", handleAccentChange);
      observer.disconnect();
    };
  }, []);

  const chartPalette = generateChartPalette(accent, 8);
  const resolvedAccent = resolveHeroAccentHex(accent);

  return {
    accent: resolvedAccent,
    themeId: accent,
    isGta6: isGta6Palette(accent),
    isF1: isF1Palette(accent),
    isSlCricket: isSlCricketPalette(accent),
    isSlFlag: isSlFlagPalette(accent),
    isChristmas: isChristmasPalette(accent),
    chartPalette,
  };
}
