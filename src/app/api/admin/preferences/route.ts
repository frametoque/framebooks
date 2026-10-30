import { NextResponse } from "next/server";
import { getAdminUser } from "@/app/(dashboard)/admin/_lib/auth";
import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden. Administrative access required." }, { status: 403 });
    }

    const rows = await sql`
      SELECT currency, invoice_prefix, auto_refresh, max_upload_size, default_view_range 
      FROM admin_preferences 
      WHERE user_id = ${String(admin.id)}
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
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden. Administrative access required." }, { status: 403 });
    }

    const { currency, invoicePrefix, autoRefresh, maxUploadSize, defaultViewRange } = await request.json();

    await sql`
      INSERT INTO admin_preferences (user_id, currency, invoice_prefix, auto_refresh, max_upload_size, default_view_range, updated_at)
      VALUES (${String(admin.id)}, ${currency}, ${invoicePrefix}, ${autoRefresh}, ${maxUploadSize}, ${defaultViewRange || 'this year'}, NOW())
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
