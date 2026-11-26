import { Loader } from "@/components/ui/Loader";
import React, { Suspense } from 'react';
import MainPage from '../MainPage';
import { getActivePlans } from "@/lib/plans-db";
import { redirect } from "next/navigation";
import { getUserContext } from "../../actions/rbac";
import { isSettingsSectionAllowed, SETTINGS_SLUG_TO_TAB } from "../settings-permissions";

export const dynamic = "force-dynamic";

const SECTION_METADATA: Record<string, { title: string; description: string }> = {
  "security": { title: "Security | Framebooks", description: "Manage App Lock and authentication passkeys." },
  "profile": { title: "Security | Framebooks", description: "Manage App Lock and authentication passkeys." },
  "business": { title: "Business Profile | Framebooks", description: "Update business name, contact, branding, and details." },
  "appearance": { title: "Appearance | Framebooks", description: "Customize dashboard accent colour, theme branding, and palettes." },
  "theme": { title: "Appearance | Framebooks", description: "Customize dashboard accent colour, theme branding, and palettes." },
  "notifications": { title: "Notifications | Framebooks", description: "Manage browser push notifications, transaction reminders, and automated expense alerts." },
  "reminders": { title: "Notifications | Framebooks", description: "Manage browser push notifications, transaction reminders, and automated expense alerts." },
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
  "integrations": { title: "3rd Party Integrations | Framebooks", description: "Connect and sync your online WooCommerce store inventory and orders with Framebooks POS." },
  "woocommerce": { title: "3rd Party Integrations | Framebooks", description: "Connect and sync your online WooCommerce store inventory and orders with Framebooks POS." },
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
    redirect("/settings");
  }

  const { role } = await getUserContext();
  if (!role || !isSettingsSectionAllowed(section, role)) {
    redirect("/settings");
  }

  const dbPlans = await getActivePlans().catch(() => []);
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>}>
      <MainPage initialPlans={dbPlans} initialSection={section} />
    </Suspense>
  );
}
