// src/app/(dashboard)/admin/_lib/session.ts
import crypto from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "framebooks-admin-token";

export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours strict admin session

function getSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing required authentication secret (ADMIN_AUTH_SECRET or NEXTAUTH_SECRET)");
  }
  return secret;
}

export interface AdminTokenPayload {
  id: number;
  email: string;
  systemRole: string;
  iat: number;
  exp: number;
}

/**
 * Creates a signed JWT-like token using HMAC-SHA256.
 */
export function createAdminToken(user: { id: number; email: string; systemRole: string }): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ADMIN_SESSION_MAX_AGE_SECONDS;

  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email.trim().toLowerCase(),
      systemRole: user.systemRole,
      iat,
      exp,
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

/**
 * Verifies the token signature and expiration.
 */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", getSecret())
      .update(`${header}.${payload}`)
      .digest("base64url");

    // Timing-safe signature check
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const data: AdminTokenPayload = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Sets the dedicated admin session cookie.
 */
export async function setAdminSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Clears the dedicated admin session cookie.
 */
export async function clearAdminSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}
