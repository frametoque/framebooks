// src/components/pwa/InstallPwaButton.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Download, Check } from "lucide-react";
import { promptPwaInstall, getDeferredInstallPrompt } from "./PwaThemeSync";

interface InstallPwaButtonProps {
  className?: string;
  variant?: "button" | "compact" | "banner";
}

export default function InstallPwaButton({ className = "", variant = "button" }: InstallPwaButtonProps) {
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check if prompt is already available
    if (getDeferredInstallPrompt()) {
      setCanInstall(true);
    }

    const handleInstallReady = () => setCanInstall(true);
    const handleInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
    };

    window.addEventListener("pwa:install-ready", handleInstallReady);
    window.addEventListener("pwa:installed", handleInstalled);

    return () => {
      window.removeEventListener("pwa:install-ready", handleInstallReady);
      window.removeEventListener("pwa:installed", handleInstalled);
    };
  }, []);

  if (!canInstall && !installed) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    try {
      await promptPwaInstall();
    } finally {
      setInstalling(false);
    }
  };

  if (installed) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-brand-500 font-semibold px-2 py-1">
        <Check className="w-3.5 h-3.5" />
        <span>Installed</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        title="Install Framebooks App"
        className={`p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-all cursor-pointer flex items-center justify-center gap-2 text-xs font-semibold ${className}`}
      >
        <Download className="w-4 h-4 text-brand-500" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstallClick}
      disabled={installing}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand-500/30 bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 text-xs font-bold transition-all cursor-pointer ${className}`}
    >
      <Download className="w-3.5 h-3.5" />
      <span>Install App</span>
    </button>
  );
}
