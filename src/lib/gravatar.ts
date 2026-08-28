import crypto from "crypto";

/**
 * Generates a Gravatar URL for a given email address.
 * Uses d=404 so that if no Gravatar profile image exists for the email,
 * it returns a 404 HTTP response instead of a default image fallback.
 */
export function getGravatarUrl(email: string | null | undefined, size = 200): string | null {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const hash = crypto.createHash("md5").update(cleanEmail).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}
