/**
 * Email formatting and sanitization utilities.
 */

/**
 * Escapes HTML characters to prevent XSS/injection in email bodies.
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Validates that an outbound link is a safe, absolute HTTPS URL.
 */
export function sanitizeUrl(url: string, fallback = "https://framebooks.lk"): string {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://localhost")) {
    return trimmed;
  }
  return fallback;
}

/**
 * Formats a currency amount into LKR with thousands separators.
 * Example: 2500 -> "LKR 2,500", 180000 -> "LKR 180,000"
 */
export function formatLkr(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "LKR 0";
  return `LKR ${Math.round(num).toLocaleString("en-US")}`;
}

/**
 * Strips all HTML tags and converts markup to clean plain text.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
