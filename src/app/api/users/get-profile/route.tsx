import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clerkId = searchParams.get('userId');

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const email = searchParams.get('email');

    // Fetch client profile from admin_clients using clerk_id or matching email
    let rows = await sql`
      SELECT
        clerk_id,
        email,
        full_name,
        phone,
        company,
        website,
        address
      FROM admin_clients
      WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;

    if (rows.length === 0 && email) {
      rows = await sql`
        SELECT
          clerk_id,
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

      if (rows.length > 0) {
        // Auto-link clerk_id to this client record
        await sql`
          UPDATE admin_clients
          SET clerk_id = ${clerkId}, updated_at = NOW()
          WHERE LOWER(email) = LOWER(${email}) AND (clerk_id IS NULL OR clerk_id = '')
        `;
      }
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
        clerk_id: user.clerk_id || '',
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