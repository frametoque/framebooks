import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { logSystemAction } from '@/lib/logger';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { userId, session } = await auth();
    if (!userId || !session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const email = session.user.email.trim().toLowerCase();
    const dbUserId = (session.user as any).dbId || Number(userId) || 0;
    const tenantId = (session.user as any).tenantId;

    const body = await request.json();
    const { fullName, phone, company, website, address } = body;

    // Update admin_users strictly for the authenticated user
    await sql`
      UPDATE admin_users
      SET
        full_name  = COALESCE(NULLIF(${fullName || ''}, ''), full_name),
        phone      = COALESCE(${phone || null}, phone),
        company    = COALESCE(${company || null}, company),
        website    = COALESCE(${website || null}, website),
        address    = COALESCE(${address || null}, address),
        updated_at = NOW()
      WHERE id = ${dbUserId} OR LOWER(email) = ${email}
    `;

    // Check if client exists by email strictly scoped to tenant
    const byEmail = tenantId
      ? await sql`
          SELECT id FROM admin_clients 
          WHERE LOWER(email) = ${email} AND tenant_id = ${tenantId}
          LIMIT 1
        `
      : [];

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
          active, created_at, updated_at, tenant_id
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
          NOW(),
          ${tenantId || null}
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