import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import sql from '@/lib/db';
import { cookies } from 'next/headers';
import {  auth  } from '@/lib/auth';

export async function POST(req: Request) {
  const rpID = new URL(req.url).hostname;
  const origin = new URL(req.url).origin;
  const body = await req.json();
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get('currentChallenge')?.value;
  
  let userId = cookieStore.get('current2FAUser')?.value;
  if (!userId) {
    const session = await auth();
    userId = session.userId;
  }

  if (!expectedChallenge || !userId) {
    return NextResponse.json({ error: "No active 2FA challenge" }, { status: 400 });
  }

  try {
    // Find the passkey in our database
    const dbPasskeys = await sql`SELECT public_key, counter FROM passkeys WHERE id = ${body.id} AND user_id = ${userId}`;
    
    if (dbPasskeys.length === 0) {
      return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
    }

    const authenticator = dbPasskeys[0];
    const publicKeyBuffer = Buffer.from(authenticator.public_key, 'hex');

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: body.id,
        publicKey: publicKeyBuffer,
        counter: authenticator.counter,
        transports: ['internal'],
      },
    });

    const { verified, authenticationInfo } = verification;

    if (verified) {
      // Update the counter
      await sql`UPDATE passkeys SET counter = ${authenticationInfo.newCounter} WHERE id = ${body.id}`;
      
      cookieStore.delete('currentChallenge');
      cookieStore.delete('current2FAUser');
      
      return NextResponse.json({ verified: true });
    }
    
    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error("2FA Verification failed:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
