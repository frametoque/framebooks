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
      SELECT id, tenant_id, role, system_role 
      FROM admin_users 
      WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = ${email || ''})
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

    return NextResponse.json({
      role: dbUser.role,
      systemRole: dbUser.system_role,
      isAdmin: isAdmin,
      userId: dbUser.id,
      isNewUser: !dbUser.tenant_id,
    });
  } catch (error) {
    console.error("Error checking role:", error);
    return NextResponse.json(
      { role: null, isAdmin: false, error: String(error) },
      { status: 500 }
    );
  }
}
