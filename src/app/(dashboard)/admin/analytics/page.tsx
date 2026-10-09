// src/app/(dashboard)/admin/analytics/page.tsx
import React from "react";
import { AnalyticsClient } from "./AnalyticsClient";
import { getPlatformAnalytics } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getPlatformAnalytics();

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} />
    </div>
  );
}
