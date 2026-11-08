export const SETTINGS_SLUG_TO_TAB: Record<string, string> = {
  "security": "profile",
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

export const SETTINGS_TAB_TO_SLUG: Record<string, string> = {
  "profile": "security",
  "business": "business",
  "appearance": "appearance",
  "billing": "billing",
  "team": "team",
  "audit_logs": "audit-logs",
  "export": "export",
  "danger": "danger",
  "prefs": "preferences",
};

export const SETTINGS_TAB_TITLES: Record<string, string> = {
  profile: "Security",
  business: "Business Profile",
  appearance: "Appearance & Layouts",
  billing: "Billing & Plans",
  team: "Team & Permissions",
  audit_logs: "Audit Logs",
  export: "Data Export",
  danger: "Danger Zone",
  prefs: "Admin Preferences",
};

/**
 * Validates whether a workspace user role is authorized to access a given settings section or tab.
 */
export function isSettingsSectionAllowed(
  sectionOrTab: string | null | undefined,
  role: string | null | undefined
): boolean {
  if (!sectionOrTab) return true; // Settings hub is accessible
  if (!role) return false;

  const r = role.toLowerCase().trim();
  const raw = sectionOrTab.toLowerCase().trim();
  const tab = SETTINGS_SLUG_TO_TAB[raw] || raw;

  // Workspace Owner has full access to all sections
  if (r === "owner") return true;

  // Super Admin has full access to all sections except export (which is owner-only)
  if (r === "super admin") {
    return tab !== "export";
  }

  // Profile & Appearance (theme/layouts) are accessible to all workspace members
  if (tab === "profile" || tab === "appearance") {
    return true;
  }

  // Business Profile: Admin (not Viewer, not Editor)
  if (tab === "business") {
    return r !== "viewer" && r !== "editor";
  }

  // Admin Preferences: Admin
  if (tab === "prefs") {
    return r === "admin";
  }

  // Billing, Team, Roles, Audit Logs, Export, Danger are forbidden for regular Admin, Editor, Viewer
  return false;
}

