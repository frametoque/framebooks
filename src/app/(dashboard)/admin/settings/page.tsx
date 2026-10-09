// src/app/(dashboard)/admin/settings/page.tsx
import React from "react";
import { SettingsClient } from "./SettingsClient";
import { getPlatformSettings } from "./actions";
import { requireAdmin } from "@/app/(dashboard)/admin/_lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdmin("manage_settings");
  const settings = await getPlatformSettings();

  return (
    <div className="space-y-6">
      <SettingsClient initialSettings={settings} />
    </div>
  );
}
