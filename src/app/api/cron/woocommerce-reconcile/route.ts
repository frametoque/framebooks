import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { runReconciliationCron } from "@/lib/woocommerce/reconciliation";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    console.error("[WooCommerce Reconcile Cron] CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Server misconfiguration: CRON_SECRET is required." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Unauthorized. Bearer token required in Authorization header." },
      { status: 401 }
    );
  }

  const providedToken = authHeader.slice(7).trim();
  const expectedBuffer = Buffer.from(cronSecret);
  const providedBuffer = Buffer.from(providedToken);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return NextResponse.json({ error: "Unauthorized. Invalid token." }, { status: 401 });
  }

  try {
    const result = await runReconciliationCron();
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    console.error("[WooCommerce Reconcile Cron Error]", err);
    return NextResponse.json(
      { error: err.message || "Reconciliation failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
