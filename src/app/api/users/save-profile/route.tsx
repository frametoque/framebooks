import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { logSystemAction } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    const userId = body.userId || body.id;
    const { email, fullName, phone, company, website, address } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Update admin_users if user exists
    await sql`
      UPDATE admin_users
      SET
        full_name  = COALESCE(NULLIF(${fullName || ''}, ''), full_name),
        phone      = COALESCE(${phone || null}, phone),
        company    = COALESCE(${company || null}, company),
        website    = COALESCE(${website || null}, website),
        address    = COALESCE(${address || null}, address),
        updated_at = NOW()
      WHERE id = ${Number(userId) || 0} OR LOWER(email) = LOWER(${email})
    `;

    // Check if client exists by email
    const byEmail = await sql`
      SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `;

    let result;
    if (byEmail.length > 0) {
      result = await sql`
        UPDATE admin_clients
        SET
          full_name  = COALESCE(NULLIF(${fullName || ''}, ''), full_name),
          phone      = COALESCE(${phone || null}, phone),
          company    = COALESCE(${company || null}, company),
          website    = COALESCE(${website || null}, website),
          address    = COALESCE(${address || null}, address),
          updated_at = NOW()
        WHERE id = ${byEmail[0].id}
        RETURNING
          email,
          full_name,
          phone,
          company,
          website,
          address
      `;
    } else {
      const clientId = 'C-' + Date.now();
      result = await sql`
        INSERT INTO admin_clients (
          id, email, full_name,
          phone, company, website, address,
          active, created_at, updated_at
        ) VALUES (
          ${clientId},
          ${email},
          ${fullName || email},
          ${phone   || null},
          ${company || null},
          ${website || null},
          ${address || null},
          true,
          NOW(),
          NOW()
        )
        RETURNING
          email,
          full_name,
          phone,
          company,
          website,
          address
      `;
    }

    const savedUser = result[0];

    await logSystemAction(`Updated profile settings: "${savedUser.full_name}"`);

    return NextResponse.json({
      success: true,
      profile: {
        phone:    savedUser.phone    || '',
        company:  savedUser.company  || '',
        website:  savedUser.website  || '',
        address:  savedUser.address  || '',
        fullName: savedUser.full_name || '',
        email:    savedUser.email    || '',
      }
    });

  } catch (error) {
    console.error('Save profile error:', error);

    if (error.code === '23505' || error?.message?.includes('unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: 'This email is already associated with another account'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save profile'
      },
      { status: 500 }
    );
  }
}