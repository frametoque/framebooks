import { NextRequest, NextResponse } from "next/server";
import { getServiceBySlugAndCategory } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const service  = searchParams.get("service");

  if (!category || !service) {
    return NextResponse.json({ error: "category and service are required" }, { status: 400 });
  }

  const row = await getServiceBySlugAndCategory(service, category);

  if (!row) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(row);
}