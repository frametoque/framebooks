"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

export function LimitBanner({ exceededLimits }: { exceededLimits: string[] }) {
  const pathname = usePathname();

  if (!exceededLimits || exceededLimits.length === 0) return null;
  if (pathname === "/user/settings") return null;

  return (
    <div className="bg-red-100 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 px-6 py-3 flex items-center justify-between z-50 relative">
      <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
        <AlertTriangle size={18} />
        <span className="text-sm font-medium">
          You have reached the maximum limit for your current plan on: {exceededLimits.join(", ")}.
        </span>
      </div>
      <Link
        href="/user/settings"
        className="text-xs font-semibold px-4 py-1.5 bg-red-200 dark:bg-red-500/20 hover:bg-red-300 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 rounded-lg transition-colors"
      >
        Upgrade Plan
      </Link>
    </div>
  );
}
