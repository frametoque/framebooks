/**
 * In-memory sliding window rate limiter for security-sensitive operations.
 * Requires no external dependencies or external infrastructure.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const stores = new Map<string, Map<string, RateLimitRecord>>();

let lastCleanup = Date.now();
function cleanupStaleStores(now: number) {
  // Throttle in-memory store cleanup to at most once every 60 seconds on active requests
  // Avoids background setInterval timers that keep serverless execution alive
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [, store] of stores.entries()) {
    for (const [key, record] of store.entries()) {
      record.timestamps = record.timestamps.filter(t => now - t < 15 * 60 * 1000);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }
}

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  limit?: number; // alias for max
  prefix?: string;
}

export interface RateLimitResult {
  success: boolean;
  allowed: boolean; // alias for success
  remaining: number;
  resetTime: number;
  retryAfterSeconds: number;
}

export function extractClientIp(req?: Request): string {
  if (!req) return "unknown";
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    if (cfConnectingIp) return cfConnectingIp.trim();
  } catch {
    // fallback
  }
  return "unknown";
}

export function checkRateLimit(
  arg1: Request | string,
  arg2?: string | RateLimitOptions,
  arg3?: RateLimitOptions
): RateLimitResult {
  let namespace = "default";
  let identifier = "unknown";
  let options: RateLimitOptions = { windowMs: 15 * 60 * 1000, max: 10 };

  if (typeof arg1 === "string" && typeof arg2 === "string") {
    // checkRateLimit(namespace, identifier, options)
    namespace = arg1;
    identifier = arg2;
    if (arg3) options = { ...options, ...arg3 };
  } else if (typeof arg1 === "string") {
    // checkRateLimit(identifier, options)
    identifier = arg1;
    if (typeof arg2 === "object") options = { ...options, ...arg2 };
    if (options.prefix) namespace = options.prefix;
  } else if (arg1 && typeof arg1 === "object") {
    // checkRateLimit(req, options)
    identifier = extractClientIp(arg1);
    if (typeof arg2 === "object") options = { ...options, ...arg2 };
    if (options.prefix) namespace = options.prefix;
  }

  const max = options.limit !== undefined ? options.limit : (options.max !== undefined ? options.max : 10);
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const now = Date.now();
  cleanupStaleStores(now);

  if (!stores.has(namespace)) {
    stores.set(namespace, new Map<string, RateLimitRecord>());
  }

  const store = stores.get(namespace)!;
  const cutoff = now - windowMs;

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    store.set(identifier, record);
  }

  // Filter timestamps within the active sliding window
  record.timestamps = record.timestamps.filter(t => t > cutoff);

  if (record.timestamps.length >= max) {
    const oldest = record.timestamps[0];
    const resetTime = oldest + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));
    return { success: false, allowed: false, remaining: 0, resetTime, retryAfterSeconds };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, max - record.timestamps.length);
  const resetTime = now + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000));

  return { success: true, allowed: true, remaining, resetTime, retryAfterSeconds };
}
