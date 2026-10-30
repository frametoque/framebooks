import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { sendAppLockOtpEmail } from "@/lib/email";
import { generateOtp, createOtpChallenge, maskEmail } from "@/lib/security/otp";
import { checkRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { userId, user } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: max 3 OTP send requests per 10 minutes per user
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateCheck = checkRateLimit("applock-otp-send", `${userId}:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many verification requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  try {
    // Determine user's registered email
    let userEmail = user?.email;
    if (!userEmail) {
      const rows = await sql`SELECT email FROM admin_users WHERE id = ${userId} LIMIT 1`;
      if (rows && rows.length > 0) {
        userEmail = rows[0].email;
      }
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: "No registered email address found for your account." },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const challengeCookieValue = createOtpChallenge(String(userId), otp, userEmail);

    // Send the email with the OTP code
    await sendAppLockOtpEmail(userEmail, otp);

    const response = NextResponse.json({
      success: true,
      maskedEmail: maskEmail(userEmail),
      message: `A 6-digit verification code was sent to ${maskEmail(userEmail)}.`,
    });

    // Set signed HTTP-only cookie with 10-minute expiry
    response.cookies.set("fb_applock_otp_challenge", challengeCookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (error: any) {
    console.error("Failed to generate and send recovery OTP:", error);
    return NextResponse.json(
      { error: "Failed to send verification code. Please try again." },
      { status: 500 }
    );
  }
}
