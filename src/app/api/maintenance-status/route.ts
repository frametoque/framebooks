// src/app/api/maintenance-status/route.ts
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      SELECT key, value FROM platform_settings
      WHERE key IN ('maintenance_mode', 'maintenance_message', 'maintenance_allowed_tenants')
    `;

    const map: Record<string, any> = {};
    rows.forEach((r) => { map[r.key] = r.value; });

    const active = Boolean(map.maintenance_mode);
    if (!active) {
      return NextResponse.json(
        { active: false, message: "", allowed: true },
        { headers: { "Cache-Control": "private, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    const message =
      typeof map.maintenance_message === "string"
        ? map.maintenance_message
        : "We're performing scheduled maintenance. We'll be back shortly.";

    const allowedTenants: string[] = Array.isArray(map.maintenance_allowed_tenants)
      ? map.maintenance_allowed_tenants
      : [];

    // Resolve current user's tenant
    const { session } = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ active, message, allowed: false });
    }

    const email = session.user.email.toLowerCase();
    const userRow = await sql`
      SELECT tenant_id FROM admin_users
      WHERE LOWER(email) = ${email}
      LIMIT 1
    `;
    const tenantId = String(userRow[0]?.tenant_id || "");
    const allowed = allowedTenants.includes(tenantId);

    return NextResponse.json({ active, message, allowed });
  } catch {
    // On any error, fail open so users aren't locked out
    return NextResponse.json({ active: false, message: "", allowed: true });
  }
}
