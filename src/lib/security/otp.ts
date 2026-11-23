import crypto from "crypto";

function getOtpSecret(): string {
  const secret = process.env.APP_SECRET_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required authentication secret (NEXTAUTH_SECRET or APP_SECRET_KEY)");
    }
    return "framebooks_otp_secure_dev_secret_32_bytes";
  }
  return secret;
}
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export interface OtpChallengePayload {
  userId: string;
  expiresAt: number;
  signature: string;
  maskedEmail: string;
  attempts: number;
}

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 */
export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Mask email for privacy (e.g. j***e@example.com).
 */
export function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const name = parts[0];
  const domain = parts[1];
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * Compute HMAC-SHA256 signature for OTP verification.
 */
function computeSignature(userId: string, otp: string, expiresAt: number): string {
  return crypto
    .createHmac("sha256", getOtpSecret())
    .update(`${userId}:${otp}:${expiresAt}`)
    .digest("hex");
}

/**
 * Create a signed challenge object to store in an HTTP-only cookie.
 */
export function createOtpChallenge(userId: string, otp: string, email: string): string {
  const expiresAt = Date.now() + OTP_EXPIRY_MS;
  const signature = computeSignature(userId, otp, expiresAt);
  const payload: OtpChallengePayload = {
    userId,
    expiresAt,
    signature,
    maskedEmail: maskEmail(email),
    attempts: 0,
  };

  // Sign the entire payload so client cookies cannot tamper with attempts or expiry
  const rawJson = JSON.stringify(payload);
  const payloadSig = crypto.createHmac("sha256", getOtpSecret()).update(rawJson).digest("hex");
  return Buffer.from(JSON.stringify({ rawJson, payloadSig })).toString("base64");
}

/**
 * Validate and unpack the challenge cookie.
 */
export function unpackChallenge(cookieValue: string): OtpChallengePayload | null {
  try {
    const decoded = Buffer.from(cookieValue, "base64").toString("utf8");
    const { rawJson, payloadSig } = JSON.parse(decoded);
    const expectedSig = crypto.createHmac("sha256", getOtpSecret()).update(rawJson).digest("hex");

    if (
      !crypto.timingSafeEqual(
        Buffer.from(payloadSig, "utf8"),
        Buffer.from(expectedSig, "utf8")
      )
    ) {
      return null;
    }

    return JSON.parse(rawJson) as OtpChallengePayload;
  } catch {
    return null;
  }
}

/**
 * Pack updated challenge payload (e.g. after incrementing attempts).
 */
export function packChallenge(payload: OtpChallengePayload): string {
  const rawJson = JSON.stringify(payload);
  const payloadSig = crypto.createHmac("sha256", getOtpSecret()).update(rawJson).digest("hex");
  return Buffer.from(JSON.stringify({ rawJson, payloadSig })).toString("base64");
}

/**
 * Verify submitted OTP against the challenge.
 */
export function verifyOtp(userId: string, submittedOtp: string, challenge: OtpChallengePayload): { valid: boolean; reason?: string } {
  if (challenge.userId !== userId) {
    return { valid: false, reason: "Unauthorized user challenge." };
  }

  if (Date.now() > challenge.expiresAt) {
    return { valid: false, reason: "Verification code has expired. Please request a new one." };
  }

  if (challenge.attempts >= 5) {
    return { valid: false, reason: "Too many failed attempts. Please request a new code." };
  }

  const cleanOtp = submittedOtp.trim().replace(/\D/g, "");
  if (cleanOtp.length !== 6) {
    return { valid: false, reason: "Invalid code format. Enter the 6-digit code." };
  }

  const expectedSignature = computeSignature(userId, cleanOtp, challenge.expiresAt);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(challenge.signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );

  if (!isMatch) {
    return { valid: false, reason: "Incorrect verification code." };
  }

  return { valid: true };
}
