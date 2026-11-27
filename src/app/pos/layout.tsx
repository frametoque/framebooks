import React from "react";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getPosAddonStatus } from "@/lib/pos/entitlement";
import { hasGranularPermission, isCashierOnlyUser } from "@/app/(dashboard)/user/actions/rbac";
import { generateTenantThemeCss, DEFAULT_ACCENT_HEX, resolvePaletteId } from "@/lib/theme/accent";
import Link from "next/link";
import { Lock, ArrowLeft, ShieldAlert } from "lucide-react";
import { MdPointOfSale } from "react-icons/md";

export async function generateMetadata(): Promise<Metadata> {
  const session = await getServerSession(authOptions);
  let bizName = "";
  if (session?.user?.email) {
    try {
      const userRows = await sql`
        SELECT t.name as tenant_name
        FROM admin_users u
        JOIN tenants t ON u.tenant_id = t.id
        WHERE LOWER(u.email) = ${session.user.email.toLowerCase()}
        LIMIT 1
      `;
      bizName = userRows[0]?.tenant_name?.trim();
    } catch {}
  }

  return {
    title: bizName ? `POS Terminal | ${bizName}` : "POS Terminal",
    description: "Lightning-fast retail POS counter terminal with barcode scanning, automated stock tracking, and receipt printing.",
  };
}

export const dynamic = "force-dynamic";

export default async function PosRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login?callbackUrl=/pos");
  }

  const email = session.user.email.toLowerCase();

  // Resolve user, role and tenant
  const userRows = await sql`
    SELECT u.id, u.tenant_id, u.role, u.full_name, t.name as tenant_name, t.plan, t.accent_color
    FROM admin_users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE LOWER(u.email) = ${email}
    LIMIT 1
  `;

  if (userRows.length === 0 || !userRows[0].tenant_id) {
    redirect("/onboarding");
  }

  const user = userRows[0];
  const tenantId = user.tenant_id;
  const currentPlan = user.plan || "Free";
  const userRole = user.role || null;

  // Resolve accent color CSS
  const accentColor = resolvePaletteId(user.accent_color) || DEFAULT_ACCENT_HEX;
  const accentCss = generateTenantThemeCss(accentColor);

  // Check POS add-on entitlement
  const addonStatus = await getPosAddonStatus(tenantId);

  // Check user permission
  const canUsePos = await hasGranularPermission(userRole, "pos.use", tenantId);
  const isCashierOnly = await isCashierOnlyUser(userRole, tenantId);

  // 1. Gated: Tenant does not have active POS add-on
  if (!addonStatus.hasAddon) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        {accentCss && <style dangerouslySetInnerHTML={{ __html: accentCss }} />}
        
        <div className="w-20 h-20 bg-brand-500/10 text-brand-500 rounded-3xl flex items-center justify-center mb-6 border border-brand-500/20 shadow-xl shadow-brand-500/10">
          <MdPointOfSale className="w-10 h-10" />
        </div>

        {addonStatus.canPurchase ? (
          // Pro / Pro Plus tenant without POS add-on
          <div className="max-w-md">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-500/15 text-brand-500 border border-brand-500/20 mb-4 inline-block">
              Add-on Required
            </span>
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Point of Sale (POS) Add-on</h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              Fast retail checkout, barcode and QR scanning, cash drawer shift management, and automated stock deduction synced directly to your accounting ledger.
            </p>

            <div className="p-4 rounded-2xl bg-card border border-border mb-6 text-left space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Current Workspace Plan:</span>
                <span className="font-bold text-foreground">{currentPlan}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Add-on Price:</span>
                <span className="font-bold text-brand-500">
                  LKR {addonStatus.price ? Number(addonStatus.price).toLocaleString() : "3,000"} / month
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Add-on Status:</span>
                <span className="capitalize font-semibold text-amber-500">{addonStatus.status}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/settings/billing#pos-addon"
                className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                {addonStatus.status === 'requested' ? 'View Add-on Request' : 'Get POS Add-on'}
              </Link>
              {!isCashierOnly && (
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Link>
              )}
            </div>
          </div>
        ) : (
          // Free plan tenant
          <div className="max-w-md">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/20 mb-4 inline-block">
              Plan Upgrade Required
            </span>
            <h1 className="text-3xl font-bold mb-3 tracking-tight">Upgrade to Unlock POS</h1>
            <p className="text-gray-400 mb-6 text-sm leading-relaxed">
              The POS (Point of Sale) add-on is available exclusively for Pro and Pro Plus workspace plans. Upgrade your workspace to activate retail checkout and inventory sync.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/settings/billing"
                className="px-6 py-3 bg-brand-500 hover:bg-brand-400 text-brand-900 font-bold rounded-xl text-sm transition-all shadow-md active:scale-95"
              >
                Upgrade to Pro
              </Link>
              {!isCashierOnly && (
                <Link
                  href="/dashboard"
                  className="px-6 py-3 border border-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Dashboard
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Gated: User does not have pos.use permission
  if (!canUsePos) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
        {accentCss && <style dangerouslySetInnerHTML={{ __html: accentCss }} />}
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-gray-400 max-w-sm mb-6 text-sm">
          Your account role (<span className="text-foreground font-semibold">{userRole || "User"}</span>) does not have permission to operate the POS terminal.
        </p>
        {!isCashierOnly && (
          <Link
            href="/dashboard"
            className="px-6 py-2.5 bg-card border border-border hover:bg-black/5 dark:hover:bg-white/5 text-foreground rounded-xl text-sm font-semibold transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen h-screen overflow-hidden bg-background text-foreground flex flex-col antialiased select-none font-sans">
      {accentCss && <style id="pos-accent-theme-ssr" dangerouslySetInnerHTML={{ __html: accentCss }} />}
      {children}
    </div>
  );
}
