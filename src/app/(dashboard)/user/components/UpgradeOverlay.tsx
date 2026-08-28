import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';

interface UpgradeOverlayProps {
  children: React.ReactNode;
  title: string;
  description: string;
  requiredPlan: 'Pro' | 'Pro Plus';
}

export function UpgradeOverlay({ children, title, description, requiredPlan }: UpgradeOverlayProps) {
  return (
    <div className="relative w-full h-full min-h-[60vh] flex flex-col items-center justify-center z-10 p-6 text-center bg-background">
      <div className="w-16 h-16 bg-brand-500/10 text-brand-500 rounded-2xl flex items-center justify-center mb-6 border border-brand-500/20 shadow-xl shadow-brand-500/10">
        <Lock size={32} />
      </div>
      <h2 className="text-3xl font-bold text-foreground mb-3 tracking-tight">{title}</h2>
      <p className="text-slate-300 max-w-md mb-8 leading-relaxed text-sm">
        {description}
      </p>
      <Link 
        href="/user/settings" 
        className="px-8 py-3.5 bg-brand-500 hover:bg-brand-400 text-brand-900 rounded-xl font-bold transition-all shadow-lg shadow-brand-500/25 flex items-center gap-2 transform hover:scale-105 active:scale-95"
      >
        Upgrade to {requiredPlan}
      </Link>
    </div>
  );
}
