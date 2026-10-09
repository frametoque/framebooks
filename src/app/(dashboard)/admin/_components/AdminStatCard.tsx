// src/app/(dashboard)/admin/_components/AdminStatCard.tsx
"use client";

import React from "react";
import AnimatedNumber from "@/app/(dashboard)/user/components/AnimatedNumber";

export interface AdminStatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  trend?: string;
  trendUp?: boolean;
}

export function AdminStatCard({
  label,
  value,
  unit,
  icon: Icon,
  iconBg = "bg-brand-500/15 dark:bg-brand-400/10",
  iconColor = "text-brand-700 dark:text-brand-400",
  trend,
  trendUp,
}: AdminStatCardProps) {
  return (
    <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
      <div className={`p-3.5 rounded-2xl ${iconBg} shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-gray-700 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider truncate">
          {label}
        </p>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            <AnimatedNumber value={value} />
          </span>
          {unit && (
            <span className="text-xs font-medium text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
        {trend && (
          <p className={`text-[11px] font-medium mt-1 flex items-center gap-1 ${
            trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          }`}>
            {trend}
          </p>
        )}
      </div>
    </div>
  );
}
