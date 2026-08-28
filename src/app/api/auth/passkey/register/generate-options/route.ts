import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import {  auth, currentUser  } from '@/lib/auth';
import sql from '@/lib/db';

const rpName = 'Framebooks';

export async function GET(req: Request) {
  const rpID = new URL(req.url).hostname;
  const origin = new URL(req.url).origin;
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
    excludeCredentials: existingPasskeys.map(pk => ({
      id: pk.public_key, // Note: storing credID alongside public_key is better, simplified for now
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Need to save the challenge temporarily, simplified for demo using a cookie
  const response = NextResponse.json(options);
  response.cookies.set('currentChallenge', options.challenge, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 5 });
  
  return response;
}
