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
      className="p-2 rounded-full bg-black/5 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
      aria-label="Toggle Dark Mode"
    >
      {theme === "dark" ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
    </button>
  );
}
