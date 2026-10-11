import { uploadToR2 } from "@/lib/r2";
import { auth } from '@/lib/auth';
import { NextResponse } from "next/server";
import postgres from "postgres";
const neon = postgres;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Use JPG, PNG, GIF or WebP." }, { status: 400 });
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be under 2MB." }, { status: 400 });
    }

    // Get tenant ID
    const sql = neon(process.env.DATABASE_URL!);
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0} LIMIT 1`;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantId = userRows[0].tenant_id;

    // Upload to Cloudflare R2
    const ext = file.name.split(".").pop() || "png";
    const customKey = `logos/tenant-${tenantId}.${ext}`;
    const result = await uploadToR2({
      file,
      customKey,
      folder: "logos",
    });

    // Update logo_url in the database
    await sql`UPDATE tenants SET logo_url = ${result.url} WHERE id = ${tenantId}`;

    return NextResponse.json({ success: true, url: result.url });
  } catch (e: any) {
    console.error("Logo upload error:", e);
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 500 });
  }
}
