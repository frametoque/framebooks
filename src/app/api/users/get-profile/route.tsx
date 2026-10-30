import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId, session } = await auth();
    if (!userId || !session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const sessionEmail = session.user.email.trim().toLowerCase();
    const dbUserId = (session.user as any).dbId || Number(userId) || 0;

    // Fetch user profile strictly for the authenticated user
    let rows = await sql`
      SELECT
        email,
        full_name,
        phone,
        company,
        website,
        address
      FROM admin_users
      WHERE id = ${dbUserId} OR LOWER(email) = ${sessionEmail}
      LIMIT 1
    `;

    if (rows.length === 0 && sessionEmail) {
      rows = await sql`
        SELECT
          email,
          full_name,
          phone,
          company,
          website,
          address
        FROM admin_clients
        WHERE LOWER(email) = LOWER(${sessionEmail})
        LIMIT 1
      `;
    }

    const user = rows?.[0];

    if (!user) {
      return NextResponse.json({
        success: true,
        profile: null
      });
    }

    return NextResponse.json({
      success: true,
      profile: {
        phone: user.phone || '',
        company: user.company || '',
        website: user.website || '',
        address: user.address || '',
        fullName: user.full_name || '',
        email: user.email || '',
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch profile'
      },
      { status: 500 }
    );
  }
}