// src/app/(dashboard)/layout.tsx
import React from "react";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

  // Base auth check (Check 1 of 2): verify a session is present for the dashboard group
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (pathname.startsWith("/admin")) {
      redirect("/admin/login");
    } else {
      redirect("/login");
    }
  }

  // Resolve active workspace accent color for user dashboard (zero flash of unstyled theme)
  let accentCss = "";
  if (!pathname.startsWith("/admin") && session?.user?.email) {
    try {
      const email = session.user.email.toLowerCase();
      const userRows = await sql`
        SELECT t.accent_color
        FROM admin_users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${email}
        LIMIT 1
      `;
      accentCss = generateTenantThemeCss(userRows[0]?.accent_color || DEFAULT_ACCENT_HEX);
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
