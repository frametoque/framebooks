"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`w-9 h-9 opacity-0 ${className}`} aria-hidden="true" />;
  }

  const isDark = (resolvedTheme || theme) === "dark";

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const nextTheme = isDark ? "light" : "dark";

    // 1. Native View Transitions API for zero-glitch 60fps cross-fade
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      document.startViewTransition(() => {
        setTheme(nextTheme);
      });
      return;
    }

    // 2. Synchronized smooth CSS fallback
    if (typeof document !== "undefined") {
      document.documentElement.classList.add("theme-transitioning");
      setTheme(nextTheme);
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning");
      }, 250);
    } else {
      setTheme(nextTheme);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`relative w-9 h-9 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${className}`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ y: -14, opacity: 0, rotate: -40, scale: 0.7 }}
          animate={{ y: 0, opacity: 1, rotate: 0, scale: 1 }}
          exit={{ y: 14, opacity: 0, rotate: 40, scale: 0.7 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-center pointer-events-none"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
