import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user) {
      return NextResponse.json({ announcements: [] });
    }

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

    return NextResponse.json(
      { announcements: rows },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("Failed to fetch user announcements:", err);
    return NextResponse.json({ announcements: [] });
  }
}
