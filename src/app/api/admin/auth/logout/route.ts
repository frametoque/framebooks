// src/app/api/admin/auth/logout/route.ts
import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/app/(dashboard)/admin/_lib/session";

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ success: true });
}
