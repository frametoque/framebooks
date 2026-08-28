import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {  clerkClient, auth  } from '@/lib/auth';
import sql from '@/lib/db';

const rpID = 'localhost';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  
  let userId;
  
  if (email) {
    const client = await clerkClient();
    const users = await client.users.getUserList({ emailAddress: [email] });
    if (users.data.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    userId = users.data[0].id;
  } else {
    const session = await auth();
    userId = session.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const passkeys = await sql`SELECT public_key, id FROM passkeys WHERE user_id = ${userId}`;
    
    if (passkeys.length === 0) {
      return NextResponse.json({ error: "No passkeys configured" }, { status: 400 });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(pk => ({
        id: pk.id,
        type: 'public-key',
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    });

    const response = NextResponse.json(options);
    response.cookies.set('currentChallenge', options.challenge, { httpOnly: true, secure: false, maxAge: 60 * 5 });
    response.cookies.set('current2FAUser', userId, { httpOnly: true, secure: false, maxAge: 60 * 5 });
    
    return response;
  } catch (error) {
    console.error("Failed to generate 2FA auth options:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
