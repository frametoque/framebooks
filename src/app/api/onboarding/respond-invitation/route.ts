import { NextResponse } from "next/server";
import {  auth, currentUser, clerkClient  } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress || "";

    const { inviteId, action } = await req.json();
    if (!inviteId || !action) return new NextResponse("Bad Request", { status: 400 });

    const sql = neon(process.env.DATABASE_URL!);

    // Verify invite
    const inviteRows = await sql`
      SELECT id, tenant_id, role FROM team_invitations 
      WHERE id = ${inviteId} AND LOWER(email) = LOWER(${email}) AND status = 'pending'
    `;
    
    if (inviteRows.length === 0) {
      return new NextResponse("Invite not found or already processed", { status: 404 });
    }

    const invite = inviteRows[0];
    const tenantId = invite.tenant_id;
    const assignedRole = invite.role || 'Viewer';

    if (action === 'accept') {
      // Check existing user mapping
      const existingUser = await sql`SELECT id FROM admin_users WHERE clerk_id = ${userId}`;
      
      if (existingUser.length === 0) {
        await sql`
          INSERT INTO admin_users (email, full_name, role, clerk_id, tenant_id, created_at)
          VALUES (${email}, ${(user as any)?.firstName + " " + (user as any)?.lastName}, ${assignedRole}, ${userId}, ${tenantId}, NOW())
        `;
      } else {
        await sql`UPDATE admin_users SET tenant_id = ${tenantId}, role = ${assignedRole} WHERE clerk_id = ${userId}`;
      }

      // NextAuth reads tenant_id from the database on next session load, no need to update clerk metadata.

      await sql`UPDATE team_invitations SET status = 'accepted' WHERE id = ${invite.id}`;
      return NextResponse.json({ success: true, redirect: '/user/dashboard' });
      
    } else if (action === 'decline') {
      await sql`UPDATE team_invitations SET status = 'declined' WHERE id = ${invite.id}`;
      return NextResponse.json({ success: true });
    }

    return new NextResponse("Invalid action", { status: 400 });
  } catch (error) {
    console.error("[RESPOND_INVITATION]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
