import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRows = await sql`
      SELECT u.tenant_id FROM admin_users u WHERE LOWER(u.email) = ${session.user.email.toLowerCase()} LIMIT 1
    `;
    const tenantId = userRows[0]?.tenant_id ? Number(userRows[0].tenant_id) : null;
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "No tenant" }, { status: 403 });
    }

    const movementRows = await sql`
      SELECT COALESCE(MAX(id), 0) as max_id, COALESCE(MAX(created_at), NOW()) as last_at
      FROM stock_movements
      WHERE tenant_id = ${tenantId}
    `;

    return NextResponse.json({
      success: true,
      tenantId,
      version: Number(movementRows[0]?.max_id || 0),
      timestamp: new Date(movementRows[0]?.last_at).getTime(),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
