import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@/lib/auth';
import sql from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rate-limit';

const rpName = 'Framebooks';

export async function GET(req: Request) {
  const rpID = new URL(req.url).hostname;
  const { userId } = await auth();
  const user = await currentUser();
  
  if (!userId || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user's existing passkeys using credential ID
  const existingPasskeys = await sql`SELECT id FROM passkeys WHERE user_id = ${userId}`;
  
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: Buffer.from(userId),
    userName: user.primaryEmailAddress?.emailAddress || userId,
    attestationType: 'none',
    excludeCredentials: existingPasskeys.map((pk: any) => ({
      id: pk.id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  const rateLimitResult = checkRateLimit(req, { limit: 10, windowMs: 60 * 1000, prefix: 'passkey-reg' });
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many passkey requests. Please wait before trying again." },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfterSeconds) } }
    );
  }

  const response = NextResponse.json(options);
  response.cookies.set('currentChallenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 5,
  });
  
  return response;
}
