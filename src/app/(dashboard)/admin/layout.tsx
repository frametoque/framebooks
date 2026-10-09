// src/app/(dashboard)/admin/layout.tsx
import React from "react";
import { Metadata } from "next";
import { headers } from "next/headers";
import { requireAdmin } from "./_lib/auth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const metadata: Metadata = {
  title: "Framebooks Admin Portal",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("next-url") || "";

  // The standalone admin login page renders independently without the staff dashboard shell
  if (pathname.includes("/admin/login")) {
    return <>{children}</>;
  }

  // Enforce server-side staff role verification (Check 2 of 2) on every admin request
  const admin = await requireAdmin();

  return <DashboardShell variant="admin" admin={admin}>{children}</DashboardShell>;
}
