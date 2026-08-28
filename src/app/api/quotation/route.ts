// app/api/quotation/route.ts
import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
const neon = postgres;

export async function POST(req: NextRequest) {
  // ── Env check ────────────────────────────────────────────────────────────
  if (!process.env.DATABASE_URL) {
    console.error("[quotation] DATABASE_URL is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: DATABASE_URL missing." },
      { status: 500 }
    );
  }

  // Initialise inside the handler so env is always resolved
  const sql = neon(process.env.DATABASE_URL);

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
      console.log("[quotation] found existing client:", clientId);

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
          console.log("[quotation] duplicate quotation detected for client:", clientId);
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
      console.log("[quotation] created new client:", clientId);
    }
  } catch (err) {
    console.error("[quotation] client lookup/creation failed:", err);
    return NextResponse.json(
      { error: "DB error resolving client.", detail: String(err) },
      { status: 500 }
    );
  }

  // Check if cart contains domain registrations
  const isDomainOrder = cartItems.every((item) => item.categorySlug === "domain" || item.id?.startsWith("domain-") || item.serviceId === "domain-reg");

  if (isDomainOrder) {
    try {
      for (const item of cartItems) {
        const domainName = item.serviceTitle.replace("Domain Registration: ", "").trim().toLowerCase();
        
        // Extract TLD
        const parts = domainName.split(".");
        const tld = parts[parts.length - 1] || "com";
        
        interface RegistrarPricing {
          registrar: string;
          regCost: number;
          renewCost: number;
        }
        const REGISTRARS_DB: Record<string, RegistrarPricing[]> = {
          com: [
            { registrar: "Cloudflare", regCost: 10.46, renewCost: 10.46 },
            { registrar: "Namecheap", regCost: 13.98, renewCost: 15.88 },
            { registrar: "Internet.bs", regCost: 13.45, renewCost: 14.25 },
            { registrar: "GoDaddy", regCost: 11.99, renewCost: 21.99 }
          ],
          net: [
            { registrar: "Cloudflare", regCost: 11.86, renewCost: 11.86 },
            { registrar: "Internet.bs", regCost: 15.50, renewCost: 16.50 },
            { registrar: "Namecheap", regCost: 14.98, renewCost: 17.98 }
          ],
          org: [
            { registrar: "Cloudflare", regCost: 8.50, renewCost: 11.20 },
            { registrar: "Internet.bs", regCost: 16.00, renewCost: 17.00 },
            { registrar: "Namecheap", regCost: 15.98, renewCost: 18.98 }
          ],
          engineering: [
            { registrar: "Cloudflare", regCost: 50.20, renewCost: 50.20 }
          ],
          ca: [
            { registrar: "Cloudflare", regCost: 9.19, renewCost: 9.19 }
          ],
          uk: [
            { registrar: "Cloudflare", regCost: 5.30, renewCost: 5.30 }
          ],
          biz: [
            { registrar: "Cloudflare", regCost: 18.20, renewCost: 18.20 }
          ],
          icu: [
            { registrar: "Cloudflare", regCost: 15.20, renewCost: 15.20 }
          ],
          info: [
            { registrar: "Internet.bs", regCost: 4.50, renewCost: 12.50 },
            { registrar: "Namecheap", regCost: 3.98, renewCost: 17.98 }
          ],
          xyz: [
            { registrar: "Cloudflare", regCost: 2.99, renewCost: 12.99 },
            { registrar: "Internet.bs", regCost: 2.99, renewCost: 12.99 },
            { registrar: "Namecheap", regCost: 2.48, renewCost: 14.98 }
          ]
        };
        const options = REGISTRARS_DB[tld] || [
          { registrar: "Cloudflare", regCost: 10.46, renewCost: 10.46 }
        ];
        let cheapest = options[0];
        for (const opt of options) {
          if (opt.regCost < cheapest.regCost) {
            cheapest = opt;
          }
        }
        const regRetail = parseFloat((cheapest.regCost + 5.50).toFixed(2));
        const renewRetail = parseFloat((cheapest.renewCost + 5.50).toFixed(2));
        
        await sql`
          INSERT INTO admin_domain_orders (
            client_email, domain_name, actual_price, selling_price, profit, renewal_cost, renewal_price, registrar, expiry_date, status
          ) VALUES (
            ${quoteEmail}, ${domainName}, ${cheapest.regCost}, ${regRetail}, 
            ${regRetail - cheapest.regCost}, ${cheapest.renewCost}, ${renewRetail}, ${cheapest.registrar}, null, 'pending'
          )
        `;
        console.log("[quotation] inserted domain order only:", domainName);
      }
      return NextResponse.json({ success: true, isDomainOrderOnly: true });
    } catch (domErr) {
      console.error("[quotation] failed to save domain order:", domErr);
      return NextResponse.json({ error: "Failed to process domain order.", detail: String(domErr) }, { status: 500 });
    }
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
    console.log("[quotation] inserted admin_quotations id:", quotationId);
  } catch (err) {
    console.error("[quotation] admin_quotations INSERT failed:", err);
    return NextResponse.json(
      { error: "DB error inserting quotation.", detail: String(err) },
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
    console.log("[quotation] inserted", cartItems.length, "quotation_items");
  } catch (err) {
    console.error("[quotation] quotation_items INSERT failed:", err);
    return NextResponse.json(
      { error: "DB error inserting line items.", detail: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, quotationId });
}

export async function GET(req: NextRequest) {
  if (!process.env.DATABASE_URL) {
    console.error("[quotation] DATABASE_URL is not set");
    return NextResponse.json(
      { error: "Server misconfiguration: DATABASE_URL missing." },
      { status: 500 }
    );
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("user_email");

    if (!userEmail) {
      return NextResponse.json(
        { error: "user_email is required" },
        { status: 400 }
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