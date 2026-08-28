import { NextResponse } from 'next/server';
import {  auth  } from '@/lib/auth';
import sql from '@/lib/db';
import { cookies } from 'next/headers';

export async function GET() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cookieStore = await cookies();
    const currentDeviceId = cookieStore.get('device_id')?.value;

    const passkeys = await sql`
      SELECT id, name, created_at, device_type, backed_up, device_id 
      FROM passkeys 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;

    const enrichedPasskeys = passkeys.map(pk => ({
      ...pk,
      is_current_device: currentDeviceId && pk.device_id === currentDeviceId
    }));

    return NextResponse.json({ passkeys: enrichedPasskeys });
  } catch (error) {
    console.error("Failed to fetch passkeys:", error);
    return NextResponse.json({ passkeys: [] });
  }
}
