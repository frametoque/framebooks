import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import sql from '@/lib/db';
import {  clerkClient, auth  } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  let userId;
  
  if (email) {
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: [email] });
    if (users.data.length === 0) {
      return NextResponse.json({ hasPasskeys: false });
    }
    userId = users.data[0].id;
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
