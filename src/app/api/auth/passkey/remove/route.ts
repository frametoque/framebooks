import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/lib/db';

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.id) {
      await sql`DELETE FROM passkeys WHERE id = ${body.id} AND user_id = ${userId}`;
      return NextResponse.json({ success: true });
    }

    // Direct bulk wipe without verifying identity is blocked to prevent App Lock bypass.
    // Bulk removal requires the verified recovery route: /api/auth/passkey/recovery/verify-otp
    return NextResponse.json(
      { error: "Passkey ID is required. To disable App Lock, use the verified email OTP recovery flow." },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to remove passkey:", error);
    return NextResponse.json({ error: "Failed to remove passkey" }, { status: 500 });
  }
}
