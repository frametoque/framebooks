import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import {  auth  } from '@/lib/auth';
import sql from '@/lib/db';
import { cookies } from 'next/headers';

const rpID = 'localhost';
const origin = 'http://localhost:3000';

export async function POST(req: Request) {
  const { userId } = await auth();
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get('currentChallenge')?.value;

  if (!expectedChallenge) {
    return NextResponse.json({ error: "No challenge found" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified, registrationInfo } = verification;

    if (verified && registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;
      const { publicKey, id, counter } = credential;
      
      const publicKeyHex = Buffer.from(publicKey).toString('hex');
      
      let deviceId = cookieStore.get('device_id')?.value;
      if (!deviceId) {
        deviceId = crypto.randomUUID();
      }
      
      await sql`
        INSERT INTO passkeys (
          id, user_id, public_key, counter, device_type, backed_up, name, device_id
        ) VALUES (
          ${id}, ${userId}, ${publicKeyHex}, ${counter}, ${credentialDeviceType}, ${credentialBackedUp}, 'My Device', ${deviceId}
        )
      `;
      
      cookieStore.delete('currentChallenge');
      
      const response = NextResponse.json({ verified: true });
      if (deviceId) {
         response.cookies.set('device_id', deviceId, {
           path: '/',
           httpOnly: true,
           secure: process.env.NODE_ENV === 'production',
           maxAge: 60 * 60 * 24 * 365 * 10 // 10 years
         });
      }
      return response;
    }
    
    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error("Verification failed:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
