import { NextResponse } from "next/server";
import { auth } from '@/lib/auth';
import postgres from "postgres";
const neon = postgres;

export async function POST(req: Request) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const fullName = session?.user?.name || "";

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
      const existingUser = await sql`
        SELECT id FROM admin_users 
        WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = ${email})
        LIMIT 1
      `;
      
      if (existingUser.length === 0) {
        await sql`
          INSERT INTO admin_users (email, full_name, role, tenant_id, created_at)
          VALUES (${email}, ${fullName}, ${assignedRole}, ${tenantId}, NOW())
          ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role
        `;
      } else {
        await sql`UPDATE admin_users SET tenant_id = ${tenantId}, role = ${assignedRole} WHERE id = ${existingUser[0].id}`;
      }

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
