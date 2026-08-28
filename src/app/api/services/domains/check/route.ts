import { NextRequest, NextResponse } from "next/server";
import dns from "dns";
import net from "net";

async function queryWhois(domain: string, server: string = "whois.iana.org"): Promise<string> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: server, port: 43 }, () => {
      socket.write(domain + "\r\n");
    });
    let data = "";
    socket.on("data", (chunk) => {
      data += chunk.toString();
    });
    socket.on("end", () => {
      resolve(data);
    });
    socket.on("error", () => {
      resolve("");
    });
    // Set 3 second timeout to keep it fast
    socket.setTimeout(3000);
    socket.on("timeout", () => {
      socket.destroy();
      resolve("");
    });
  });
}

async function checkDomainAvailabilityWHOIS(domain: string): Promise<boolean> {
  try {
    // 1. Check WHOIS IANA first to find the specific registry WHOIS server
    const ianaOutput = await queryWhois(domain, "whois.iana.org");
    let registryServer = "whois.verisign-grs.com"; // default fallback for .com/.net
    
    const referMatch = ianaOutput.match(/refer:\s+([^\s]+)/i);
    if (referMatch && referMatch[1]) {
      registryServer = referMatch[1].trim();
    }

    // 2. Query the actual registry WHOIS server
    const rawWhois = await queryWhois(domain, registryServer);
    if (!rawWhois) return false; // Fail-safe to false if socket fails

    const lowerWhois = rawWhois.toLowerCase();
    
    // Standard availability phrases in WHOIS outputs
    const availableIndicators = [
      "no match for",
      "not found",
      "no matching record",
      "is free",
      "available for purchase",
      "no object found"
    ];

    const isAvailable = availableIndicators.some(indicator => lowerWhois.includes(indicator));
    return isAvailable;
  } catch (e) {
    console.error("WHOIS lookup error:", e);
    return false;
  }
}

interface RegistrarPricing {
  registrar: string;
  regCost: number;
  renewCost: number;
}

// Global registrar buyer pricing comparisons across top providers (retail rates for normal buyers)
const REGISTRARS_DB: Record<string, RegistrarPricing[]> = {
  com: [
    { registrar: "Cloudflare", regCost: 10.46, renewCost: 10.46 },
    { registrar: "Namecheap", regCost: 13.98, renewCost: 15.88 },
    { registrar: "Internet.bs", regCost: 13.45, renewCost: 14.25 },
    { registrar: "GoDaddy", regCost: 11.99, renewCost: 21.99 }
  ],
  net: [
    { registrar: "Cloudflare", regCost: 11.86, renewCost: 11.86 },
    { registrar: "Internet.bs", regCost: 15.50, renewCost: 16.50 },
    { registrar: "Namecheap", regCost: 14.98, renewCost: 17.98 }
  ],
  org: [
    { registrar: "Cloudflare", regCost: 8.50, renewCost: 11.20 },
    { registrar: "Internet.bs", regCost: 16.00, renewCost: 17.00 },
    { registrar: "Namecheap", regCost: 15.98, renewCost: 18.98 }
  ],
  engineering: [
    { registrar: "Cloudflare", regCost: 50.20, renewCost: 50.20 }
  ],
  ca: [
    { registrar: "Cloudflare", regCost: 9.19, renewCost: 9.19 }
  ],
  uk: [
    { registrar: "Cloudflare", regCost: 5.30, renewCost: 5.30 }
  ],
  biz: [
    { registrar: "Cloudflare", regCost: 18.20, renewCost: 18.20 }
  ],
  icu: [
    { registrar: "Cloudflare", regCost: 15.20, renewCost: 15.20 }
  ],
  info: [
    { registrar: "Internet.bs", regCost: 4.50, renewCost: 12.50 },
    { registrar: "Namecheap", regCost: 3.98, renewCost: 17.98 }
  ],
  xyz: [
    { registrar: "Cloudflare", regCost: 2.99, renewCost: 12.99 },
    { registrar: "Internet.bs", regCost: 2.99, renewCost: 12.99 },
    { registrar: "Namecheap", regCost: 2.48, renewCost: 14.98 }
  ]
};

function getCheapestPrices(domain: string) {
  const parts = domain.split(".");
  const tld = parts[parts.length - 1].toLowerCase();
  
  const options = REGISTRARS_DB[tld] || [
    { registrar: "Cloudflare", regCost: 10.46, renewCost: 10.46 } // Fallback to Cloudflare standard buyer cost
  ];

  // Find lowest registration cost
  let cheapest = options[0];
  for (const opt of options) {
    if (opt.regCost < cheapest.regCost) {
      cheapest = opt;
    }
  }

  // Add markup (e.g. flat +$5.50 margin for both registration and renewal)
  const regRetail = parseFloat((cheapest.regCost + 5.50).toFixed(2));
  const renewRetail = parseFloat((cheapest.renewCost + 5.50).toFixed(2));

  return {
    registrar: cheapest.registrar,
    regCost: cheapest.regCost,
    renewCost: cheapest.renewCost,
    regRetail,
    renewRetail
  };
}

function getSuggestions(domain: string) {
  const parts = domain.split(".");
  const name = parts[0];
  const currentTld = parts[parts.length - 1].toLowerCase();
  
  const targetTlds = ["com", "net", "org", "ca", "uk", "biz", "icu", "engineering"];
  const suggestions = [];

  for (const tld of targetTlds) {
    if (tld === currentTld) continue;
    const suggestDomain = `${name}.${tld}`;
    const pricing = getCheapestPrices(suggestDomain);
    suggestions.push({
      domain: suggestDomain,
      available: true,
      registrar: pricing.registrar,
      reg_cost_usd: pricing.regCost,
      reg_price_usd: pricing.regRetail,
      renew_cost_usd: pricing.renewCost,
      renew_price_usd: pricing.renewRetail
    });
  }
  return suggestions;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");

  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Valid domain name is required." }, { status: 400 });
  }

  const cleanDomain = domain.trim().toLowerCase();
  const cheapestInfo = getCheapestPrices(cleanDomain);
  const suggestions = getSuggestions(cleanDomain);

  try {
    // Check domain availability using free keyless TCP WHOIS lookups
    const isAvailable = await checkDomainAvailabilityWHOIS(cleanDomain);

    return NextResponse.json({
      domain: cleanDomain,
      available: isAvailable,
      registrar: cheapestInfo.registrar,
      reg_cost_usd: cheapestInfo.regCost,
      reg_price_usd: cheapestInfo.regRetail,
      reg_profit_usd: parseFloat((cheapestInfo.regRetail - cheapestInfo.regCost).toFixed(2)),
      renew_cost_usd: cheapestInfo.renewCost,
      renew_price_usd: cheapestInfo.renewRetail,
      renew_profit_usd: parseFloat((cheapestInfo.renewRetail - cheapestInfo.renewCost).toFixed(2)),
      currency: "USD",
      suggestions,
      message: "Domain check completed successfully using keyless WHOIS"
    });
  } catch (err: any) {
    console.error("WHOIS lookup GET error:", err);
    return NextResponse.json({
      error: "Failed to query domain availability",
      details: err.message
    }, { status: 500 });
  }
}
