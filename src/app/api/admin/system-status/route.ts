import { NextResponse } from "next/server";
import {  auth, clerkClient  } from '@/lib/auth';
import sql from "@/lib/db";
import { list } from "@vercel/blob";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const isAdmin = user?.publicMetadata?.role === "admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Check DB
    let dbStatus = "Disconnected";
    try {
      await sql`SELECT 1`;
      dbStatus = "Connected";
    } catch (e) {
      console.error("DB check failed:", e);
    }

    // 2. Check Vercel Blob
    let blobStatus = "Not Configured";
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await list({ limit: 1 });
        blobStatus = "Connected";
      } catch (e) {
        console.error("Vercel Blob verification failed:", e);
        blobStatus = "Configuration Error";
      }
    }

    return NextResponse.json({
      success: true,
      dbStatus,
      blobStatus,
      env: process.env.NODE_ENV || "development",
    });
  } catch (error) {
    console.error("System status API error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch status" }, { status: 500 });
  }
}
