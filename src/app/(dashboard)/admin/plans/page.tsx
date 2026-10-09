// src/app/(dashboard)/admin/plans/page.tsx
import React from "react";
import { PlansClient } from "./PlansClient";
import { getPlansWithStats } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const plans = await getPlansWithStats();

  return (
    <div className="space-y-6">
      <PlansClient initialPlans={plans} />
    </div>
  );
}
