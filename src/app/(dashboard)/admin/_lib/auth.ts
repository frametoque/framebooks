import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import { AdminPermission, AdminRole, hasPermission, isStaffRole } from "./permissions";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "./session";

export interface CurrentAdmin {
  id: number;
  email: string;
  name: string;
  systemRole: AdminRole;
  image?: string;
}

/**
 * Validates staff authentication via dedicated admin session token or fallback NextAuth session.
 * Rejects non-staff, banned, or soft-deleted users.
 * Wrapped in React.cache to deduplicate checks within the same request.
 */
export const getAdminUser = cache(async (): Promise<CurrentAdmin | null> => {
  // 1. Dedicated Admin Session Cookie
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

    if (adminToken) {
      const payload = verifyAdminToken(adminToken);
      if (payload?.id) {
        const rows = await sql`
          SELECT id, email, full_name, system_role, is_banned, deleted_at, avatar_url
          FROM admin_users
          WHERE id = ${payload.id}
          LIMIT 1
        `;

        if (rows.length > 0) {
          const user = rows[0];
          const role = (user.system_role || 'user') as AdminRole;

          if (!user.is_banned && !user.deleted_at && isStaffRole(role)) {
            return {
              id: user.id,
              email: user.email,
              name: user.full_name || 'Admin',
              systemRole: role,
              image: user.avatar_url || undefined,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[getAdminUser] Token check error:", err);
  }

  // 2. Fallback to NextAuth session if present with staff role
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const u = session.user as any;
      const role = (u.systemRole || 'user') as AdminRole;

      if (!u.isBanned && isStaffRole(role)) {
        return {
          id: u.dbId || Number(session.user.id) || 1,
          email: session.user.email,
          name: session.user.name || 'Admin',
          systemRole: role,
          image: session.user.image || undefined,
        };
      }
    }
  } catch {}

  return null;
});

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
      ${actor?.id ? String(actor.id) : '0'},
      ${actor?.email || 'admin'},
      ${actor?.systemRole || 'admin'},
      ${action || 'ADMIN_ACTION'},
      ${targetType || null},
      ${targetId !== undefined && targetId !== null ? String(targetId) : null},
      ${before !== undefined && before !== null ? sql.json(before) : null},
      ${after !== undefined && after !== null ? sql.json(after) : null},
      ${ipAddress || '127.0.0.1'},
      ${userAgent || 'unknown'},
      NOW()
    )
  `;
}
