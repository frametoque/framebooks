import { NextResponse } from "next/server";
import {  auth, currentUser  } from '@/lib/auth';
import sql from "@/lib/db";

export async function GET() {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const email = session?.user?.email?.trim().toLowerCase() || "";

    // Check if user already owns a business profile
    const ownedTenantRows = await sql`
      SELECT id, plan, payment_status FROM tenants 
      WHERE LOWER(owner_email) = ${email}
      LIMIT 1
    `;
    if (ownedTenantRows.length > 0) {
      const tenant = ownedTenantRows[0];
      if (tenant && tenant.payment_status === 'pending_payment') {
        return NextResponse.json({ hasInvitation: false, isPendingPayment: true, tenantId: tenant.id });
      }
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
