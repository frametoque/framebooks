// src/app/(dashboard)/admin/audit-logs/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin } from "@/app/(dashboard)/admin/_lib/auth";

export async function getAuditLogsList({
  actor = "",
  action = "",
  target = "",
  page = 1,
  limit = 20,
}: {
  actor?: string;
  action?: string;
  target?: string;
  page?: number;
  limit?: number;
}) {
  await requireAdmin("view_audit_logs");

  const offset = (Math.max(1, page) - 1) * limit;
  const actorPattern = actor ? `%${actor.trim()}%` : null;
  const targetPattern = target ? `%${target.trim()}%` : null;

  const logs = await sql`
    SELECT *
    FROM admin_audit_logs
    WHERE (${actorPattern}::text IS NULL OR actor_email ILIKE ${actorPattern} OR actor_id ILIKE ${actorPattern})
      AND (${action || null}::text IS NULL OR action = ${action})
      AND (${targetPattern}::text IS NULL OR target_type ILIKE ${targetPattern} OR target_id ILIKE ${targetPattern})
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalCountResult = await sql`
    SELECT COUNT(*)
    FROM admin_audit_logs
    WHERE (${actorPattern}::text IS NULL OR actor_email ILIKE ${actorPattern} OR actor_id ILIKE ${actorPattern})
      AND (${action || null}::text IS NULL OR action = ${action})
      AND (${targetPattern}::text IS NULL OR target_type ILIKE ${targetPattern} OR target_id ILIKE ${targetPattern})
  `;

  const totalCount = parseInt(totalCountResult[0].count);

  return {
    logs,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
  };
}
