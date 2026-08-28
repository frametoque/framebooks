import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { logSystemAction } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();

    const clerkId = body.clerkId || body.clerk_id;
    const { email, fullName, phone, company, website, address } = body;

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if a row already exists for this clerk_id
    const existing = await sql`
      SELECT id FROM admin_clients WHERE clerk_id = ${clerkId}
      LIMIT 1
    `;

    let result;

    if (existing.length > 0) {
      // Update existing admin_clients row
      result = await sql`
        UPDATE admin_clients
        SET
          email      = ${email},
          full_name  = ${fullName || ''},
          phone      = ${phone    || null},
          company    = ${company  || null},
          website    = ${website  || null},
          address    = ${address  || null},
          updated_at = NOW()
        WHERE clerk_id = ${clerkId}
        RETURNING
          clerk_id,
          email,
          full_name,
          phone,
          company,
          website,
          address
      `;
    } else {
      // Check if a row already exists for this email (e.g. manually added by admin)
      const byEmail = await sql`
        SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${email})
        LIMIT 1
      `;

      if (byEmail.length > 0) {
        // Link the existing row to this clerk_id and update profile data
        result = await sql`
          UPDATE admin_clients
          SET
            clerk_id   = ${clerkId},
            full_name  = COALESCE(NULLIF(full_name, ''), ${fullName || ''}),
            phone      = COALESCE(phone,    ${phone   || null}),
            company    = COALESCE(company,  ${company || null}),
            website    = COALESCE(website,  ${website || null}),
            address    = COALESCE(address,  ${address || null}),
            updated_at = NOW()
          WHERE LOWER(email) = LOWER(${email})
          RETURNING
            clerk_id,
            email,
            full_name,
            phone,
            company,
            website,
            address
        `;
      } else {
        // Entirely new client — create a row in admin_clients
        const clientId = 'C-' + Date.now();
        result = await sql`
          INSERT INTO admin_clients (
            id, clerk_id, email, full_name,
            phone, company, website, address,
            active, created_at, updated_at
          ) VALUES (
            ${clientId},
            ${clerkId},
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
            clerk_id,
            email,
            full_name,
            phone,
            company,
            website,
            address
        `;
      }
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