import React from "react";

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/60 bg-card p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-muted/60 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-muted/60" />
            </div>
            <div className="h-7 w-32 bg-muted/80 rounded-md" />
            <div className="h-2.5 w-20 bg-muted/50 rounded-md" />
          </div>
        ))}
      </div>

      {/* Filter Chips Skeleton */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 bg-muted/60 rounded-xl" />
        ))}
      </div>

      {/* Charts Skeleton Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card p-5 h-80 space-y-4">
          <div className="h-4 w-40 bg-muted/60 rounded-md" />
          <div className="h-60 bg-muted/30 rounded-xl" />
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-5 h-80 space-y-4">
          <div className="h-4 w-32 bg-muted/60 rounded-md" />
          <div className="h-60 bg-muted/30 rounded-xl" />
        </div>
      </div>

      {/* Activity Lists Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 h-64 space-y-3">
            <div className="h-4 w-32 bg-muted/60 rounded-md" />
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-12 bg-muted/30 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
