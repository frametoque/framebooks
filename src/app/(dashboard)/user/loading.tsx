import React from "react";

export default function UserDashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-muted/60 rounded-xl" />
          <div className="h-4 w-72 bg-muted/40 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-muted/60 rounded-xl" />
          <div className="h-10 w-32 bg-muted/80 rounded-xl" />
        </div>
      </div>

      {/* KPI Stat Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-muted/60 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-muted/40" />
            </div>
            <div className="h-8 w-36 bg-muted/80 rounded-lg" />
            <div className="h-3 w-20 bg-muted/40 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content / Table skeleton */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="h-5 w-40 bg-muted/60 rounded-md" />
          <div className="h-8 w-24 bg-muted/40 rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted/50" />
                <div className="space-y-1.5">
                  <div className="h-4 w-32 bg-muted/70 rounded-md" />
                  <div className="h-3 w-24 bg-muted/40 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-4 w-20 bg-muted/60 rounded-md" />
                <div className="h-6 w-16 bg-muted/40 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
