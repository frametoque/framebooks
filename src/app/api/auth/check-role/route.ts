import { auth } from '@/lib/auth';
import sql from '@/lib/db';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId, session } = await auth();

    if (!userId) {
      return NextResponse.json({ role: null, isAdmin: false });
    }

    const email = session?.user?.email?.trim().toLowerCase();
    const userRows = await sql`
      SELECT u.id, u.tenant_id, u.role, u.system_role, t.id as active_tenant_id, t.payment_status
      FROM admin_users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = ${Number(userId) || 0} OR (u.email IS NOT NULL AND LOWER(u.email) = ${email || ''})
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return NextResponse.json({
        role: null,
        isAdmin: false,
        userId: userId,
        isNewUser: true,
      });
    }

    const dbUser = userRows[0];
    const isAdmin = dbUser.system_role === 'super_admin' || dbUser.system_role === 'admin' || dbUser.role === 'admin';
    const isNewUser = !dbUser.tenant_id || !dbUser.active_tenant_id || dbUser.payment_status === 'pending_payment';

    // Update last_login_at on authentication verification
    sql`UPDATE admin_users SET last_login_at = NOW() WHERE id = ${dbUser.id}`.catch(() => {});

    return NextResponse.json({
      role: dbUser.role,
      systemRole: dbUser.system_role,
      isAdmin: isAdmin,
      userId: dbUser.id,
      isNewUser: isNewUser,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return NextResponse.json(
      { role: null, isAdmin: false, error: String(error) },
      { status: 500 }
    );
  }
}
