// src/app/(dashboard)/admin/audit-logs/page.tsx
import React from "react";
import { AuditLogsClient } from "./AuditLogsClient";
import { getAuditLogsList } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    target?: string;
    page?: string;
  }>;
}) {
  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);

  const data = await getAuditLogsList({
    actor: resolvedParams.actor,
    action: resolvedParams.action,
    target: resolvedParams.target,
    page,
  });

  return (
    <div className="space-y-6">
      <AuditLogsClient initialData={data} searchParams={resolvedParams} />
    </div>
  );
}
