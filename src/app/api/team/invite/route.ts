import { NextResponse } from 'next/server';
import {  auth  } from '@/lib/auth';
import sql from '@/lib/db';
import { checkLimit } from '@/lib/plans';

import { getUserContext, hasPermission } from '@/app/(dashboard)/user/actions/rbac';

export async function POST(req: Request) {
  const { userId, role: userRole, tenantId } = await getUserContext();
  
  if (!userId || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const canManageTeam = await hasPermission(userRole, 'team', 'manage', tenantId);
  if (!canManageTeam) {
    return NextResponse.json({ error: "Forbidden: You do not have permission to manage team members" }, { status: 403 });
  }

  const body = await req.json();
  const email = (body.email || '').trim().toLowerCase();
  const inviteRole = (body.role || 'Viewer').trim();

  // Validate email format
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Only Owner can invite another Owner
  const validRoles = ['Viewer', 'Editor', 'Accountant', 'Admin', 'Owner', 'Cashier', 'Member'];
  if (!validRoles.includes(inviteRole)) {
    return NextResponse.json({ error: "Invalid role specified" }, { status: 400 });
  }

  if (inviteRole.toLowerCase() === 'owner' && userRole?.toLowerCase() !== 'owner') {
    return NextResponse.json({ error: "Only the organization owner can invite another owner" }, { status: 403 });
  }

  try {
    const limitCheck = await checkLimit('team_members');
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: "Your current plan does not allow adding more team members." }, { status: 403 });
    }

    // 2. Check if user already exists in the system
    const targetUserRows = await sql`SELECT id FROM admin_users WHERE email = ${email}`;
    const userExists = targetUserRows && targetUserRows.length > 0;

    // 3. Check if an invitation already exists
    const existingInvite = await sql`
      SELECT id, status FROM team_invitations 
      WHERE email = ${email} AND tenant_id = ${tenantId}
    `;

    if (existingInvite && existingInvite.length > 0) {
      if (existingInvite[0].status === 'pending') {
        return NextResponse.json({ error: "An invitation is already pending for this email." }, { status: 400 });
      }
      if (existingInvite[0].status === 'accepted') {
        return NextResponse.json({ error: "This user is already part of the team." }, { status: 400 });
      }
      // If declined, we can recreate or just update the status to pending and update the role
      await sql`
        UPDATE team_invitations SET status = 'pending', role = ${inviteRole}
        WHERE id = ${existingInvite[0].id}
      `;
    } else {
      // 4. Create new invitation
      await sql`
        INSERT INTO team_invitations (tenant_id, email, status, role) 
        VALUES (${tenantId}, ${email}, 'pending', ${inviteRole})
      `;
    }

    // 5. Send team invitation email
    try {
      const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      const userRows = await sql`SELECT full_name, email FROM admin_users WHERE id = ${userId} LIMIT 1`;
      const businessName = tenantRows[0]?.name || "their workspace";
      const inviterName = userRows[0]?.full_name || "A team member";
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "https://books.frametoque.com";

      const { sendTeamInviteEmail } = await import("@/lib/email");
      await sendTeamInviteEmail(email, {
        inviterName,
        businessName,
        role: inviteRole,
        acceptUrl: `${baseUrl}/onboarding`,
      });
    } catch (emailErr) {
      console.warn("Failed to dispatch team invite email:", emailErr);
    }

    // 6. Return appropriate message
    if (userExists) {
      return NextResponse.json({ 
        success: true, 
        message: "User invited successfully. They will receive an invitation email and dashboard notice." 
      });
    } else {
      return NextResponse.json({ 
        success: true, 
        message: "Invitation sent. Business profile will be auto-assigned after they register." 
      });
    }

  } catch (error: any) {
    console.error("Failed to invite team member:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
