import { uploadToR2 } from "@/lib/r2";
import { auth } from '@/lib/auth';
import { NextResponse } from "next/server";
import sql from "@/lib/db";

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

    // Inspect file binary magic bytes to prevent MIME-spoofing and reject malicious files
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let detectedExt: string | null = null;
    let detectedMime: string | null = null;

    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      detectedExt = "png";
      detectedMime = "image/png";
    } else if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      detectedExt = "jpg";
      detectedMime = "image/jpeg";
    } else if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      detectedExt = "gif";
      detectedMime = "image/gif";
    } else if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      detectedExt = "webp";
      detectedMime = "image/webp";
    }

    if (!detectedExt || !detectedMime) {
      return NextResponse.json({ error: "Invalid image format. Only authentic JPG, PNG, GIF, or WebP images are allowed." }, { status: 400 });
    }

    // Get tenant ID
    const userRows = await sql`SELECT tenant_id FROM admin_users WHERE id = ${Number(userId) || 0} LIMIT 1`;
    if (!userRows || userRows.length === 0) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }
    const tenantId = userRows[0].tenant_id;

    // Upload to Cloudflare R2 with strict verified extension
    const customKey = `logos/tenant-${tenantId}.${detectedExt}`;
    const result = await uploadToR2({
      file: buffer,
      contentType: detectedMime,
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
