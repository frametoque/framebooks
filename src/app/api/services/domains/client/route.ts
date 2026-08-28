import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("user_email");

    if (!userEmail) {
      return NextResponse.json({ error: "user_email is required" }, { status: 400 });
    }

    const rows = await sql`
      SELECT 
        d.id,
        d.domain_name,
        d.selling_price,
        d.renewal_price,
        d.status,
        d.expiry_date,
        d.created_at,
        d.invoice_id,
        d.activation_lkr_price,
        d.activation_lkr_rate,
        i.payment_status,
        i.total_due,
        i.currency
      FROM admin_domain_orders d
      LEFT JOIN invoices i ON d.invoice_id = i.invoice_id
      WHERE LOWER(d.client_email) = LOWER(${userEmail})
      ORDER BY d.created_at DESC
    `;

    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("Failed to fetch client domains:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
