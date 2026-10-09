import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import sql from '@/lib/db';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  let userId: string | null = null;
  
  if (email) {
    const userRows = await sql`
      SELECT id FROM admin_users 
      WHERE LOWER(email) = LOWER(${email.trim()}) 
      LIMIT 1
    `;
    if (userRows.length === 0) {
      return NextResponse.json({ hasPasskeys: false });
    }
    userId = String(userRows[0].id);
  } else {
    const session = await auth();
    userId = session.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const cookieStore = await cookies();
  const deviceId = cookieStore.get('device_id')?.value;

  if (!deviceId) {
    return NextResponse.json({ hasPasskeys: false });
  }

  try {
    const count = await sql`
      SELECT COUNT(*) as count 
      FROM passkeys 
      WHERE user_id = ${userId} AND device_id = ${deviceId}
    `;
    
    return NextResponse.json({ 
      hasPasskeys: Number(count[0].count) > 0,
    });
  } catch (error) {
    console.error("Failed to check passkeys:", error);
    return NextResponse.json({ hasPasskeys: false });
  }
}
