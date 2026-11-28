import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

async function verifyAdminJwtSignature(token: string): Promise<any | null> {
  const secret = process.env.ADMIN_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const key = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    let base64 = sigB64.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const isValid = await globalThis.crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    if (!isValid) return null;

    let payloadStr = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    while (payloadStr.length % 4) payloadStr += "=";
    const payload = JSON.parse(atob(payloadStr));
    const now = Math.floor(Date.now() / 1000);
    if (payload.id && payload.exp && payload.exp > now) {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // Freely allow admin login page and logout endpoint
  if (pathname.startsWith("/admin/login") || pathname === "/api/admin/auth/logout") {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Admin routes: protected strictly by framebooks-admin-token with HMAC signature verification
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const adminSession = req.cookies.get("framebooks-admin-token")?.value;
    let isValid = false;

    if (adminSession) {
      const payload = await verifyAdminJwtSignature(adminSession);
      if (payload) {
        isValid = true;
      }
    }

    if (!isValid) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized. Staff session required." }, { status: 401 });
      }
      const loginUrl = new URL("/admin/login", req.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("callbackUrl", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  // User dashboard, clean routes, and POS routes: protected by user session (next-auth)
  const isUserRoute =
    pathname.startsWith("/user") ||
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/pos" ||
    pathname.startsWith("/pos/") ||
    pathname === "/stock" ||
    pathname.startsWith("/stock/") ||
    pathname === "/invoices" ||
    pathname.startsWith("/invoices/") ||
    pathname === "/invoice" ||
    pathname.startsWith("/invoice/") ||
    pathname === "/income" ||
    pathname.startsWith("/income/") ||
    pathname === "/expenses" ||
    pathname.startsWith("/expenses/") ||
    pathname === "/accounts" ||
    pathname.startsWith("/accounts/") ||
    pathname === "/quotations" ||
    pathname.startsWith("/quotations/") ||
    pathname === "/clients" ||
    pathname.startsWith("/clients/") ||
    pathname === "/assets" ||
    pathname.startsWith("/assets/") ||
    pathname === "/assests" ||
    pathname.startsWith("/assests/") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/logs" ||
    pathname.startsWith("/logs/");

  if (isUserRoute) {
    const userSession =
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value;

    if (!userSession) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/user/:path*",
    "/admin/:path*",
    "/api/admin/:path*",
    "/pos",
    "/pos/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/stock",
    "/stock/:path*",
    "/invoices",
    "/invoices/:path*",
    "/invoice/:path*",
    "/income",
    "/income/:path*",
    "/expenses",
    "/expenses/:path*",
    "/accounts",
    "/accounts/:path*",
    "/quotations",
    "/quotations/:path*",
    "/clients",
    "/clients/:path*",
    "/assets",
    "/assets/:path*",
    "/assests",
    "/assests/:path*",
    "/reports",
    "/reports/:path*",
    "/settings",
    "/settings/:path*",
    "/logs",
    "/logs/:path*",
  ],
};
