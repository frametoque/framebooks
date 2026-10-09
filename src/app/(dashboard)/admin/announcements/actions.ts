// src/app/(dashboard)/admin/announcements/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface AnnouncementData {
  id: number;
  title: string;
  body: string;
  audience: string;
  is_active: boolean;
  type: "info" | "success" | "warning" | "critical";
  dismissible: boolean;
  link_label?: string | null;
  link_url?: string | null;
  priority: number;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  dismissals_count?: number;
  reach_count?: number;
}

export async function getAnnouncementsList(): Promise<AnnouncementData[]> {
  await requireAdmin("manage_announcements");

  const rows = await sql`
    SELECT 
      a.*,
      COALESCE((
        SELECT count(*)::int 
        FROM announcement_dismissals ad 
        WHERE ad.announcement_id = a.id
      ), 0) AS dismissals_count,
      CASE
        WHEN a.audience = 'all' OR a.audience = 'everyone' THEN (
          SELECT count(*)::int FROM admin_users WHERE is_banned = false OR is_banned IS NULL
        )
        WHEN a.audience IN ('free', 'pro', 'pro_plus') THEN (
          SELECT count(*)::int 
          FROM admin_users u
          JOIN tenants t ON u.tenant_id = t.id
          WHERE LOWER(t.plan) = LOWER(a.audience)
        )
        ELSE 1
      END AS reach_count
    FROM announcements a 
    ORDER BY a.priority DESC, a.created_at DESC
  `;

  return rows as unknown as AnnouncementData[];
}

