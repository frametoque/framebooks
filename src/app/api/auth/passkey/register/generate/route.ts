import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import {  auth, currentUser  } from '@/lib/auth';
import sql from '@/lib/db';

const rpName = 'Framebooks';

export async function GET(req: Request) {
  const rpID = new URL(req.url).hostname;
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's existing passkeys
  const existingPasskeys = await sql`SELECT public_key FROM passkeys WHERE user_id = ${userId}`;
  
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(userId),
    userName: user.primaryEmailAddress?.emailAddress || userId,
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((pk: any) => ({
      id: pk.public_key,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const response = NextResponse.json(options);
  response.cookies.set('currentChallenge', options.challenge, { httpOnly: true, secure: false, maxAge: 60 * 5 });
  
  return response;
}
