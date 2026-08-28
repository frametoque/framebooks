"use client";

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-foreground">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 text-center shadow-lg w-11/12 sm:w-96">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-b from-brand-400 to-brand-500 bg-clip-text text-transparent">500</h1>
        <p className="text-lg mb-6">Something went wrong on our side.</p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-3xl font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
      <p className="mt-8 text-gray-400 text-sm">FrameBookss</p>
    </div>
  );
}
