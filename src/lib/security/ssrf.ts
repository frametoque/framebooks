import dns from "dns/promises";
import net from "net";

/**
 * Checks whether an IP address belongs to private, loopback, link-local, or cloud metadata ranges.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (!net.isIP(ip)) return true;

  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return true;

    // 0.0.0.0/8 (Current network)
    if (parts[0] === 0) return true;
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private: 172.16.0.0 - 172.31.255.255)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link-local & AWS/Cloud metadata 169.254.169.254)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
    if (parts[0] >= 224) return true;

    return false;
  }

  // IPv6
  const normalized = ip.toLowerCase();
  // Loopback ::1
  if (normalized === "::1" || normalized === "0000:0000:0000:0000:0000:0000:0000:0001") return true;
  // Unspecified ::
  if (normalized === "::" || normalized === "0000:0000:0000:0000:0000:0000:0000:0000") return true;
  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (normalized.startsWith("::ffff:")) {
    const ipv4Part = normalized.slice(7);
    return isPrivateOrReservedIP(ipv4Part);
  }
  // Unique local addresses (fc00::/7)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-local addresses (fe80::/10)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;

  return false;
}

/**
 * Validates a target URL against SSRF attacks:
 * 1. Must be http: or https:
 * 2. Hostname must not resolve to private, loopback, or cloud metadata IP
 */
export async function validateSafeUrl(urlStr: string): Promise<{ safe: boolean; error?: string; url?: URL }> {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, error: "Only HTTP and HTTPS protocols are permitted." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Disallow obvious local hostnames
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return { safe: false, error: "Access to local or internal hostnames is prohibited." };
    }

    // Direct IP check
    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIP(hostname)) {
        return { safe: false, error: "Access to private or reserved IP addresses is prohibited." };
      }
      return { safe: true, url: parsed };
    }

    // Resolve DNS and check resulting IP
    try {
      const lookupResult = await dns.lookup(hostname, { all: true });
      for (const entry of lookupResult) {
        if (isPrivateOrReservedIP(entry.address)) {
          return { safe: false, error: "Destination resolves to a prohibited private or internal IP address." };
        }
      }
    } catch {
      return { safe: false, error: "Could not resolve hostname." };
    }

    return { safe: true, url: parsed };
  } catch {
    return { safe: false, error: "Invalid URL format." };
  }
}
