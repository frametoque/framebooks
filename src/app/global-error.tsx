"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected layout failure without leaking sensitive data
    console.error("Global Layout Error:", error?.message || "An unexpected error occurred");
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#0B0F14] text-[#E2E8F0] min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full text-center space-y-5 bg-[#141A21] border border-[#1E293B] rounded-2xl p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400 font-bold text-xl">
            !
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Something went wrong</h1>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              An unexpected application error occurred. Please try reloading the page.
            </p>
          </div>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-[#00E35B] hover:bg-[#00c950] text-[#041418] font-semibold text-sm rounded-xl transition duration-150 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

