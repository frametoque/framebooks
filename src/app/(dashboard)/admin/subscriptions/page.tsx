// src/app/(dashboard)/admin/subscriptions/page.tsx
import React from "react";
import sql from "@/lib/db";
import { SubscriptionsClient } from "./SubscriptionsClient";
import { getUsersList } from "@/app/(dashboard)/admin/users/actions";

export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    plan?: string;
    status?: string;
    role?: string;
    banned?: string;
    page?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);

  const [data, allPlans] = await Promise.all([
    getUsersList({
      search: resolvedParams.search,
      plan: resolvedParams.plan,
      status: resolvedParams.status,
      role: resolvedParams.role,
      banned: resolvedParams.banned,
      page,
      sortBy: resolvedParams.sortBy,
      sortOrder: resolvedParams.sortOrder,
    }),
    sql`SELECT * FROM plans ORDER BY sort_order ASC`,
  ]);

  return (
    <div className="space-y-6">
      <SubscriptionsClient
        initialData={data}
        allPlans={allPlans}
        searchParams={resolvedParams}
      />
    </div>
  );
}
