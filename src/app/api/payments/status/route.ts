import { NextResponse } from "next/server";
import { getGatewayStatus } from "@/lib/payment-gateway";

export async function GET() {
  const status = getGatewayStatus();
  return NextResponse.json(status);
}

