import { Loader } from "@/components/ui/Loader";
import React, { Suspense } from 'react';
import MainPage, { SETTINGS_SLUG_TO_TAB } from '../MainPage';
import { getActivePlans } from "@/lib/plans-db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const SECTION_METADATA: Record<string, { title: string; description: string }> = {
  "profile": { title: "Account & Security - Settings", description: "Manage your profile, connected accounts, and app lock." },
  "business": { title: "Business Profile - Settings", description: "Update business name, contact, branding, and details." },
  "billing": { title: "Billing & Plans - Settings", description: "Manage subscription plans and payment methods." },
  "team": { title: "Team Settings - Settings", description: "Manage team members, invitations, and permissions." },
  "roles": { title: "Roles & Permissions - Settings", description: "Configure custom roles and access control." },
  "audit-logs": { title: "Audit Logs - Settings", description: "View workspace security and action audit logs." },
  "audit_logs": { title: "Audit Logs - Settings", description: "View workspace security and action audit logs." },
  "export": { title: "Data Export - Settings", description: "Export your workspace invoices, incomes, and expenses data." },
  "danger": { title: "Danger Zone - Settings", description: "Workspace management and account deletion options." },
  "preferences": { title: "Admin Preferences - Settings", description: "Configure default dashboard date range and settings." },
  "prefs": { title: "Admin Preferences - Settings", description: "Configure default dashboard date range and settings." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }> | { section: string };
}) {
  const resolvedParams = await params;
  const section = resolvedParams.section;
  const meta = SECTION_METADATA[section];
  if (!meta) return { title: "Settings" };
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }> | { section: string };
}) {
  const resolvedParams = await params;
  const section = resolvedParams.section;
  const tab = SETTINGS_SLUG_TO_TAB[section];
  if (!tab) {
    notFound();
  }

  const dbPlans = await getActivePlans().catch(() => []);
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <MainPage initialPlans={dbPlans} initialSection={section} />
    </Suspense>
  );
}
