import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import sql from '@/lib/db';
import { cookies } from 'next/headers';

function getDeviceName(ua: string | null, customName?: string): string {
  if (customName && customName.trim()) return customName.trim();
  if (!ua) return 'Passkey Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Macintosh|Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return 'Mac (Chrome)';
    if (/Safari/i.test(ua)) return 'Mac (Safari)';
    return 'Mac';
  }
  if (/Windows/i.test(ua)) {
    if (/Edg/i.test(ua)) return 'Windows (Edge)';
    if (/Chrome/i.test(ua)) return 'Windows (Chrome)';
    return 'Windows PC';
  }
  if (/Android/i.test(ua)) return 'Android Device';
  if (/Linux/i.test(ua)) return 'Linux Device';
  return 'Personal Device';
}

export async function POST(req: Request) {
  const rpID = new URL(req.url).hostname;
  const origin = new URL(req.url).origin;
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

      const userAgent = req.headers.get('user-agent');
      const deviceName = getDeviceName(userAgent, body.deviceName);
      const transports = body.response?.transports || ['internal', 'hybrid'];
      
      await sql`
        INSERT INTO passkeys (
          id, user_id, public_key, counter, device_type, backed_up, name, device_id, transports
        ) VALUES (
          ${id}, ${userId}, ${publicKeyHex}, ${counter}, ${credentialDeviceType}, ${credentialBackedUp}, ${deviceName}, ${deviceId}, ${transports}
        )
        ON CONFLICT (id) DO UPDATE SET
          counter = EXCLUDED.counter,
          device_type = EXCLUDED.device_type,
          backed_up = EXCLUDED.backed_up,
          device_id = EXCLUDED.device_id,
          transports = EXCLUDED.transports
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
