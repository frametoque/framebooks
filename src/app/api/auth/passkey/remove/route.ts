import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/lib/db';

export async function POST() {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await sql`DELETE FROM passkeys WHERE user_id = ${userId}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove passkeys:", error);
    return NextResponse.json({ error: "Failed to remove passkeys" }, { status: 500 });
  }
}
