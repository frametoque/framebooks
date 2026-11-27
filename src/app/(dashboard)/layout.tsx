// src/app/(dashboard)/layout.tsx
import React, { cache } from "react";
import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminUser } from "@/app/(dashboard)/admin/_lib/auth";
import { redirect } from "next/navigation";

import sql from "@/lib/db";
import { generateTenantThemeCss, DEFAULT_ACCENT_HEX, resolvePaletteId } from "@/lib/theme/accent";
import { isCashierOnlyUser } from "@/app/(dashboard)/user/actions/rbac";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("next-url") || "";
  if (pathname.startsWith("/admin")) {
    return {};
  }

  const session = await getServerSession(authOptions);
  let bizName = "";
  if (session?.user?.email) {
    try {
      const userRows = await sql`
        SELECT t.name as tenant_name
        FROM admin_users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${session.user.email.toLowerCase()}
        LIMIT 1
      `;
      bizName = userRows[0]?.tenant_name?.trim();
    } catch {}
  }

  return {
    title: {
      template: bizName ? `%s - ${bizName} | Framebooks` : "%s | Framebooks",
      default: bizName ? `Dashboard - ${bizName} | Framebooks` : "Dashboard | Framebooks",
    },
  };
}

// Request-level memoized accent query to avoid duplicate database hits across layout evaluations
const getCachedUserAccent = cache(async (email: string) => {
  try {
    const userRows = await sql`
      SELECT t.accent_color
      FROM admin_users u
      JOIN tenants t ON u.tenant_id = t.id
      WHERE LOWER(u.email) = ${email.toLowerCase()}
      LIMIT 1
    `;
    return userRows[0]?.accent_color || null;
  } catch {
    return null;
  }
});

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

    // Enforce that user has a valid, linked business setup
    const email = userSession.user.email?.toLowerCase();
    const userRows = await sql`
      SELECT u.tenant_id, u.role, t.id as active_tenant_id, t.payment_status
      FROM admin_users u
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE LOWER(u.email) = ${email}
      LIMIT 1
    `;

    if (userRows.length === 0 || !userRows[0].tenant_id || !userRows[0].active_tenant_id) {
      redirect("/onboarding");
    }

    if (userRows[0].payment_status === "pending_payment") {
      redirect("/onboarding");
    }

    // Cashiers are strictly restricted to /pos; block access to dashboard and ERP pages
    const userRole = userRows[0].role as string | null;
    const activeTenantId = Number(userRows[0].active_tenant_id);
    const isCashierOnly = await isCashierOnlyUser(userRole, activeTenantId);
    if (isCashierOnly) {
      redirect("/pos");
    }
  }

  // Resolve active workspace accent color for user dashboard (zero flash of unstyled theme)
  let accentCss = "";
  if (!pathname.startsWith("/admin") && userSession?.user?.email) {
    try {
      // 1. Query database for the active tenant's true accent color
      const dbColor = await getCachedUserAccent(userSession.user.email);
      const resolvedColor = resolvePaletteId(dbColor) || DEFAULT_ACCENT_HEX;

      // 2. Synchronize cookie to match the active tenant's color
      try {
        const cookieStore = await cookies();
        cookieStore.set("fb_accent_color", resolvedColor, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      } catch {}

      accentCss = generateTenantThemeCss(resolvedColor);
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
