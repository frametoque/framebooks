/**
 * Safe server environment variable validation for production readiness.
 * Validates presence of critical environment variables without throwing
 * during static page generation / build phases.
 */

const REQUIRED_SERVER_VARS = [
  "DATABASE_URL",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
] as const;

const OPTIONAL_SERVER_VARS = [
  "APP_MASTER_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

export function validateServerEnv(): { valid: boolean; missing: string[] } {
  if (typeof window !== "undefined") {
    // Client context - do not validate server environment
    return { valid: true, missing: [] };
  }

  const missing: string[] = [];

  for (const varName of REQUIRED_SERVER_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (!process.env.APP_MASTER_KEY && !process.env.APP_SECRET_KEY) {
    missing.push("APP_MASTER_KEY");
  }

  if (missing.length > 0 && process.env.NODE_ENV === "production") {
    // Check if we are running in a build phase vs actual runtime
    const isBuildPhase =
      process.env.NEXT_PHASE === "phase-production-build" ||
      process.env.npm_lifecycle_event === "build";

    if (!isBuildPhase) {
      console.warn(
        `[Environment Warning] Missing critical server environment variables: ${missing.join(", ")}`
      );
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
