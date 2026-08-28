import { NextRequest, NextResponse } from "next/server";
import { getServiceCards } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  const cards = await getServiceCards(category);
  return NextResponse.json(cards);
}