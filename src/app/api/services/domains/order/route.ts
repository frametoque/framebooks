import { NextResponse } from "next/server";
import {  currentUser  } from '@/lib/auth';
import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

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

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const body = await req.json();
    const { domain } = body;

    if (!domain || typeof domain !== "string" || !domain.includes(".")) {
      return NextResponse.json({ error: "Invalid domain name provided." }, { status: 400 });
    }

    const cleanDomain = domain.trim().toLowerCase();
    const parts = cleanDomain.split(".");
    const tld = parts[parts.length - 1] || "com";

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
    const profit = parseFloat((regRetail - cheapest.regCost).toFixed(2));

    await sql`
      INSERT INTO admin_domain_orders (
        client_email, domain_name, actual_price, selling_price, profit, renewal_cost, renewal_price, registrar, expiry_date, status
      ) VALUES (
        ${email}, ${cleanDomain}, ${cheapest.regCost}, ${regRetail}, 
        ${profit}, ${cheapest.renewCost}, ${renewRetail}, ${cheapest.registrar}, null, 'pending'
      )
    `;

    await logSystemAction(`Client "${email}" ordered domain: "${cleanDomain}" directly via dashboard`);

    return NextResponse.json({ success: true, domain: cleanDomain });
  } catch (err: any) {
    console.error("Failed to place direct domain order:", err);
    return NextResponse.json({ error: err.message || "Failed to order domain." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Domain order ID is required." }, { status: 400 });
    }

    const rows = await sql`
      SELECT id, domain_name, status FROM admin_domain_orders 
      WHERE id = ${id} AND LOWER(client_email) = ${email.toLowerCase()}
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: "Domain order not found or not owned by user." }, { status: 404 });
    }

    const order = rows[0];
    if (order.status?.toLowerCase() !== "pending") {
      return NextResponse.json({ error: "Only pending domain orders can be cancelled." }, { status: 400 });
    }

    await sql`
      DELETE FROM admin_domain_orders
      WHERE id = ${id} AND LOWER(client_email) = ${email.toLowerCase()} AND status = 'pending'
    `;

    await logSystemAction(`Client "${email}" cancelled pending domain order: "${order.domain_name}" (ID: ${id})`);

    return NextResponse.json({ success: true, message: `Domain order for ${order.domain_name} cancelled successfully.` });
  } catch (err: any) {
    console.error("Failed to cancel domain order:", err);
    return NextResponse.json({ error: err.message || "Failed to cancel domain order." }, { status: 500 });
  }
}
