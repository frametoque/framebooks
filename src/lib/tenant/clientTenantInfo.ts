"use client";

let cachedTenantInfo: any = null;
let cachedTimestamp = 0;
let inFlightPromise: Promise<any> | null = null;
const CACHE_TTL_MS = 60_000; // 60 seconds client-side deduplication window

/**
 * Client-side deduplicated and cached wrapper around getTenantInfo().
 * Prevents multiple components mounting on the same page from firing
 * duplicate HTTP server action requests, saving Vercel Active CPU.
 */
export async function getClientTenantInfo(force = false): Promise<any> {
  const now = Date.now();
  if (!force && cachedTenantInfo && now - cachedTimestamp < CACHE_TTL_MS) {
    return cachedTenantInfo;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const { getTenantInfo } = await import("@/app/(dashboard)/user/actions/tenants");
      const res = await getTenantInfo();
      cachedTenantInfo = res;
      cachedTimestamp = Date.now();
      return res;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Explicitly clears the client-side cached tenant info (e.g. after updating workspace settings).
 */
export function invalidateClientTenantInfo(): void {
  cachedTenantInfo = null;
  cachedTimestamp = 0;
}
