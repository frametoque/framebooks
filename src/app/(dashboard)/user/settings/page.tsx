import { Loader } from "@/components/ui/Loader";
import React, { Suspense } from 'react';
import MainPage from './MainPage';
import { getActivePlans } from "@/lib/plans-db";
import { redirect } from "next/navigation";
import { getUserContext } from "../actions/rbac";
import { isSettingsSectionAllowed } from "./settings-permissions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings | Framebooks",
  description: "Manage your account settings, profile details, and payment methods all in one place.",
  openGraph: {
    title: "Settings | Framebooks",
    description: "Manage your account settings, profile details, and payment methods all in one place.",
    url: "https://framebooks.com/dashboard/settings", 
    siteName: "Framebooks",
    images: [
      {
        url: "https://framebooks.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "Framebooks",
      },
    ],
    type: "website",
  },
};

export default async function SettingsServerPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const resolvedSearchParams = await searchParams;
  const tabParam = resolvedSearchParams?.tab;
  if (tabParam) {
    const { role } = await getUserContext();
    if (!role || !isSettingsSectionAllowed(tabParam, role)) {
      redirect("/user/settings");
    }
  }

  const dbPlans = await getActivePlans().catch(() => []);
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <MainPage initialPlans={dbPlans} />
    </Suspense>
  );
}