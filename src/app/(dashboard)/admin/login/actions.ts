// src/app/(dashboard)/admin/login/actions.ts
"use server";

import sql from "@/lib/db";
import { verifyPassword } from "@/app/(dashboard)/admin/_lib/passwords";
import { isStaffRole } from "@/app/(dashboard)/admin/_lib/permissions";
import { createAdminToken, setAdminSessionCookie, clearAdminSessionCookie } from "@/app/(dashboard)/admin/_lib/session";
import { redirect } from "next/navigation";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function adminLoginAction({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!email || !password) {
    return { success: false, error: "Email and password are required." };
  }

  const cleanEmail = email.trim().toLowerCase();

  const rateCheck = checkRateLimit("admin-login", cleanEmail, { windowMs: 15 * 60 * 1000, max: 5 });
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed login attempts. Please wait ${Math.ceil(rateCheck.retryAfterSeconds / 60)} minute(s) before trying again.`
    };
  }

  const rows = await sql`
    SELECT id, email, password_hash, full_name, system_role, is_banned, deleted_at
    FROM admin_users
    WHERE LOWER(email) = ${cleanEmail}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { success: false, error: "Invalid admin email or password." };
  }

  const user = rows[0];

  const systemRole = user.system_role || "user";
  if (!isStaffRole(systemRole)) {
    return { success: false, error: "Access denied: Not an administrative account." };
  }

  if (user.is_banned || user.deleted_at) {
    return { success: false, error: "Account has been deactivated or suspended." };
  }

  if (!user.password_hash) {
    return { success: false, error: "No password configured for this admin account." };
  }

  const isValid = verifyPassword(password, user.password_hash);
  if (!isValid) {
    return { success: false, error: "Invalid admin email or password." };
  }

  // Record login timestamp
  await sql`UPDATE admin_users SET last_login_at = NOW() WHERE id = ${user.id}`;

  // Issue dedicated admin session token
  const token = createAdminToken({
    id: user.id,
    email: user.email,
    systemRole,
  });

  await setAdminSessionCookie(token);

  return { success: true };
}

export async function adminLogoutAction() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
