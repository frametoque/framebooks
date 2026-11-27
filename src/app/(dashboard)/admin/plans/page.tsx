import React from "react";
import { Metadata } from "next";
import { PlansClient } from "./PlansClient";
import { getPlansWithStats } from "./actions";
import { getPosAddonPricing } from "@/lib/pos/entitlement";

export const metadata: Metadata = {
  title: "Plans & Pricing",
};

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const [plans, posPricing] = await Promise.all([
    getPlansWithStats(),
    getPosAddonPricing(),
  ]);

  return (
    <div className="space-y-6">
      <PlansClient initialPlans={plans} initialPosPricing={posPricing} />
    </div>
  );
}
