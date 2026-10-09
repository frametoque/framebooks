// src/lib/admin/passwords.ts
import crypto from "crypto";

/**
 * Hashes a plaintext password using crypto.scrypt with a random 16-byte salt.
 * Returns formatted string: "<salt>:<hex-hash>"
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored hash or legacy plaintext string.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !password) return false;

  // If the stored hash does not contain a salt delimiter ':', handle as legacy/plain text match
  if (!storedHash.includes(":")) {
    try {
      const a = Buffer.from(password);
      const b = Buffer.from(storedHash);
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return password === storedHash;
    }
  }

  try {
    const [salt, key] = storedHash.split(":");
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    console.error("Password verification error:", err);
    return false;
  }
}
