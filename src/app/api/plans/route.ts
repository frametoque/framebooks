import { NextResponse } from "next/server";
import { getLandingPlansFormatted } from "@/lib/plans-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await getLandingPlansFormatted();
    return NextResponse.json(plans);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch plans" }, { status: 500 });
  }
}
