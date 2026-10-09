import React from 'react';
import { Crown, ShieldCheck } from 'lucide-react';

export function formatLKR(amount: number | null | undefined, compact: boolean = false): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "0 LKR";
  const isLarge = compact && Math.abs(amount) >= 10000;
  const num = new Intl.NumberFormat(isLarge ? 'en-US' : 'en-LK', {
    notation: isLarge ? 'compact' : 'standard',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${num} LKR`;
}

export function Money({ amount, compact = false, className = "" }: { amount: number | null | undefined; compact?: boolean; className?: string }) {
  return <span className={`font-semibold tabular-nums ${className}`}>{formatLKR(amount, compact)}</span>;
}

export function PlanBadge({ plan, className = "" }: { plan: string | null | undefined; className?: string }) {
  const p = (plan || 'Free').toLowerCase();
  if (p === 'pro_plus' || p === 'pro plus') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30 ${className}`}>
        PRO +
      </span>
    );
  }
  if (p === 'pro') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 ${className}`}>
        PRO
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/20 ${className}`}>
      FREE
    </span>
  );
}

export function RoleBadge({ role, className = "" }: { role: string | null | undefined; className?: string }) {
  const r = (role || 'member').toLowerCase().trim();
  if (r === 'owner') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${className}`}>
        <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        Owner
      </span>
    );
  }
  if (r === 'admin') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/15 text-brand-700 dark:text-brand-400 border border-brand-500/30 ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5 text-brand-500 shrink-0" />
        Admin
      </span>
    );
  }
  if (r === 'accountant') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 ${className}`}>
        Accountant
      </span>
    );
  }
  if (r === 'member') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground/80 border border-border ${className}`}>
        Member
      </span>
    );
  }
  if (r === 'viewer') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border ${className}`}>
        Viewer
      </span>
    );
  }
  if (r === 'super_admin') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 ${className}`}>
        Super Admin
      </span>
    );
  }
  if (r === 'support') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 ${className}`}>
        Support
      </span>
    );
  }
  const displayLabel = r.charAt(0).toUpperCase() + r.slice(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground/80 border border-border ${className}`}>
      {displayLabel}
    </span>
  );
}

export function StatusPill({ status, type = 'subscription', className = "" }: { status: string | null | undefined; type?: 'subscription' | 'payment'; className?: string }) {
  const s = (status || 'unknown').toLowerCase();

  // Subscription statuses
  if (type === 'subscription') {
    if (s === 'active') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-green-400 border border-emerald-500/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
      );
    }
    if (s === 'trialing') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Trial
        </span>
      );
    }
    if (s === 'past_due' || s === 'past due') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Past Due
        </span>
      );
    }
    if (s === 'cancelled' || s === 'canceled') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-700 dark:text-gray-400 border border-gray-500/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          Cancelled
        </span>
      );
    }
    if (s === 'expired') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Expired
        </span>
      );
    }
  }

  // Payment statuses
  if (s === 'paid' || s === 'completed') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-700 dark:text-green-400 border border-emerald-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Paid
      </span>
    );
  }
  if (s === 'pending') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Pending
      </span>
    );
  }
  if (s === 'failed') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  if (s === 'refunded' || s === 'partially_refunded') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
        {s === 'partially_refunded' ? 'Partially Refunded' : 'Refunded'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-500 border border-border ${className}`}>
      {status || 'Unknown'}
    </span>
  );
}
