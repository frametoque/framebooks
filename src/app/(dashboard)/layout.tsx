// src/app/(dashboard)/layout.tsx
import React from "react";
import { headers, cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminUser } from "@/app/(dashboard)/admin/_lib/auth";
import { redirect } from "next/navigation";

import sql from "@/lib/db";
import { generateTenantThemeCss, DEFAULT_ACCENT_HEX } from "@/lib/theme/accent";

export const dynamic = "force-dynamic";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("next-url") || "";

  // The standalone admin login page is exempt from the dashboard layout auth check
  if (pathname.includes("/admin/login")) {
    return <>{children}</>;
  }

  // Base auth check: Admin vs User routes
  let userSession: any = null;
  if (pathname.startsWith("/admin")) {
    const admin = await getAdminUser();
    if (!admin) {
      redirect("/admin/login");
    }
  } else {
    userSession = await getServerSession(authOptions);
    if (!userSession?.user) {
      redirect("/login");
    }
  }

  // Resolve active workspace accent color for user dashboard (zero flash of unstyled theme)
  let accentCss = "";
  if (!pathname.startsWith("/admin") && userSession?.user?.email) {
    try {
      let resolvedColor: string | null = null;

      // 1. Prioritize cookie for fastest, synchronous SSR matching
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get("fb_accent_color")?.value;
      if (rawCookie) {
        const decoded = decodeURIComponent(rawCookie).trim();
        if (/^#[0-9a-fA-F]{6}$/i.test(decoded)) {
          resolvedColor = decoded.toUpperCase();
        }
      }

      // 2. If cookie not set, query database
      if (!resolvedColor) {
        const email = userSession.user.email.toLowerCase();
        const userRows = await sql`
          SELECT t.accent_color
          FROM admin_users u
          JOIN tenants t ON u.tenant_id = t.id
          WHERE LOWER(u.email) = ${email}
          LIMIT 1
        `;
        const dbColor = userRows[0]?.accent_color;
        if (dbColor && /^#[0-9a-fA-F]{6}$/i.test(dbColor.trim())) {
          resolvedColor = dbColor.trim().toUpperCase();
        }
      }

      accentCss = generateTenantThemeCss(resolvedColor || DEFAULT_ACCENT_HEX);
    } catch {
      accentCss = generateTenantThemeCss(DEFAULT_ACCENT_HEX);
    }
  }

  return (
    <>
      {accentCss ? (
        <style
          id="tenant-accent-theme-ssr"
          dangerouslySetInnerHTML={{ __html: accentCss }}
        />
      ) : null}
      {children}
    </>
  );
}
