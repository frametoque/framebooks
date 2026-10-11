import React from "react";
import { Metadata } from "next";
import { AnalyticsClient } from "./AnalyticsClient";
import { getPlatformAnalytics } from "./actions";

export const metadata: Metadata = {
  title: "Analytics",
};

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getPlatformAnalytics();

  return (
    <div className="space-y-6">
      <AnalyticsClient data={data} />
    </div>
  );
}
