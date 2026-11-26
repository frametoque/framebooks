import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { ensureWooCommerceSchema } from "@/lib/woocommerce/db-init";
import { verifyWooWebhookSignature } from "@/lib/woocommerce/encryption";
import {
  processWooOrderWebhook,
  processWooProductWebhook,
} from "@/lib/woocommerce/webhook-processor";
import { logSyncEvent } from "@/lib/woocommerce/push-service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId: rawTenantId } = await context.params;
  const tenantId = parseInt(rawTenantId, 10);

  if (isNaN(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: "Invalid tenant ID." }, { status: 400 });
  }

  await ensureWooCommerceSchema();

  // 1. Fetch connection details and webhook secret for this tenant
  const connRows = await sql`
    SELECT store_url, webhook_secret, status
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (connRows.length === 0 || connRows[0].status !== "connected") {
    return NextResponse.json(
      { error: "WooCommerce integration not connected for this tenant." },
      { status: 404 }
    );
  }

  const { webhook_secret: webhookSecret } = connRows[0];

  // 2. Read headers
  const topic = request.headers.get("x-wc-webhook-topic") || "";
  const signature = request.headers.get("x-wc-webhook-signature") || "";
  const deliveryId = request.headers.get("x-wc-webhook-id") || "";

  // 3. Read raw payload for HMAC verification
  const rawPayload = await request.text();

  if (!rawPayload) {
    return NextResponse.json({ error: "Empty webhook payload." }, { status: 400 });
  }

  // 4. Verify HMAC-SHA256 signature
  const isSignatureValid = verifyWooWebhookSignature(rawPayload, signature, webhookSecret);
  if (!isSignatureValid) {
    await logSyncEvent(tenantId, {
      direction: "woo_to_framebooks",
      entityType: "webhook_security",
      status: "error",
      errorMessage: `HMAC signature verification failed for topic "${topic}".`,
    });
    return NextResponse.json({ error: "Invalid HMAC signature." }, { status: 401 });
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload." }, { status: 400 });
  }

  // 5. Handle WooCommerce webhook ping / test delivery
  if (topic === "action.woocommerce_webhook_ping" || payload.webhook_id) {
    return NextResponse.json({ status: "ok", ping: true, deliveryId });
  }

  try {
    // 6. Route by topic
    if (topic.startsWith("order.")) {
      const orderRes = await processWooOrderWebhook(tenantId, payload, topic);
      return NextResponse.json({
        status: "ok",
        topic,
        duplicate: orderRes.duplicate || false,
        modifiedItems: orderRes.modifiedItems,
      });
    }

    if (topic.startsWith("product.")) {
      const productRes = await processWooProductWebhook(tenantId, payload, topic);
      return NextResponse.json({
        status: "ok",
        topic,
        updated: productRes.updated,
        message: productRes.message,
      });
    }

    // Unhandled topic
    return NextResponse.json({ status: "ok", ignoredTopic: topic });
  } catch (err: any) {
    console.error(`[WooCommerce Webhook Processing Error] Tenant ${tenantId}, Topic ${topic}:`, err);

    await logSyncEvent(tenantId, {
      direction: "woo_to_framebooks",
      entityType: topic || "unknown",
      status: "error",
      errorMessage: err.message || "Webhook processing error.",
    });

    return NextResponse.json(
      { error: "Webhook processing encountered an internal error." },
      { status: 500 }
    );
  }
}
