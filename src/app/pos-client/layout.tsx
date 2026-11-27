import React from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import { generateTenantThemeCss, DEFAULT_ACCENT_HEX, resolvePaletteId } from "@/lib/theme/accent";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getServerSession(authOptions);
  let bizName = "Framebooks POS";
  if (session?.user?.email) {
    try {
      const userRows = await sql`
        SELECT t.name as tenant_name
        FROM admin_users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${session.user.email.toLowerCase()}
        LIMIT 1
      `;
      if (userRows[0]?.tenant_name) {
        bizName = userRows[0].tenant_name.trim();
      }
    } catch {}
  }

  return {
    title: `Customer Display - ${bizName}`,
    description: "Customer-facing live checkout screen and client self-check-in terminal.",
  };
}

export const dynamic = "force-dynamic";

export default async function PosClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  let accentCss = "";

  if (session?.user?.email) {
    try {
      const rows = await sql`
        SELECT t.accent_color
        FROM admin_users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${session.user.email.toLowerCase()}
        LIMIT 1
      `;
      const accent = resolvePaletteId(rows[0]?.accent_color) || DEFAULT_ACCENT_HEX;
      accentCss = generateTenantThemeCss(accent);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#0B0F17] text-white antialiased select-none overflow-x-hidden">
      {accentCss && <style dangerouslySetInnerHTML={{ __html: accentCss }} />}
      {children}
    </div>
  );
}
