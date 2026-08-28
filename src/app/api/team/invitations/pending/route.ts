import { NextResponse } from 'next/server';
import {  auth, clerkClient  } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primaryEmailObj = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    
    if (!primaryEmailObj) {
      return NextResponse.json({ error: "Primary email not found" }, { status: 400 });
    }
    const userEmail = primaryEmailObj.emailAddress;

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
