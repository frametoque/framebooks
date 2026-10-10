"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ACCENT_HEX, generateChartPalette } from "./accent";

export function useAccentTheme() {
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT_HEX);

  useEffect(() => {
    const readCurrentAccent = (): string => {
      // 1. Live preview style tag (when user is interacting in Appearance tab)
      const previewTag = document.getElementById("tenant-accent-theme-live-preview");
      if (previewTag && previewTag.textContent) {
        const match = previewTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 2. Client layout style tag
      const clientTag = document.getElementById("tenant-accent-theme-client");
      if (clientTag && clientTag.textContent) {
        const match = clientTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 3. SSR style tag
      const ssrTag = document.getElementById("tenant-accent-theme-ssr");
      if (ssrTag && ssrTag.textContent) {
        const match = ssrTag.textContent.match(/--accent:\s*(#[0-9a-fA-F]{6})/);
        if (match?.[1]) return match[1].toUpperCase();
      }

      // 4. Computed style from root element
      if (typeof window !== "undefined") {
        const comp = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
        if (comp && /^#[0-9a-fA-F]{6}$/i.test(comp)) {
          return comp.toUpperCase();
        }

        // 5. Local storage cache
        try {
          const cached = localStorage.getItem("framebooks_accent_color");
          if (cached && /^#[0-9a-fA-F]{6}$/i.test(cached)) {
            return cached.toUpperCase();
          }
        } catch {}
      }

      return DEFAULT_ACCENT_HEX;
    };

    setAccent(readCurrentAccent());

    const handleAccentChange = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail && /^#[0-9a-fA-F]{6}$/i.test(custom.detail)) {
        setAccent(custom.detail.toUpperCase());
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

  return {
    accent,
    chartPalette,
  };
}