export async function createAnnouncement({
  title,
  body,
  audience = "all",
  type = "info",
  dismissible = true,
  linkLabel,
  linkUrl,
  priority = 0,
  startsAt,
  endsAt,
}: {
  title: string;
  body: string;
  audience?: string;
  type?: "info" | "success" | "warning" | "critical";
  dismissible?: boolean;
  linkLabel?: string;
  linkUrl?: string;
  priority?: number;
  startsAt?: string;
  endsAt?: string;
}) {
  const actor = await requireAdmin("manage_announcements");

  const cleanTitle = title.trim();
  const cleanBody = body.trim();

  if (!cleanTitle || !cleanBody) {
    throw new Error("Title and announcement body are required.");
  }

  // Validate URL (https or relative only, no javascript: or data:)
  let cleanLinkUrl: string | null = null;
  if (linkUrl && linkUrl.trim()) {
    const trimmed = linkUrl.trim();
    if (!trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
      throw new Error("Link URL must start with https:// or /");
    }
    cleanLinkUrl = trimmed;
  }

  const validTypes = ["info", "success", "warning", "critical"];
  const finalType = validTypes.includes(type) ? type : "info";

  const rows = await sql`
    INSERT INTO announcements (
      title, 
      body, 
      audience, 
      type, 
      dismissible, 
      link_label, 
      link_url, 
      priority, 
      is_active, 
      starts_at, 
      ends_at
    )
    VALUES (
      ${cleanTitle},
      ${cleanBody},
      ${audience},
      ${finalType},
      ${dismissible},
      ${linkLabel?.trim() || null},
      ${cleanLinkUrl},
      ${Number(priority) || 0},
      true,
      ${startsAt ? new Date(startsAt) : new Date()},
      ${endsAt ? new Date(endsAt) : null}
    )
    RETURNING id
  `;

  await logAdminAction({
    actor,
    action: "CREATE_ANNOUNCEMENT",
    targetType: "announcement",
    targetId: rows[0].id,
    after: { title: cleanTitle, audience, type: finalType }
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/user/dashboard");
  return { success: true };
}

export async function toggleAnnouncement(id: number, isActive: boolean) {
  const actor = await requireAdmin("manage_announcements");

  await sql`UPDATE announcements SET is_active = ${isActive} WHERE id = ${id}`;

  await logAdminAction({
    actor,
    action: isActive ? "ACTIVATE_ANNOUNCEMENT" : "DEACTIVATE_ANNOUNCEMENT",
    targetType: "announcement",
    targetId: id,
    after: { is_active: isActive }
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/user/dashboard");
  return { success: true };
}

export async function deleteAnnouncement(id: number) {
  const actor = await requireAdmin("manage_announcements");

  await sql`DELETE FROM announcements WHERE id = ${id}`;

  await logAdminAction({
    actor,
    action: "DELETE_ANNOUNCEMENT",
    targetType: "announcement",
    targetId: id,
  });

  revalidatePath("/admin/announcements");
  revalidatePath("/user/dashboard");
  return { success: true };
}

/**
 * User-facing query to fetch active announcements targeted at current user.
 */
export async function getUserAnnouncements(): Promise<AnnouncementData[]> {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const userId = user?.dbId;
    const tenantId = user?.tenantId;

    let userPlan = "Free";
    if (tenantId) {
      const tenantRow = await sql`SELECT plan FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      if (tenantRow.length > 0 && tenantRow[0].plan) {
        userPlan = tenantRow[0].plan;
      }
    }

    const rows = await sql`
      SELECT a.*
      FROM announcements a
      WHERE a.is_active = true
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at IS NULL OR a.ends_at >= NOW())
        AND (
          a.audience = 'all' 
          OR a.audience = 'everyone'
          OR ${userPlan} ILIKE a.audience
          OR (${userId ? String(userId) : ''} != '' AND a.audience = ${userId ? String(userId) : ''})
        )
        AND NOT EXISTS (
          SELECT 1 FROM announcement_dismissals ad
          WHERE ad.announcement_id = a.id
            AND ad.user_id = ${userId || 0}
        )
      ORDER BY a.priority DESC, a.created_at DESC
    `;

    return rows as unknown as AnnouncementData[];
  } catch (err) {
    console.error("Failed to fetch user announcements:", err);
    return [];
  }
}

/**
 * Record user dismissal of an announcement across devices.
 */
export async function dismissAnnouncement(announcementId: number) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.dbId;
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    await sql`
      INSERT INTO announcement_dismissals (announcement_id, user_id, dismissed_at)
      VALUES (${announcementId}, ${userId}, NOW())
      ON CONFLICT (announcement_id, user_id) DO NOTHING
    `;

    revalidatePath("/user/dashboard");
    return { success: true };
  } catch (err: any) {
    console.error("Failed to dismiss announcement:", err);
    return { success: false, error: err.message || "Failed to dismiss" };
  }
}

/**
 * Fetch up to 10 recent announcements for the notification bell popover.
 */
export async function getUserNotifications() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    const userId = user?.dbId;
    const tenantId = user?.tenantId;

    let userPlan = "Free";
    if (tenantId) {
      const tenantRow = await sql`SELECT plan FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      if (tenantRow.length > 0 && tenantRow[0].plan) {
        userPlan = tenantRow[0].plan;
      }
    }

    const rows = await sql`
      SELECT 
        a.id,
        a.title,
        a.body,
        a.type,
        a.link_label,
        a.link_url,
        a.created_at,
        EXISTS(
          SELECT 1 FROM announcement_dismissals ad
          WHERE ad.announcement_id = a.id AND ad.user_id = ${userId || 0}
        ) AS is_read
      FROM announcements a
      WHERE a.is_active = true
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at IS NULL OR a.ends_at >= NOW())
        AND (
          a.audience = 'all' 
          OR a.audience = 'everyone'
          OR ${userPlan} ILIKE a.audience
          OR (${userId ? String(userId) : ''} != '' AND a.audience = ${userId ? String(userId) : ''})
        )
      ORDER BY a.priority DESC, a.created_at DESC
      LIMIT 10
    `;

    return rows.map(r => ({
      ...r,
      is_read: Boolean(r.is_read)
    }));
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    return [];
  }
}
