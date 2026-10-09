"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#071317] text-white px-6">
      <div className="flex flex-col items-center text-center max-w-md w-full bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-10 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6">
          <span className="text-2xl font-black text-rose-400">500</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="w-full px-5 py-3 bg-[#00E35B] hover:bg-[#00C750] text-[#041418] rounded-xl font-bold text-sm transition-all shadow-md cursor-pointer"
        >
          Try Again
        </button>
      </div>
      <p className="mt-8 text-gray-500 text-xs">Framebooks</p>
    </div>
  );
}
