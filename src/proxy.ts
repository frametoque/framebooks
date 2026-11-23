import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
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

  // Admin routes: protected strictly by framebooks-admin-token
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const adminSession = req.cookies.get("framebooks-admin-token")?.value;
    let isValid = false;

    if (adminSession) {
      try {
        const parts = adminSession.split(".");
        if (parts.length === 3) {
          // Decode payload and verify expiration
          const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
          const payload = JSON.parse(payloadJson);
          const now = Math.floor(Date.now() / 1000);
          if (payload.id && payload.exp && payload.exp > now) {
            isValid = true;
          }
        }
      } catch {
        isValid = false;
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

  // User dashboard routes: protected by user session (next-auth)
  if (pathname.startsWith("/user")) {
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
  ],
};
