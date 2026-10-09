// src/app/(dashboard)/admin/settings/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getPlatformSettings() {
  await requireAdmin("manage_settings");

  const rows = await sql`SELECT key, value FROM platform_settings`;
  const settings: Record<string, any> = {
    grace_period_days: 7,
    default_currency: "LKR",
    support_email: "support@frametoque.com",
    maintenance_mode: false,
    signups_enabled: true,
  };

  rows.forEach((r) => {
    settings[r.key] = r.value;
  });

  return settings;
}

export async function savePlatformSettings(newSettings: Record<string, any>) {
  const actor = await requireAdmin("manage_settings");

  const before = await getPlatformSettings();

  for (const [key, val] of Object.entries(newSettings)) {
    await sql`
      INSERT INTO platform_settings (key, value, updated_at, updated_by)
      VALUES (${key}, ${sql.json(val)}, NOW(), ${actor.email})
      ON CONFLICT (key) DO UPDATE SET
        value = ${sql.json(val)},
        updated_at = NOW(),
        updated_by = ${actor.email}
    `;
  }

  await logAdminAction({
    actor,
    action: "UPDATE_PLATFORM_SETTINGS",
    targetType: "settings",
    targetId: "global",
    before,
    after: newSettings,
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
