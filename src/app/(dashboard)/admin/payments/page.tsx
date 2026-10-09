// src/app/(dashboard)/admin/payments/page.tsx
import React from "react";
import sql from "@/lib/db";
import { PaymentsClient } from "./PaymentsClient";
import { getPaymentsList, getPaymentsSummary } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    status?: string;
    method?: string;
    plan?: string;
    page?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);

  const [data, summary, allPlans, allTenants] = await Promise.all([
    getPaymentsList({
      search: resolvedParams.search,
      status: resolvedParams.status,
      method: resolvedParams.method,
      plan: resolvedParams.plan,
      page,
    }),
    getPaymentsSummary(),
    sql`SELECT * FROM plans ORDER BY sort_order ASC`,
    sql`SELECT id, name, plan, currency FROM tenants ORDER BY name ASC`,
  ]);

  return (
    <div className="space-y-6">
      <PaymentsClient
        initialData={data}
        summary={summary}
        searchParams={resolvedParams}
        allPlans={allPlans}
        allTenants={allTenants}
      />
    </div>
  );
}
