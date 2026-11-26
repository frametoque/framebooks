import { validateSafeUrl } from "../security/ssrf.ts";

export interface WooConnectionTestResult {
  success: boolean;
  storeName?: string;
  wooVersion?: string;
  currency?: string;
  isHttps: boolean;
  manageStockEnabled?: boolean;
  error?: string;
  errorCode?: "AUTH_FAILED" | "NOT_FOUND" | "SSL_ERROR" | "TIMEOUT_OR_BLOCKED" | "INVALID_URL" | "UNKNOWN";
}

export interface WooRequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  params?: Record<string, string | number | boolean>;
  timeoutMs?: number;
}

/**
 * Normalizes and validates the WooCommerce store URL.
 */
export function normalizeStoreUrl(url: string): { valid: boolean; normalized: string; error?: string } {
  if (!url || typeof url !== "string") {
    return { valid: false, normalized: "", error: "Store URL is required." };
  }

  let clean = url.trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    clean = `https://${clean}`;
  }

  try {
    const parsed = new URL(clean);

    // Enforce HTTPS in production
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      return { valid: false, normalized: "", error: "WooCommerce store URL must use secure HTTPS." };
    }

    // Disallow local or private addresses in production
    const hostname = parsed.hostname.toLowerCase();
    if (
      process.env.NODE_ENV === "production" &&
      (hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname.startsWith("127.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname === "169.254.169.254")
    ) {
      return { valid: false, normalized: "", error: "Store URL points to a restricted internal network address." };
    }

    // Remove trailing slashes and hash/query
    const normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
    return { valid: true, normalized };
  } catch {
    return { valid: false, normalized: "", error: "Please enter a valid store URL (e.g. https://yourstore.com)." };
  }
}

/**
 * Executes an authenticated request to WooCommerce REST API v3.
 */
export async function executeWooRequest<T = any>(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  endpoint: string,
  options: WooRequestOptions = {}
): Promise<{ success: boolean; data?: T; status: number; total?: number; totalPages?: number; error?: string; errorCode?: string }> {
  const norm = normalizeStoreUrl(storeUrl);
  if (!norm.valid) {
    return { success: false, status: 400, error: norm.error, errorCode: "INVALID_URL" };
  }

  // Deep DNS/IP SSRF validation in production
  if (process.env.NODE_ENV === "production") {
    const ssrfCheck = await validateSafeUrl(norm.normalized);
    if (!ssrfCheck.safe) {
      return { success: false, status: 400, error: ssrfCheck.error || "Prohibited target address.", errorCode: "INVALID_URL" };
    }
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  let fullUrl = `${norm.normalized}/wp-json/wc/v3${cleanEndpoint}`;

  if (options.params) {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null) query.append(k, String(v));
    }
    const qStr = query.toString();
    if (qStr) fullUrl += `?${qStr}`;
  }

  const authHeader = `Basic ${Buffer.from(`${consumerKey.trim()}:${consumerSecret.trim()}`).toString("base64")}`;
  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(fullUrl, {
      method: options.method || "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Framebooks-POS-Sync/2.0 (+https://framebooks.com)",
        "X-WC-Currency": "LKR",
        "X-Currency": "LKR",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (res.status === 401) {
      return {
        success: false,
        status: 401,
        error: "Authentication failed. The Consumer Key or Consumer Secret is invalid or lacks Read/Write permissions.",
        errorCode: "AUTH_FAILED",
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        status: 404,
        error: "REST API route not found (404). Please ensure WooCommerce is active and WordPress Permalinks are set to 'Post name' in WP Settings > Permalinks.",
        errorCode: "NOT_FOUND",
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        status: 403,
        error: "Access forbidden (403). A security plugin (Wordfence, iThemes, Cloudflare) or host firewall may be blocking requests to /wp-json/wc/v3/.",
        errorCode: "TIMEOUT_OR_BLOCKED",
      };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let parsedMsg = `HTTP Error ${res.status}`;
      try {
        const json = JSON.parse(errText);
        if (json.message) parsedMsg = json.message;
      } catch {}
      return {
        success: false,
        status: res.status,
        error: parsedMsg,
        errorCode: "UNKNOWN",
      };
    }

    const data = (await res.json()) as T;
    const totalHeader = res.headers.get("x-wp-total");
    const totalPagesHeader = res.headers.get("x-wp-totalpages");
    const total = totalHeader ? parseInt(totalHeader, 10) : undefined;
    const totalPages = totalPagesHeader ? parseInt(totalPagesHeader, 10) : undefined;

    return { success: true, status: res.status, data, total, totalPages };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      return {
        success: false,
        status: 408,
        error: "Connection timed out. The WooCommerce server took too long to respond. Check if your hosting or firewall is slowing down API requests.",
        errorCode: "TIMEOUT_OR_BLOCKED",
      };
    }

    const msg = err.message || "";
    if (msg.includes("CERT_") || msg.includes("self-signed") || msg.includes("SSL") || msg.includes("unable to verify")) {
      return {
        success: false,
        status: 495,
        error: "SSL certificate validation failed. The WooCommerce store HTTPS certificate is invalid, untrusted, or expired.",
        errorCode: "SSL_ERROR",
      };
    }

    return {
      success: false,
      status: 500,
      error: `Network error connecting to WooCommerce: ${msg || "Host unreachable"}`,
      errorCode: "UNKNOWN",
    };
  }
}

/**
 * Tests the connection to WooCommerce, verifying credentials and stock readiness.
 */
export async function testWooConnection(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<WooConnectionTestResult> {
  const norm = normalizeStoreUrl(storeUrl);
  if (!norm.valid) {
    return {
      success: false,
      isHttps: false,
      error: norm.error,
      errorCode: "INVALID_URL",
    };
  }

  // First probe: fetch system_status or 1 product
  const probe = await executeWooRequest<any>(
    norm.normalized,
    consumerKey,
    consumerSecret,
    "/system_status",
    { timeoutMs: 12000 }
  );

  if (probe.success && probe.data) {
    const sys = probe.data;
    const environment = sys.environment || {};
    const settings = sys.settings || {};

    return {
      success: true,
      storeName: environment.site_title || new URL(norm.normalized).hostname,
      wooVersion: environment.version || "Active",
      currency: settings.currency || "USD",
      isHttps: norm.normalized.startsWith("https://"),
      manageStockEnabled: settings.manage_stock === true || settings.manage_stock === "yes",
    };
  }

  // If system_status was restricted by user role, try fetching /products?per_page=1
  const productProbe = await executeWooRequest<any[]>(
    norm.normalized,
    consumerKey,
    consumerSecret,
    "/products",
    { params: { per_page: 1 }, timeoutMs: 12000 }
  );

  if (productProbe.success) {
    return {
      success: true,
      storeName: new URL(norm.normalized).hostname,
      isHttps: norm.normalized.startsWith("https://"),
      manageStockEnabled: true,
    };
  }

  // Return mapped friendly error
  return {
    success: false,
    isHttps: norm.normalized.startsWith("https://"),
    error: productProbe.error || probe.error || "Unable to establish connection with WooCommerce store.",
    errorCode: (productProbe.errorCode || probe.errorCode || "UNKNOWN") as any,
  };
}
