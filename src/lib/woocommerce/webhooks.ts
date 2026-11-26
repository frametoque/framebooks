import sql from "@/lib/db";
import { executeWooRequest } from "./client";
import { decryptWooCredential } from "./encryption";
import { ensureWooCommerceSchema } from "./db-init";

export interface WebhookRegistrationResult {
  topic: string;
  success: boolean;
  webhookId?: number;
  deliveryUrl: string;
  error?: string;
}

export const WOO_CORE_TOPICS = [
  "order.created",
  "order.updated",
  "product.created",
  "product.updated",
  "product.deleted",
];

/**
 * Resolves the public delivery URL for this tenant's webhook handler.
 */
export function getWebhookDeliveryUrl(tenantId: number): string {
  let baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "https://framebooks.com";

  // If NEXTAUTH_URL is localhost but NEXT_PUBLIC_APP_URL has a public domain, prefer the public domain
  if (baseUrl.includes("localhost") && process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes("localhost")) {
    baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  }
  return `${baseUrl.replace(/\/+$/, "")}/api/integrations/woocommerce/webhook/${tenantId}`;
}

/**
 * Registers WooCommerce webhooks automatically via REST API.
 */
export async function registerWooWebhooks(
  tenantId: number,
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
  webhookSecret: string
): Promise<{ success: boolean; results: WebhookRegistrationResult[] }> {
  await ensureWooCommerceSchema();
  const deliveryUrl = getWebhookDeliveryUrl(tenantId);

  const promises = WOO_CORE_TOPICS.map(async (topic): Promise<WebhookRegistrationResult> => {
    try {
      const createRes = await executeWooRequest<{ id: number; status: string }>(
        storeUrl,
        consumerKey,
        consumerSecret,
        "/webhooks",
        {
          method: "POST",
          timeoutMs: 8000,
          body: {
            name: `Framebooks POS Sync: ${topic}`,
            topic,
            delivery_url: deliveryUrl,
            secret: webhookSecret,
            status: "active",
          },
        }
      );

      if (createRes.success && createRes.data?.id) {
        const webhookId = createRes.data.id;
        await sql`
          INSERT INTO woocommerce_registered_webhooks (
            tenant_id, topic, woo_webhook_id, delivery_url, status, updated_at
          ) VALUES (
            ${tenantId}, ${topic}, ${webhookId}, ${deliveryUrl}, 'active', NOW()
          )
          ON CONFLICT (tenant_id, topic) DO UPDATE SET
            woo_webhook_id = EXCLUDED.woo_webhook_id,
            delivery_url = EXCLUDED.delivery_url,
            status = 'active',
            updated_at = NOW()
        `.catch(() => {});

        return {
          topic,
          success: true,
          webhookId,
          deliveryUrl,
        };
      } else {
        return {
          topic,
          success: false,
          deliveryUrl,
          error: createRes.error || "Failed to register webhook in WooCommerce.",
        };
      }
    } catch (err: any) {
      return {
        topic,
        success: false,
        deliveryUrl,
        error: err.message || "Failed to call WooCommerce webhooks API.",
      };
    }
  });

  const settled = await Promise.allSettled(promises);
  const results: WebhookRegistrationResult[] = settled.map((s, idx) => {
    if (s.status === "fulfilled") return s.value;
    return {
      topic: WOO_CORE_TOPICS[idx],
      success: false,
      deliveryUrl,
      error: s.reason?.message || "Registration failed",
    };
  });

  const allSuccess = results.every((r) => r.success);
  return { success: allSuccess, results };
}

/**
 * Removes registered webhooks from WooCommerce when tenant disconnects.
 */
export async function unregisterWooWebhooks(tenantId: number): Promise<void> {
  await ensureWooCommerceSchema();

  const connRows = await sql`
    SELECT store_url, encrypted_key, encrypted_secret
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (connRows.length === 0) return;
  const conn = connRows[0];
  let key = "";
  let secret = "";

  try {
    key = decryptWooCredential(conn.encrypted_key, tenantId);
    secret = decryptWooCredential(conn.encrypted_secret, tenantId);
  } catch {
    return;
  }

  const existingWebhooks = await sql`
    SELECT woo_webhook_id, topic
    FROM woocommerce_registered_webhooks
    WHERE tenant_id = ${tenantId} AND woo_webhook_id IS NOT NULL
  `;

  for (const wh of existingWebhooks) {
    if (wh.woo_webhook_id) {
      await executeWooRequest(
        conn.store_url,
        key,
        secret,
        `/webhooks/${wh.woo_webhook_id}?force=true`,
        { method: "DELETE" }
      ).catch(() => {});
    }
  }

  await sql`DELETE FROM woocommerce_registered_webhooks WHERE tenant_id = ${tenantId}`;
}
