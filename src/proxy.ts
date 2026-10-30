import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // Freely allow admin login page
  if (pathname.startsWith("/admin/login")) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Admin routes: protected strictly by framebooks-admin-token
  if (pathname.startsWith("/admin")) {
    const adminSession = req.cookies.get("framebooks-admin-token")?.value;

    if (!adminSession) {
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
  ],
};
