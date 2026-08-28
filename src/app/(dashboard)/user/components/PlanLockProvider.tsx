"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import Link from "next/link";

export function PlanLockProvider({ children, planExpiresAt }: { children: React.ReactNode, planExpiresAt: string | null }) {
  const pathname = usePathname();

  // Settings page is exempt from the lock so users can pay
  const isSettingsPage = pathname === "/user/settings";

  const isExpired = planExpiresAt && new Date(planExpiresAt) < new Date();

  if (isExpired && !isSettingsPage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-[#0a0a0a]">
        <div className="w-20 h-20 bg-brand-500/10 text-brand-500 rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(var(--brand-500),0.15)]">
          <Lock size={40} />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">Subscription Expired</h1>
        <p className="text-gray-400 mb-8 max-w-md mx-auto leading-relaxed">
          Your plan has expired. To continue using FrameBooks and access your workspace, please renew your subscription.
        </p>
        <Link 
          href="/user/settings" 
          className="px-8 py-4 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-2xl font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2"
        >
          View Plans & Renew
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
