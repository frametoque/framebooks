import { NextResponse } from 'next/server';
import {  auth  } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0}`;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "User not found or no tenant assigned" }, { status: 403 });
    }
    
    const tenantId = userRows[0].tenant_id;

    const sent = await sql`
      SELECT ti.id, ti.email, ti.status, ti.created_at, u.avatar_url, u.full_name
      FROM team_invitations ti
      LEFT JOIN admin_users u ON LOWER(ti.email) = LOWER(u.email) AND u.deleted_at IS NULL
      WHERE ti.tenant_id = ${tenantId}
      ORDER BY ti.created_at DESC
    `;

    return NextResponse.json({ sent: sent || [] });
  } catch (error: any) {
    console.error("Failed to fetch sent invitations:", error);
    return NextResponse.json({ sent: [] });
  }
}
