import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, error: 'User ID or Email is required' },
        { status: 400 }
      );
    }

    // Fetch user profile from admin_users or admin_clients
    let rows = await sql`
      SELECT
        email,
        full_name,
        phone,
        company,
        website,
        address
      FROM admin_users
      WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = LOWER(${email || ''}))
      LIMIT 1
    `;

    if (rows.length === 0 && email) {
      rows = await sql`
        SELECT
          email,
          full_name,
          phone,
          company,
          website,
          address
        FROM admin_clients
        WHERE LOWER(email) = LOWER(${email})
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