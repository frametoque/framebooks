import { NextResponse } from "next/server";
import { auth } from '@/lib/auth';
import sql from "@/lib/db";
import { checkR2Health } from "@/lib/r2";

import { getAdminUser } from "@/app/(dashboard)/admin/_lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin || !["super_admin", "admin"].includes(admin.systemRole)) {
      return NextResponse.json({ error: "Forbidden. Administrative access required." }, { status: 403 });
    }

    // 1. Check DB
    let dbStatus = "Disconnected";
    try {
      await sql`SELECT 1`;
      dbStatus = "Connected";
    } catch (e) {
      console.error("DB check failed:", e);
    }

    // 2. Check Storage (Cloudflare R2)
    let storageStatus = "Not Configured";
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      try {
        const isHealthy = await checkR2Health();
        storageStatus = isHealthy ? "Connected" : "Configuration Error";
      } catch (e) {
        console.error("Cloudflare R2 verification failed:", e);
        storageStatus = "Configuration Error";
      }
    }

    return NextResponse.json({
      success: true,
      dbStatus,
      storageStatus,
      blobStatus: storageStatus, // For backward compatibility
      env: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("System status API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch status" }, { status: 500 });
  }
}
