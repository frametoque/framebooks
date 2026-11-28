import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { PosClientDisplay } from "@/components/pos/PosClientDisplay";
import { DEFAULT_CUSTOMER_DISPLAY_SLIDES, PosClientDisplaySlide } from "@/lib/pos/client-display";
import { verifyCustomerDisplayToken } from "@/lib/security/crypto";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PosClientPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string; counterId?: string; token?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await searchParams;

  let authorizedTenantId: number | null = null;
  let tenantName = "Framebooks POS";
  let tenantLogoUrl: string | null = null;
  let tenantAccentColor: string | null = null;

  // 1. Resolve tenant identity from authenticated session
  if (session?.user?.email) {
    try {
      const email = session.user.email.toLowerCase();
      const requestedId = resolvedParams.tenantId ? Number(resolvedParams.tenantId) : null;

      // Check if user has access to the requested tenant, or fallback to active admin_users tenant
      let matchingTenant: any = null;
      if (requestedId) {
        const accessRows = await sql`
          SELECT t.id, t.name, t.logo_url, t.accent_color
          FROM tenants t
          WHERE t.id = ${requestedId}
            AND (
              LOWER(t.owner_email) = ${email}
              OR EXISTS (SELECT 1 FROM team_invitations ti WHERE ti.tenant_id = ${requestedId.toString()} AND LOWER(ti.email) = ${email} AND ti.status = 'accepted')
              OR EXISTS (SELECT 1 FROM admin_users au WHERE au.tenant_id = ${requestedId} AND LOWER(au.email) = ${email})
            )
          LIMIT 1
        `;
        if (accessRows.length > 0) {
          matchingTenant = accessRows[0];
        }
      }

      if (!matchingTenant) {
        const userRows = await sql`
          SELECT u.tenant_id, t.name as tenant_name, t.logo_url as tenant_logo_url, t.accent_color as tenant_accent_color
          FROM admin_users u
          JOIN tenants t ON u.tenant_id = t.id
          WHERE LOWER(u.email) = ${email}
          LIMIT 1
        `;
        if (userRows.length > 0) {
          matchingTenant = {
            id: userRows[0].tenant_id,
            name: userRows[0].tenant_name,
            logo_url: userRows[0].tenant_logo_url,
            accent_color: userRows[0].tenant_accent_color,
          };
        }
      }

      if (!matchingTenant) {
        const ownerRows = await sql`
          SELECT t.id, t.name as tenant_name, t.logo_url as tenant_logo_url, t.accent_color as tenant_accent_color
          FROM tenants t
          WHERE LOWER(t.owner_email) = ${email}
          ORDER BY t.id ASC
          LIMIT 1
        `;
        if (ownerRows.length > 0) {
          matchingTenant = {
            id: ownerRows[0].id,
            name: ownerRows[0].tenant_name,
            logo_url: ownerRows[0].tenant_logo_url,
            accent_color: ownerRows[0].tenant_accent_color,
          };
        }
      }

      if (matchingTenant) {
        authorizedTenantId = Number(matchingTenant.id);
        tenantName = matchingTenant.name || "Framebooks POS";
        tenantLogoUrl = matchingTenant.logo_url || null;
        tenantAccentColor = matchingTenant.accent_color || null;
      }
    } catch (err) {
      console.error("[POS Client Auth Lookup Error]", err);
    }
  } else if (resolvedParams.token) {
    // 2. Or verify signed pairing token for standalone external tablets
    const verified = verifyCustomerDisplayToken(resolvedParams.token);
    if (verified) {
      authorizedTenantId = verified.tenantId;
      try {
        const tRows = await sql`
          SELECT id, name, logo_url, accent_color as tenant_accent_color FROM tenants WHERE id = ${authorizedTenantId} LIMIT 1
        `;
        if (tRows.length > 0) {
          tenantName = tRows[0].name || "Framebooks POS";
          tenantLogoUrl = tRows[0].logo_url || null;
          tenantAccentColor = tRows[0].tenant_accent_color || null;
        }
      } catch {}
    }
  }

  // Automatic logo fallback for FT demo tenant
  if (tenantName.toLowerCase().includes("ft demo") || tenantName.toLowerCase().includes("ft")) {
    if (!tenantLogoUrl) {
      tenantLogoUrl = "/logos/ft/logo.png";
    }
  }

  // Security Check 1: Deny unauthenticated access without a valid signed pairing token
  if (!authorizedTenantId) {
    redirect("/login?callbackUrl=" + encodeURIComponent("/pos-client"));
  }

  // Security Check 2: Multi-tenant isolation guard. If query passes a tenantId, it MUST match the authorized tenant!
  const requestedTenantId = resolvedParams.tenantId ? Number(resolvedParams.tenantId) : null;
  if (requestedTenantId && requestedTenantId !== authorizedTenantId) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0B0F17] text-white p-6 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-2xl shadow-red-500/10">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Access Denied</h2>
        <p className="text-xs text-white/50 max-w-sm mt-2 leading-relaxed">
          You are authenticated as another business and cannot view this counter display. Please switch to your business account or contact your system administrator.
        </p>
      </div>
    );
  }

  const tenantId = authorizedTenantId;
  const counterIdParam = resolvedParams.counterId ? Number(resolvedParams.counterId) : null;
  let finalCounterId = counterIdParam || 1;
  let initialIsShiftOpen = false;
  let counterName = counterIdParam ? `Counter ${counterIdParam}` : "Counter 1";
  let cashierName = "Cashier";
  let initialSlides: PosClientDisplaySlide[] = DEFAULT_CUSTOMER_DISPLAY_SLIDES;

  try {
    const [rawShiftRows, settingsRows] = await Promise.all([
      sql`
        SELECT s.id, s.counter_id, s.counter_name, s.user_name
        FROM pos_shifts s
        WHERE s.tenant_id = ${tenantId} AND s.status = 'open'
          ${counterIdParam ? sql`AND (s.counter_id = ${counterIdParam} OR s.counter_id IS NULL)` : sql``}
        ORDER BY s.id DESC LIMIT 1
      `,
      sql`SELECT customer_display_slides FROM pos_settings WHERE tenant_id = ${tenantId} LIMIT 1`.catch(() => []),
    ]);

    let shiftRows: any[] = rawShiftRows as any[];

    // If no shift for this specific counter ID, check if there is ANY open shift on this tenant
    if (shiftRows.length === 0) {
      const anyShift = await sql`
        SELECT s.id, s.counter_id, s.counter_name, s.user_name
        FROM pos_shifts s
        WHERE s.tenant_id = ${tenantId} AND s.status = 'open'
        ORDER BY s.id DESC LIMIT 1
      `.catch(() => []);
      if (anyShift.length > 0) {
        shiftRows = anyShift as any[];
      }
    }

    if (shiftRows.length > 0) {
      initialIsShiftOpen = true;
      if (shiftRows[0].counter_name) counterName = shiftRows[0].counter_name;
      if (shiftRows[0].user_name) cashierName = shiftRows[0].user_name;
      if (shiftRows[0].counter_id) finalCounterId = Number(shiftRows[0].counter_id);
    }

    if (settingsRows[0]?.customer_display_slides) {
      const parsed = typeof settingsRows[0].customer_display_slides === "string"
        ? JSON.parse(settingsRows[0].customer_display_slides)
        : settingsRows[0].customer_display_slides;
      if (Array.isArray(parsed) && parsed.length > 0) {
        initialSlides = parsed;
      }
    }
  } catch {}

  return (
    <PosClientDisplay
      initialTenantId={tenantId}
      initialTenantName={tenantName}
      initialTenantLogoUrl={tenantLogoUrl}
      initialAccentColor={tenantAccentColor}
      initialCounterId={finalCounterId}
      initialIsShiftOpen={initialIsShiftOpen}
      initialCounterName={counterName}
      initialCashierName={cashierName}
      initialSlides={initialSlides}
      initialToken={resolvedParams.token}
    />
  );
}
