import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sql from "@/lib/db";
import {
  PosClientDisplayState,
  saveServerDisplayState,
  getServerDisplayState,
  DEFAULT_CUSTOMER_DISPLAY_SLIDES,
} from "@/lib/pos/client-display";
import { verifyCustomerDisplayToken } from "@/lib/security/crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const counterId = searchParams.get("counterId") ? Number(searchParams.get("counterId")) : undefined;
    const requestedTenantId = searchParams.get("tenantId") ? Number(searchParams.get("tenantId")) : null;

    let authorizedTenantId: number | null = null;
    let tokenCounterId: number | undefined = undefined;

    // 1. Authenticate via active cashier/manager NextAuth session
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      const email = session.user.email.toLowerCase();

      // Check if user has permission for requestedTenantId
      if (requestedTenantId) {
        const accessCheck = await sql`
          SELECT t.id FROM tenants t
          WHERE t.id = ${requestedTenantId}
            AND (
              LOWER(t.owner_email) = ${email}
              OR EXISTS (SELECT 1 FROM team_invitations ti WHERE ti.tenant_id = ${requestedTenantId.toString()} AND LOWER(ti.email) = ${email} AND ti.status = 'accepted')
              OR EXISTS (SELECT 1 FROM admin_users au WHERE au.tenant_id = ${requestedTenantId} AND LOWER(au.email) = ${email})
            )
          LIMIT 1
        `;
        if (accessCheck.length > 0) {
          authorizedTenantId = requestedTenantId;
        }
      }

      if (!authorizedTenantId) {
        const userRows = await sql`
          SELECT tenant_id FROM admin_users WHERE LOWER(email) = ${email} LIMIT 1
        `;
        if (userRows.length > 0 && userRows[0].tenant_id) {
          authorizedTenantId = Number(userRows[0].tenant_id);
        }
      }
    }

    // 2. Or verify cryptographically signed pairing token for standalone external tablets
    if (!authorizedTenantId) {
      const token = searchParams.get("token") || req.headers.get("x-pos-display-token");
      if (token) {
        const verified = verifyCustomerDisplayToken(token);
        if (verified) {
          authorizedTenantId = verified.tenantId;
          tokenCounterId = verified.counterId;
        }
      }
    }

    // Reject unauthenticated requests
    if (!authorizedTenantId) {
      return NextResponse.json(
        { error: "Unauthorized: Valid session or signed display token required" },
        { status: 401 }
      );
    }

    // Strict multi-tenant isolation: prevent any tenant from querying another business's POS
    if (requestedTenantId && requestedTenantId !== authorizedTenantId) {
      return NextResponse.json(
        { error: "Forbidden: Access denied to other business display" },
        { status: 403 }
      );
    }

    const tenantId = authorizedTenantId;
    const finalCounterId = counterId || tokenCounterId || 1;

    let state = getServerDisplayState(tenantId, finalCounterId);
    if (!state) {
      // Query database to see if counter has an open shift and fetch settings
      const [tenantRows, shiftResult, settingsRows] = await Promise.all([
        sql`SELECT id, name, logo_url, accent_color FROM tenants WHERE id = ${tenantId} LIMIT 1`,
        sql`
          SELECT s.id, s.counter_id, s.counter_name, s.user_name
          FROM pos_shifts s
          WHERE s.tenant_id = ${tenantId} AND s.status = 'open'
            ${finalCounterId ? sql`AND (s.counter_id = ${finalCounterId} OR s.counter_id IS NULL)` : sql``}
          ORDER BY s.id DESC LIMIT 1
        `,
        sql`SELECT customer_display_slides FROM pos_settings WHERE tenant_id = ${tenantId} LIMIT 1`.catch(() => []),
      ]);

      let shiftRows: any[] = shiftResult as any[];
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

      const isShiftOpen = shiftRows.length > 0;
      const s = shiftRows[0];
      const t = tenantRows[0];
      let tName = t?.name || "Framebooks POS";
      let tLogo = t?.logo_url || null;
      if (tName.toLowerCase().includes("ft demo") || tName.toLowerCase().includes("ft")) {
        if (!tLogo) tLogo = "/logos/ft/logo.png";
      }

      const customSlides = settingsRows[0]?.customer_display_slides;
      const parsedSlides = customSlides ? (typeof customSlides === "string" ? JSON.parse(customSlides) : customSlides) : DEFAULT_CUSTOMER_DISPLAY_SLIDES;

      state = {
        tenantId,
        tenantName: tName,
        tenantLogoUrl: tLogo,
        accentColor: t?.accent_color || null,
        counterId: s?.counter_id || finalCounterId,
        counterName: s?.counter_name || (finalCounterId ? `Counter ${finalCounterId}` : "Counter 1"),
        cashierName: s?.user_name || "Cashier",
        isShiftOpen,
        customer: { name: "Walk-in Customer", phone: "" },
        cart: [],
        summary: { subtotal: 0, discountTotal: 0, taxTotal: 0, totalDue: 0, itemCount: 0 },
        payment: { isOpen: false, method: "Cash", tendered: 0, changeDue: 0, isCompleted: false },
        slides: parsedSlides,
        timestamp: 0,
      };
    }

    return NextResponse.json({ success: true, state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized: Valid cashier session required to update display state" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || !body.tenantId) {
      return NextResponse.json({ error: "Invalid state payload" }, { status: 400 });
    }

    const targetTenantId = Number(body.tenantId);
    const email = session.user.email.toLowerCase();

    // Verify cashier / owner / team member permission for this tenant
    const accessCheck = await sql`
      SELECT t.id FROM tenants t
      WHERE t.id = ${targetTenantId}
        AND (
          LOWER(t.owner_email) = ${email}
          OR EXISTS (SELECT 1 FROM team_invitations ti WHERE ti.tenant_id = ${targetTenantId.toString()} AND LOWER(ti.email) = ${email} AND ti.status = 'accepted')
          OR EXISTS (SELECT 1 FROM admin_users au WHERE au.tenant_id = ${targetTenantId} AND LOWER(au.email) = ${email})
        )
      LIMIT 1
    `;

    if (accessCheck.length === 0) {
      return NextResponse.json(
        { error: "Forbidden: Cannot update other business display" },
        { status: 403 }
      );
    }

    saveServerDisplayState(body as PosClientDisplayState);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
