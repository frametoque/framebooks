// src/app/(dashboard)/layout.tsx
import React from "react";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

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

  return <>{children}</>;
}
