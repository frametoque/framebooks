"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import React from "react";

// In React 19 / Next.js 16, next-themes injects an inline script for theme flash prevention.
// React 19 warns against script tags inside components. This filters the harmless false-positive.
if (typeof console !== "undefined" && !(console as unknown as { __scriptTagFiltered?: boolean }).__scriptTagFiltered) {
  (console as unknown as { __scriptTagFiltered?: boolean }).__scriptTagFiltered = true;
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}

