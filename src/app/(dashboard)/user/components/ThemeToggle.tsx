"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { MdDarkMode, MdLightMode } from "react-icons/md";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 opacity-0" />;
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-full bg-card border border-border text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/20 shadow-xs transition-colors cursor-pointer"
      aria-label="Toggle Dark Mode"
    >
      {theme === "dark" ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
    </button>
  );
}
