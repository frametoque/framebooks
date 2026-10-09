// src/app/(dashboard)/admin/page.tsx
import React from "react";
import { OverviewClient } from "./OverviewClient";
import { getOverviewStats } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: "7d" | "30d" | "90d" | "12m" }>;
}) {
  const resolvedParams = await searchParams;
  const range = resolvedParams.range || "30d";

  const data = await getOverviewStats(range);

  return (
    <div className="space-y-6">
      <OverviewClient data={data} currentRange={range} />
    </div>
  );
}
