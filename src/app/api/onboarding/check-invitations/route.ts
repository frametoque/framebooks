import { NextResponse } from "next/server";
import {  auth, currentUser  } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function GET() {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const email = session?.user?.email?.trim().toLowerCase() || "";

    const sql = neon(process.env.DATABASE_URL!);

    // Check if user is already in admin_users
    const existingUser = await sql`
      SELECT id, tenant_id FROM admin_users 
      WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;
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

    return NextResponse.json({ hasInvitation: false });
  } catch (error: any) {
    console.error("[CHECK_INVITATIONS]", error);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
