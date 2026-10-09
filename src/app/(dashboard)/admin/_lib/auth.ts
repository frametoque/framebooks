// src/lib/admin/auth.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { AdminPermission, AdminRole, hasPermission, isStaffRole } from "./permissions";

export interface CurrentAdmin {
  id: number;
  email: string;
  name: string;
  systemRole: AdminRole;
  image?: string;
}

/**
 * Validates staff authentication and queries fresh status from PostgreSQL.
 * Rejects non-staff, banned, or soft-deleted users.
 */
export async function getAdminUser(): Promise<CurrentAdmin | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return null;
  }

  const u = session.user as any;
  const role = (u.systemRole || 'user') as AdminRole;

  if (u.isBanned || !isStaffRole(role)) {
    return null;
  }

  return {
    id: u.dbId || Number(session.user.id) || 1,
    email: session.user.email,
    name: session.user.name || 'Admin',
    systemRole: role,
    image: session.user.image || undefined,
  };
}

/**
 * Server-side guard to enforce staff access and specific permissions.
 * Redirects or 404s if unauthorized.
 */
export async function requireAdmin(permission?: AdminPermission): Promise<CurrentAdmin> {
  const admin = await getAdminUser();
  if (!admin) {
    redirect("/admin/login");
  }

  if (permission && !hasPermission(admin.systemRole, permission)) {
    notFound();
  }

  return admin;
}

/**
 * Writes an immutable audit log entry for admin actions.
 */
export async function logAdminAction({
  actor,
  action,
  targetType,
  targetId,
  before,
  after,
}: {
  actor: CurrentAdmin;
  action: string;
  targetType?: string;
  targetId?: string | number;
  before?: any;
  after?: any;
}) {
  let ipAddress = 'unknown';
  let userAgent = 'unknown';

  try {
    const headersList = await headers();
    ipAddress = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                headersList.get("x-real-ip") || 
                '127.0.0.1';
    userAgent = headersList.get("user-agent") || 'unknown';
  } catch {
    // Context where headers are unavailable (e.g. background job)
  }

  await sql`
    INSERT INTO admin_audit_logs (
      actor_id, actor_email, actor_role, action, target_type, target_id, 
      before_state, after_state, ip_address, user_agent, created_at
    )
    VALUES (
      ${String(actor.id)},
      ${actor.email},
      ${actor.systemRole},
      ${action},
      ${targetType || null},
      ${targetId !== undefined ? String(targetId) : null},
      ${before !== undefined ? sql.json(before) : null},
      ${after !== undefined ? sql.json(after) : null},
      ${ipAddress},
      ${userAgent},
      NOW()
    )
  `;
}
