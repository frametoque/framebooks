import { NextResponse } from "next/server";
import {  auth, currentUser  } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || "";

    const sql = neon(process.env.DATABASE_URL!);

    // Check if user is already in admin_users
    const existingUser = await sql`SELECT id, tenant_id FROM admin_users WHERE clerk_id = ${userId}`;
    if (existingUser.length > 0 && existingUser[0].tenant_id) {
      return NextResponse.json({ hasInvitation: false, redirect: '/user/dashboard' });
    }

    // Check for pending invitations
    const pendingInvites = await sql`
      SELECT ti.id, ti.tenant_id, t.name as tenant_name 
      FROM team_invitations ti
      JOIN tenants t ON ti.tenant_id = t.id::text
      WHERE LOWER(ti.email) = LOWER(${email}) AND ti.status = 'pending'
      ORDER BY ti.created_at DESC LIMIT 1
    `;

    if (pendingInvites.length > 0) {
      const invite = pendingInvites[0];
      return NextResponse.json({ 
        hasInvitation: true, 
        invite: {
          id: invite.id,
          tenantName: invite.tenant_name
        }
      });
    }

    return NextResponse.json({ hasInvitation: false, debug: { email, pendingInvitesLength: pendingInvites.length } });
  } catch (error: any) {
    console.error("[CHECK_INVITATIONS]", error);
    return NextResponse.json({ error: "Internal Error", msg: error.message }, { status: 500 });
  }
}
