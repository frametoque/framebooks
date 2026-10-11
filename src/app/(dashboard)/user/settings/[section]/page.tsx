import { Loader } from "@/components/ui/Loader";
import React, { Suspense } from 'react';
import MainPage from '../MainPage';
import { getActivePlans } from "@/lib/plans-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const SETTINGS_SLUG_TO_TAB: Record<string, string> = {
  "profile": "profile",
  "business": "business",
  "appearance": "appearance",
  "invoice-layout": "appearance",
  "invoice_layout": "appearance",
  "billing": "billing",
  "team": "team",
  "roles": "team",
  "audit-logs": "audit_logs",
  "audit_logs": "audit_logs",
  "export": "export",
  "danger": "danger",
  "preferences": "prefs",
  "prefs": "prefs",
};

const SECTION_METADATA: Record<string, { title: string; description: string }> = {
  "profile": { title: "Account & Security | Framebooks", description: "Manage your profile, connected accounts, and app lock." },
  "business": { title: "Business Profile | Framebooks", description: "Update business name, contact, branding, and details." },
  "appearance": { title: "Appearance & Layouts | Framebooks", description: "Customize dashboard accent colour, theme branding, and invoice layouts." },
  "invoice-layout": { title: "Invoice Layouts | Framebooks", description: "Design, customize, and arrange custom invoice templates and fields." },
  "billing": { title: "Billing & Plans | Framebooks", description: "Manage subscription plans and payment methods." },
  "team": { title: "Team & Permissions | Framebooks", description: "Manage team members, invitations, and custom roles." },
  "roles": { title: "Roles & Permissions | Framebooks", description: "Configure custom roles and access control." },
  "audit-logs": { title: "Audit Logs | Framebooks", description: "View workspace security and action audit logs." },
  "audit_logs": { title: "Audit Logs | Framebooks", description: "View workspace security and action audit logs." },
  "export": { title: "Data Export | Framebooks", description: "Export your workspace invoices, incomes, and expenses data." },
  "danger": { title: "Danger Zone | Framebooks", description: "Workspace management and account deletion options." },
  "preferences": { title: "Admin Preferences | Framebooks", description: "Configure default dashboard date range and settings." },
  "prefs": { title: "Admin Preferences | Framebooks", description: "Configure default dashboard date range and settings." },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }> | { section: string };
}) {
  const resolvedParams = await params;
  const section = resolvedParams?.section || "";
  const meta = SECTION_METADATA[section];
  if (!meta) return { title: "Settings | Framebooks" };
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
  const section = resolvedParams?.section || "";
  const tab = SETTINGS_SLUG_TO_TAB[section];
  if (!tab) {
    redirect("/user/settings");
  }

  const dbPlans = await getActivePlans().catch(() => []);
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <MainPage initialPlans={dbPlans} initialSection={section} />
    </Suspense>
  );
}
