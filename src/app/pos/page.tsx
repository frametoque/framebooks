import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { ensurePosSchema, seedFtDemoTenantStock } from "@/lib/pos/db-init";
import { hasGranularPermission, isCashierOnlyUser } from "@/app/(dashboard)/user/actions/rbac";
import { PosTerminalClient } from "@/components/pos/PosTerminalClient";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  await ensurePosSchema();

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/pos");
  }

  const email = session.user.email.toLowerCase();

  const userRows = await sql`
    SELECT u.id, u.tenant_id, u.role, u.full_name, t.name as tenant_name, t.logo_url as tenant_logo_url, t.accent_color as tenant_accent_color
    FROM admin_users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE LOWER(u.email) = ${email}
    LIMIT 1
  `;

  if (userRows.length === 0 || !userRows[0].tenant_id) {
    redirect("/login");
  }

  const user = userRows[0];
  const tenantId = user.tenant_id;
  const userRole = user.role || null;
  const tenantName = user.tenant_name || "My Business";
  const userName = user.full_name || session.user.name || "Cashier";
  let tenantLogoUrl = user.tenant_logo_url || null;
  const tenantAccentColor = user.tenant_accent_color || null;

  // Automatically seed test products for FT DEMO tenant
  if (tenantName.toLowerCase().includes("ft demo") || tenantName.toLowerCase().includes("ft")) {
    await seedFtDemoTenantStock(tenantId);
    if (!tenantLogoUrl) {
      tenantLogoUrl = "/logos/ft/logo.png";
    }
  }

  // Check active shift for this user
  const shiftRows = await sql`
    SELECT id, tenant_id, user_id, user_name, shift_number, counter_id, counter_name, opened_at, opening_cash, status, notes
    FROM pos_shifts
    WHERE tenant_id = ${tenantId} AND user_id = ${user.id} AND status = 'open'
    ORDER BY id DESC LIMIT 1
  `;
  const initialShift = shiftRows.length > 0 ? shiftRows[0] : null;

  // Granular permissions & WooCommerce connection check
  const [
    isCashierOnly,
    canManageStock,
    canRefund,
    canDiscount,
    canVoid,
    canViewReports,
    wooConnRows,
  ] = await Promise.all([
    isCashierOnlyUser(userRole, tenantId),
    hasGranularPermission(userRole, "stock.manage", tenantId),
    hasGranularPermission(userRole, "pos.refund", tenantId),
    hasGranularPermission(userRole, "pos.discount", tenantId),
    hasGranularPermission(userRole, "pos.void", tenantId),
    hasGranularPermission(userRole, "pos.reports.view", tenantId),
    sql`SELECT status FROM woocommerce_connections WHERE tenant_id = ${tenantId} AND status = 'connected' LIMIT 1`.catch(() => []),
  ]);
  const isWooConnected = Array.isArray(wooConnRows) && wooConnRows.length > 0;

  return (
    <PosTerminalClient
      tenantId={tenantId}
      initialShift={initialShift}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      tenantAccentColor={tenantAccentColor}
      userName={userName}
      userRole={userRole || "Cashier"}
      isCashierOnly={isCashierOnly}
      canManageStock={canManageStock}
      canRefund={canRefund}
      canDiscount={canDiscount}
      canVoid={canVoid}
      canViewReports={canViewReports}
      isWooConnected={isWooConnected}
    />
  );
}
