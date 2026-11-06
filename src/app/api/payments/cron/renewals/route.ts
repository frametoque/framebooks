import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { processDueSubscriptionRenewals } from "@/lib/payment-gateway";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleRenewalCron(req);
}

export async function POST(req: NextRequest) {
  return handleRenewalCron(req);
}

async function handleRenewalCron(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) {
      console.error("[Renewal Cron Error] CRON_SECRET is not configured.");
      return NextResponse.json(
        { error: "Server misconfiguration: CRON_SECRET is required to trigger renewals." },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get("authorization");
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

    const summary = await processDueSubscriptionRenewals();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (err: any) {
    console.error("[Renewal Cron Error]", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process recurring renewals." },
      { status: 500 }
    );
  }
}

