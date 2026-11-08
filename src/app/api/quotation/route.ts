// app/api/quotation/route.ts
import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  // ── Rate limit: max 10 quotation creations per 10 minutes per IP ─────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rateCheck = checkRateLimit("quotation-post", ip, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many quotation requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    quoteName: string;
    quoteEmail: string;
    quotePhone: string;
    cartItems: {
      id?: string;
      serviceId?: string;
      serviceTitle: string;
      tier: string;
      duration: string;
      quantity: number;
      price: string | number;
      categorySlug?: string;
    }[];
    subtotalLKR: number;
    forceInsert?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { quoteName, quoteEmail, quotePhone, cartItems, subtotalLKR } = body;

  if (!quoteName || !quoteEmail || !quotePhone || !cartItems?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const descriptionText = `${cartItems
    .map((i) => `${i.serviceTitle} – ${i.tier}`)
    .join(", ")}`;

  // Get or Create Client
  let clientId: string;
  try {
    const existing = await sql`
      SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${quoteEmail}) LIMIT 1
    `;
    if (existing.length > 0) {
      clientId = existing[0].id;

      // Duplicate check (skip if forceInsert is true or if it's a domain order)
      const isDomainOrder = cartItems.some((item) => item.categorySlug === "domain" || item.id?.startsWith("domain-") || item.serviceId === "domain-reg");
      
      if (!body.forceInsert && !isDomainOrder) {
        const clientQuotes = await sql`
          SELECT id FROM admin_quotations 
          WHERE client_id = ${clientId} 
          ORDER BY id DESC 
          LIMIT 10
        `;

        let isDuplicate = false;
        for (const q of clientQuotes) {
          const qItems = await sql`
            SELECT description, quantity FROM quotation_items WHERE quotation_id = ${q.id}
          `;
          if (qItems.length === cartItems.length) {
            const match = cartItems.every((cartItem) => {
              const expectedDescription = `${cartItem.serviceTitle} – ${cartItem.tier})`;
              const matchingDbItem = qItems.find(
                (dbItem) =>
                  dbItem.description === expectedDescription &&
                  dbItem.quantity === cartItem.quantity
              );
              return !!matchingDbItem;
            });
            if (match) {
              isDuplicate = true;
              break;
            }
          }
        }

        if (isDuplicate) {
          return NextResponse.json({
            duplicate: true,
            message: "You have similar request already? Do you want to put new request?"
          });
        }
      }
    } else {
      clientId = "C-" + Date.now();
      await sql`
        INSERT INTO admin_clients (id, name, company, email, phone, address, active)
        VALUES (
          ${clientId},
          ${quoteName},
          null,
          ${quoteEmail},
          ${quotePhone},
          null,
          true
        )
      `;
    }
  } catch (err) {
    console.error("[quotation] client lookup/creation failed:", err);
    return NextResponse.json(
      { error: "Failed to resolve client details. Please try again." },
      { status: 500 }
    );
  }



  // Map categories to DB tags
  const mapCategory = (slug?: string): string => {
    if (!slug) return "Other";
    switch (slug) {
      case "web-dev":
        return "Web dev";
      case "graphic-design":
        return "Graphic design";
      case "video-editing":
        return "Video editing";
      case "photo-video":
        return "Photography, Videography";
      default:
        return "Other";
    }
  };

  const uniqueCategories = Array.from(
    new Set(cartItems.map((item) => mapCategory(item.categorySlug)))
  );
  const tags = Array.from(
    new Set(uniqueCategories.flatMap((c) => c.split(",").map((s) => s.trim())))
  );
  const quotationCategory = tags.join(", ") || "Other";

  // ── Step 1: insert parent quotation ──────────────────────────────────────
  let quotationId: number;
  try {
    const rows = await sql`
      INSERT INTO admin_quotations (
        date,
        amount,
        client_id,
        description,
        category,
        payment_method,
        status,
        project_confirmed,
        advance,
        total_due
      ) VALUES (
        CURRENT_DATE,
        ${subtotalLKR},
        ${clientId},
        ${descriptionText},
        ${quotationCategory},
        'Bank Transfer',
        'client-draft',
        false,
        0,
        ${subtotalLKR}
      )
      RETURNING id
    `;
    quotationId = rows[0].id;
  } catch (err) {
    console.error("[quotation] admin_quotations INSERT failed:", err);
    return NextResponse.json(
      { error: "Failed to create quotation record." },
      { status: 500 }
    );
  }

  // ── Step 2: insert line items ─────────────────────────────────────────────
  try {
    for (const item of cartItems) {
      const unitPrice =
        parseFloat(String(item.price).replace(/[^0-9.-]/g, "")) || 0;
      const lineTotal = unitPrice * item.quantity;

      await sql`
        INSERT INTO quotation_items (
          quotation_id,
          description,
          quantity,
          price,
          total
        ) VALUES (
          ${quotationId},
          ${`${item.serviceTitle} – ${item.tier})`},
          ${item.quantity},
          ${unitPrice},
          ${lineTotal}
        )
      `;
    }
  } catch (err) {
    console.error("[quotation] quotation_items INSERT failed:", err);
    return NextResponse.json(
      { error: "Failed to create quotation line items." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, quotationId });
}

export async function GET(req: NextRequest) {
  // ── Authentication & Authorization check (SEC-01) ─────────────────────────
  const { userId, user } = await auth();
  if (!userId || !user) {
    return NextResponse.json(
      { error: "Unauthorized. Authentication required to access quotations." },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("user_email");

    if (!userEmail) {
      return NextResponse.json(
        { error: "user_email is required" },
        { status: 400 }
      );
    }

    const userWithRole = user as { role?: string; email?: string };
    const isPrivilegedAdmin = userWithRole.role === "admin";
    const isOwner = user.email && user.email.toLowerCase() === userEmail.toLowerCase();

    if (!isPrivilegedAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden. You do not have permission to access these quotations." },
        { status: 403 }
      );
    }

    // Step 1: Find client ID by email
    const clients = await sql`
      SELECT id FROM admin_clients WHERE LOWER(email) = LOWER(${userEmail}) LIMIT 1
    `;

    if (clients.length === 0) {
      return NextResponse.json([]); // No client found, return empty array
    }

    const clientId = clients[0].id;

    // Step 2: Query quotations for this client
    const quotations = await sql`
      SELECT 
        id,
        date,
        amount,
        client_id as "clientId",
        description,
        category,
        payment_method as "paymentMethod",
        status,
        project_confirmed as "projectConfirmed",
        advance,
        total_due as "totalDue"
      FROM admin_quotations
      WHERE client_id = ${clientId}
      ORDER BY date DESC, id DESC
    `;

    if (quotations.length === 0) {
      return NextResponse.json([]);
    }

    // Step 3: Fetch items for each quotation
    const quotesWithItems = await Promise.all(
      quotations.map(async (q) => {
        const items = await sql`
          SELECT 
            id,
            description,
            quantity,
            price,
            total
          FROM quotation_items
          WHERE quotation_id = ${q.id}
        `;
        return {
          ...q,
          items,
        };
      })
    );

    return NextResponse.json(quotesWithItems);
  } catch (err: any) {
    console.error("[quotation] GET failed:", err);
    return NextResponse.json(
      { 
        error: "Failed to fetch quotations", 
        message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
      },
      { status: 500 }
    );
  }
}