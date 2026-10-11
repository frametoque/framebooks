import React from "react";
import { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";
import { getOverviewStats } from "./actions";
import { getPlatformAnalytics } from "./analytics/actions";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentYear = new Date().getFullYear();
  const defaultFrom = `${currentYear - 1}-03-31`;
  const defaultTo = `${currentYear}-04-01`;

  const range = resolvedParams.range || "lifetime";
  const from = resolvedParams.from || (range === "custom" ? defaultFrom : undefined);
  const to = resolvedParams.to || (range === "custom" ? defaultTo : undefined);

  const [overviewData, analyticsData] = await Promise.all([
    getOverviewStats(range, from, to),
    getPlatformAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <DashboardClient
        overviewData={overviewData}
        analyticsData={analyticsData}
        currentRange={range}
        customFrom={from || defaultFrom}
        customTo={to || defaultTo}
      />
    </div>
  );
}
