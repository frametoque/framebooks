import { NextResponse } from "next/server";
import {  auth  } from '@/lib/auth';
import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function ensurePrefsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS public.admin_preferences (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) UNIQUE,
      tenant_id INTEGER,
      currency VARCHAR(10) DEFAULT 'USD',
      invoice_prefix VARCHAR(50) DEFAULT 'INV',
      auto_refresh VARCHAR(20) DEFAULT '30',
      max_upload_size VARCHAR(20) DEFAULT '5',
      default_view_range VARCHAR(50) DEFAULT 'this year',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrefsTable();

    const rows = await sql`
      SELECT currency, invoice_prefix, auto_refresh, max_upload_size, default_view_range 
      FROM admin_preferences 
      WHERE user_id = ${userId}
    `;

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        prefs: {
          currency: "USD",
          invoicePrefix: "INV",
          autoRefresh: "30",
          maxUploadSize: "5",
          defaultViewRange: "this year"
        }
      });
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      prefs: {
        currency: row.currency || "USD",
        invoicePrefix: row.invoice_prefix || "INV",
        autoRefresh: row.auto_refresh || "30",
        maxUploadSize: row.max_upload_size || "5",
        defaultViewRange: row.default_view_range || "this year"
      }
    });
  } catch (error) {
    console.error("GET admin preferences error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch preferences" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrefsTable();
    const { currency, invoicePrefix, autoRefresh, maxUploadSize, defaultViewRange } = await request.json();

    await sql`
      INSERT INTO admin_preferences (user_id, currency, invoice_prefix, auto_refresh, max_upload_size, default_view_range, updated_at)
      VALUES (${userId}, ${currency}, ${invoicePrefix}, ${autoRefresh}, ${maxUploadSize}, ${defaultViewRange || 'this year'}, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        currency = EXCLUDED.currency,
        invoice_prefix = EXCLUDED.invoice_prefix,
        auto_refresh = EXCLUDED.auto_refresh,
        max_upload_size = EXCLUDED.max_upload_size,
        default_view_range = EXCLUDED.default_view_range,
        updated_at = NOW()
    `;

    await logSystemAction(`Updated Admin Settings: Currency=${currency}, Prefix=${invoicePrefix}, AutoRefresh=${autoRefresh}s, MaxUpload=${maxUploadSize}MB, DefaultRange=${defaultViewRange || 'this year'}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST admin preferences error:", error);
    return NextResponse.json({ success: false, error: "Failed to save preferences" }, { status: 500 });
  }
}
