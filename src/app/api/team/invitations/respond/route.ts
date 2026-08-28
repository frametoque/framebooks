import { NextResponse } from 'next/server';
import {  auth, clerkClient  } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invitationId, action } = await req.json();
  
  if (!invitationId || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: "Invalid action or missing invitation ID" }, { status: 400 });
  }

  try {
    // Check if invitation belongs to current user
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const primaryEmailObj = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
    
    if (!primaryEmailObj) {
      return NextResponse.json({ error: "Primary email not found" }, { status: 400 });
    }
    const userEmail = primaryEmailObj.emailAddress;

    const inviteRows = await sql`
      SELECT id, tenant_id FROM team_invitations 
      WHERE id = ${invitationId} AND email = ${userEmail} AND status = 'pending'
    `;

    if (!inviteRows || inviteRows.length === 0) {
      return NextResponse.json({ error: "Invitation not found or already processed" }, { status: 404 });
    }

    const tenantId = inviteRows[0].tenant_id;

    if (action === 'accept') {
      // 1. Update invitation status
      await sql`
        UPDATE team_invitations SET status = 'accepted' WHERE id = ${invitationId}
      `;
      // 2. Update user's tenant
      await sql`
        UPDATE admin_users SET tenant_id = ${tenantId} WHERE clerk_id = ${userId}
      `;
      return NextResponse.json({ success: true, message: "Invitation accepted. You are now part of the new team." });
    } else {
      // Decline
      await sql`
        UPDATE team_invitations SET status = 'declined' WHERE id = ${invitationId}
      `;
      return NextResponse.json({ success: true, message: "Invitation declined." });
    }

  } catch (error: any) {
    console.error("Failed to respond to invitation:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
