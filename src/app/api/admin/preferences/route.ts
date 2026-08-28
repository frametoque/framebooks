import { NextResponse } from "next/server";
import {  auth  } from '@/lib/auth';
import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function ensurePrefsTable() {
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensurePrefsTable();

    const rows = await sql`
      SELECT currency, invoice_prefix, auto_refresh, max_upload_size 
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
          maxUploadSize: "5"
        }
      });
    }

    const row = rows[0];
    return NextResponse.json({
      success: true,
      prefs: {
        currency: row.currency,
        invoicePrefix: row.invoice_prefix,
        autoRefresh: row.auto_refresh,
        maxUploadSize: row.max_upload_size
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
    const { currency, invoicePrefix, autoRefresh, maxUploadSize } = await request.json();

    await sql`
      INSERT INTO admin_preferences (user_id, currency, invoice_prefix, auto_refresh, max_upload_size)
      VALUES (${userId}, ${currency}, ${invoicePrefix}, ${autoRefresh}, ${maxUploadSize})
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        currency = EXCLUDED.currency,
        invoice_prefix = EXCLUDED.invoice_prefix,
        auto_refresh = EXCLUDED.auto_refresh,
        max_upload_size = EXCLUDED.max_upload_size
    `;

    await logSystemAction(`Updated Admin Settings: Currency=${currency}, Prefix=${invoicePrefix}, AutoRefresh=${autoRefresh}s, MaxUpload=${maxUploadSize}MB`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST admin preferences error:", error);
    return NextResponse.json({ success: false, error: "Failed to save preferences" }, { status: 500 });
  }
}
