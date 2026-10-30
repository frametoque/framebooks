import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { unpackChallenge, packChallenge, verifyOtp } from "@/lib/security/otp";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const challengeCookie = cookieStore.get("fb_applock_otp_challenge")?.value;

  if (!challengeCookie) {
    return NextResponse.json(
      { error: "No active verification request found. Please request a new code." },
      { status: 400 }
    );
  }

  const challenge = unpackChallenge(challengeCookie);
  if (!challenge) {
    return NextResponse.json(
      { error: "Invalid or tampered verification challenge. Please request a new code." },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json(
      { error: "Please enter the 6-digit verification code." },
      { status: 400 }
    );
  }

  const result = verifyOtp(String(userId), code, challenge);

  if (!result.valid) {
    // Increment failed attempt count
    challenge.attempts += 1;
    const updatedCookie = packChallenge(challenge);

    const response = NextResponse.json(
      {
        error: result.reason || "Invalid verification code.",
        attemptsRemaining: Math.max(0, 5 - challenge.attempts),
      },
      { status: 400 }
    );

    if (challenge.attempts >= 5) {
      // Clear cookie if max attempts exceeded
      response.cookies.delete("fb_applock_otp_challenge");
    } else {
      response.cookies.set("fb_applock_otp_challenge", updatedCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(0, Math.floor((challenge.expiresAt - Date.now()) / 1000)),
      });
    }

    return response;
  }

  // Code is verified and valid! Disable passkeys for this account
  try {
    await sql`DELETE FROM passkeys WHERE user_id = ${userId}`;

    const response = NextResponse.json({
      success: true,
      message: "Identity verified successfully. App Lock has been disabled.",
    });

    // Clear verification challenge cookie
    response.cookies.delete("fb_applock_otp_challenge");

    return response;
  } catch (error: any) {
    console.error("Failed to disable App Lock after OTP verification:", error);
    return NextResponse.json(
      { error: "Internal server error disabling App Lock. Please try again." },
      { status: 500 }
    );
  }
}
