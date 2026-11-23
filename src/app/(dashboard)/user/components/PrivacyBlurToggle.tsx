"use client";

import React, { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function PrivacyBlurToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("framebooks_privacy_mode");
      const active = stored === "true";
      setIsBlurred(active);
      if (active) {
        document.documentElement.classList.add("privacy-mode");
      } else {
        document.documentElement.classList.remove("privacy-mode");
      }
    } catch {}

    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<boolean>;
      if (typeof custom.detail === "boolean") {
        setIsBlurred(custom.detail);
      }
    };

    window.addEventListener("privacy-mode:change", handleSync);
    return () => window.removeEventListener("privacy-mode:change", handleSync);
  }, []);

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const nextState = !isBlurred;
    setIsBlurred(nextState);

    try {
      if (nextState) {
        document.documentElement.classList.add("privacy-mode");
        localStorage.setItem("framebooks_privacy_mode", "true");
      } else {
        document.documentElement.classList.remove("privacy-mode");
        localStorage.setItem("framebooks_privacy_mode", "false");
      }
    } catch {}

    window.dispatchEvent(
      new CustomEvent("privacy-mode:change", { detail: nextState })
    );
  };

  if (!mounted) {
    return <div className={`w-9 h-9 opacity-0 ${className}`} aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative w-9 h-9 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${className}`}
      aria-label={isBlurred ? "Show stats numbers" : "Blur stats numbers"}
      title={isBlurred ? "Show stats numbers" : "Blur stats numbers"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isBlurred ? "blurred" : "visible"}
          initial={{ opacity: 0, scale: 0.75, rotate: isBlurred ? -15 : 15 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.75, rotate: isBlurred ? 15 : -15 }}
          transition={{ duration: 0.15, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          {isBlurred ? (
            <EyeOff className="w-4 h-4 text-amber-500" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}

export default PrivacyBlurToggle;
