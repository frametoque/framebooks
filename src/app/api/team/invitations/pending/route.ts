import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const { userId, session } = await auth();
  
  if (!userId && !session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userEmail = session?.user?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: "Primary email not found" }, { status: 400 });
    }

    const pending = await sql`
      SELECT ti.id, ti.tenant_id, t.name as tenant_name, ti.created_at
      FROM team_invitations ti
      JOIN tenants t ON ti.tenant_id::integer = t.id
      WHERE ti.email = ${userEmail} AND ti.status = 'pending'
      ORDER BY ti.created_at DESC
    `;

    return NextResponse.json({ pending: pending || [] });
  } catch (error: any) {
    console.error("Failed to fetch pending invitations:", error);
    return NextResponse.json({ pending: [] });
  }
}
