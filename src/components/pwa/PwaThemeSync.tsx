// src/components/pwa/PwaThemeSync.tsx
"use client";

import { useEffect, useState } from "react";
import { useAccentTheme } from "@/lib/theme/useAccentTheme";

// Store deferred install prompt event globally for any UI trigger
let deferredInstallPrompt: any = null;

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt;
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) return false;
  try {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === "accepted") {
      deferredInstallPrompt = null;
      window.dispatchEvent(new Event("pwa:installed"));
      return true;
    }
  } catch (err) {
    console.warn("PWA install prompt error:", err);
  }
  return false;
}

export default function PwaThemeSync() {
  const { accent } = useAccentTheme();
  const [canInstall, setCanInstall] = useState(false);

  // Sync theme-color and PWA manifest attributes with user selected color
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncColor = accent || "#00E35B";

    // 1. Update or create <meta name="theme-color">
    let metaTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaTheme) {
      metaTheme = document.createElement("meta");
      metaTheme.name = "theme-color";
      document.head.appendChild(metaTheme);
    }
    metaTheme.content = syncColor;

    // 2. Update MS Tile color
    let metaMs = document.querySelector('meta[name="msapplication-TileColor"]') as HTMLMetaElement | null;
    if (!metaMs) {
      metaMs = document.createElement("meta");
      metaMs.name = "msapplication-TileColor";
      document.head.appendChild(metaMs);
    }
    metaMs.content = syncColor;

    // 3. Set cookie so Next.js server actions & manifest SSR read the user's color
    try {
      document.cookie = `fb_accent_color=${encodeURIComponent(syncColor)}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {}

    // 4. Update manifest link with version query to prompt browser cache invalidation
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (manifestLink) {
      const cleanHex = syncColor.replace("#", "");
      manifestLink.href = `/manifest.webmanifest?v=${encodeURIComponent(cleanHex)}`;
    }
  }, [accent]);

  // Register service worker and listen for PWA install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          registration.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });
    }

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      setCanInstall(true);
      window.dispatchEvent(new CustomEvent("pwa:install-ready", { detail: e }));
    };

    const handleAppInstalled = () => {
      deferredInstallPrompt = null;
      setCanInstall(false);
      window.dispatchEvent(new Event("pwa:installed"));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
