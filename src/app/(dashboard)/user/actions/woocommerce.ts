"use server";

import sql from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserContext, requirePermission } from "./rbac";
import { requirePosAddon } from "@/lib/pos/entitlement";
import { ensureWooCommerceSchema } from "@/lib/woocommerce/db-init";
import {
  encryptWooCredential,
  decryptWooCredential,
  generateTenantWebhookSecret,
  maskWooKey,
} from "@/lib/woocommerce/encryption";
import {
  testWooConnection,
  normalizeStoreUrl,
  executeWooRequest,
  WooConnectionTestResult,
} from "@/lib/woocommerce/client";
import {
  extractWooLkrPrice,
  computeProductContentHash,
} from "@/lib/woocommerce/mapping-service";
import {
  registerWooWebhooks,
  unregisterWooWebhooks,
  getWebhookDeliveryUrl,
  WOO_CORE_TOPICS,
} from "@/lib/woocommerce/webhooks";
import { logSystemAction } from "@/lib/logger";

export interface WooHealthReport {
  success: boolean;
  connected: boolean;
  keysValid: boolean;
  restReachable: boolean;
  latencyMs?: number;
  manageStockEnabled?: boolean;
  webhooksCount: number;
  webhooksTotal: number;
  activeWebhooks: string[];
  lastSyncAt: string | null;
  error?: string;
}

export interface WooSyncSettings {
  conflict_winner: "framebooks_wins" | "woo_wins" | "newest_wins";
  sync_price: boolean;
  sync_title: boolean;
  auto_import_products: boolean;
  post_online_orders: boolean;
}

export interface WooConnectionDetails {
  connected: boolean;
  storeUrl?: string;
  maskedConsumerKey?: string;
  maskedConsumerSecret?: string;
  status: "connected" | "disconnected" | "error";
  lastSyncAt?: string | null;
  syncSettings: WooSyncSettings;
  webhookSecret?: string;
  webhookDeliveryUrl: string;
  registeredWebhooks: Array<{
    topic: string;
    status: string;
    wooWebhookId?: number;
  }>;
  mappedProductCount: number;
}

const DEFAULT_SYNC_SETTINGS: WooSyncSettings = {
  conflict_winner: "newest_wins",
  sync_price: false,
  sync_title: false,
  auto_import_products: false,
  post_online_orders: false,
};

/**
 * Validates permission and POS add-on entitlement for WooCommerce operations.
 */
async function authorizeWooCommerceAccess(requireOwner = false) {
  const context = await getUserContext();
  if (!context.tenantId || !context.userId) {
    return { error: "Authentication required.", context: null };
  }

  // POS Add-on entitlement guard
  const addonCheck = await requirePosAddon(context.tenantId);
  if (addonCheck.error) {
    return { error: addonCheck.error, context: null };
  }

  const role = (context.role || "").toLowerCase().trim();

  // If owner-only access is required (e.g. settings & credentials)
  if (requireOwner && role !== "owner") {
    return { error: "Access restricted: Only the workspace owner can manage WooCommerce integrations.", context: null };
  }

  // RBAC guard: Owners, Super Admins, and Admins can manage integrations
  const { error: rbacError } = await requirePermission("settings", "manage");
  if (rbacError && role !== "owner") {
    return { error: rbacError, context: null };
  }

  return { error: null, context };
}

/**
 * Fetches current WooCommerce connection details and masked credentials.
 * Secrets are NEVER returned to the client.
 */
export async function getWooConnectionAction(): Promise<{
  success: boolean;
  connection?: WooConnectionDetails;
  error?: string;
}> {
  try {
    const auth = await authorizeWooCommerceAccess(true);
    if (auth.error || !auth.context) {
      return { success: false, error: auth.error };
    }

    const tenantId = Number(auth.context.tenantId);
    await ensureWooCommerceSchema();

    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, webhook_secret, status,
             last_sync_at, sync_settings
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;

    const deliveryUrl = getWebhookDeliveryUrl(tenantId);

    const mappingCountRows = await sql`
      SELECT COUNT(*) as count FROM woocommerce_product_mappings
      WHERE tenant_id = ${tenantId}
    `;
    const mappedProductCount = parseInt(mappingCountRows[0]?.count || "0", 10);

    const webhookRows = await sql`
      SELECT topic, status, woo_webhook_id
      FROM woocommerce_registered_webhooks
      WHERE tenant_id = ${tenantId}
    `;

    if (connRows.length === 0 || connRows[0].status === "disconnected") {
      return {
        success: true,
        connection: {
          connected: false,
          status: "disconnected",
          syncSettings: DEFAULT_SYNC_SETTINGS,
          webhookDeliveryUrl: deliveryUrl,
          registeredWebhooks: [],
          mappedProductCount,
        },
      };
    }

    const c = connRows[0];
    let maskedKey = "";
    let maskedSecret = "";

    try {
      const decKey = decryptWooCredential(c.encrypted_key, tenantId);
      const decSec = decryptWooCredential(c.encrypted_secret, tenantId);
      maskedKey = maskWooKey(decKey);
      maskedSecret = maskWooKey(decSec);
    } catch {
      maskedKey = "••••••••";
      maskedSecret = "••••••••";
    }

    const syncSettings: WooSyncSettings = {
      ...DEFAULT_SYNC_SETTINGS,
      ...(typeof c.sync_settings === "string" ? JSON.parse(c.sync_settings) : c.sync_settings),
    };

    return {
      success: true,
      connection: {
        connected: c.status === "connected",
        storeUrl: c.store_url,
        maskedConsumerKey: maskedKey,
        maskedConsumerSecret: maskedSecret,
        status: c.status,
        lastSyncAt: c.last_sync_at ? new Date(c.last_sync_at).toISOString() : null,
        syncSettings,
        webhookSecret: c.webhook_secret,
        webhookDeliveryUrl: deliveryUrl,
        registeredWebhooks: webhookRows.map((w: any) => ({
          topic: w.topic,
          status: w.status,
          wooWebhookId: w.woo_webhook_id ? Number(w.woo_webhook_id) : undefined,
        })),
        mappedProductCount,
      },
    };
  } catch (err: any) {
    console.error("[getWooConnectionAction Error]", err);
    return { success: false, error: err.message || "Failed to load WooCommerce connection." };
  }
}

/**
 * Tests connection to WooCommerce using supplied or existing credentials.
 */
export async function testWooConnectionAction(data: {
  store_url?: string;
  consumer_key?: string;
  consumer_secret?: string;
}): Promise<WooConnectionTestResult> {
  const auth = await authorizeWooCommerceAccess(true);
  if (auth.error || !auth.context) {
    return { success: false, isHttps: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  let targetUrl = data.store_url?.trim() || "";
  let targetKey = data.consumer_key?.trim() || "";
  let targetSecret = data.consumer_secret?.trim() || "";

  // If credentials are omitted, use saved encrypted credentials for testing
  if (!targetKey || !targetSecret || !targetUrl) {
    const existing = await sql`
      SELECT store_url, encrypted_key, encrypted_secret
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;
    if (existing.length === 0) {
      return {
        success: false,
        isHttps: false,
        error: "Please enter Store URL, Consumer Key, and Consumer Secret to test connection.",
      };
    }
    targetUrl = targetUrl || existing[0].store_url;
    try {
      targetKey = targetKey || decryptWooCredential(existing[0].encrypted_key, tenantId);
      targetSecret = targetSecret || decryptWooCredential(existing[0].encrypted_secret, tenantId);
    } catch {
      return { success: false, isHttps: false, error: "Failed to decrypt stored credentials." };
    }
  }

  // Format validations
  const norm = normalizeStoreUrl(targetUrl);
  if (!norm.valid) {
    return { success: false, isHttps: false, error: norm.error, errorCode: "INVALID_URL" };
  }

  if (!targetKey.startsWith("ck_")) {
    return {
      success: false,
      isHttps: norm.normalized.startsWith("https://"),
      error: "Invalid Consumer Key format. Key must start with 'ck_'.",
      errorCode: "AUTH_FAILED",
    };
  }

  if (!targetSecret.startsWith("cs_")) {
    return {
      success: false,
      isHttps: norm.normalized.startsWith("https://"),
      error: "Invalid Consumer Secret format. Secret must start with 'cs_'.",
      errorCode: "AUTH_FAILED",
    };
  }

  return await testWooConnection(norm.normalized, targetKey, targetSecret);
}

/**
 * Saves or updates encrypted WooCommerce credentials and registers webhooks.
 */
export async function saveWooConnectionAction(data: {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_settings?: Partial<WooSyncSettings>;
}) {
  const auth = await authorizeWooCommerceAccess(true);
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  const userId = Number(auth.context.userId);
  await ensureWooCommerceSchema();

  const norm = normalizeStoreUrl(data.store_url);
  if (!norm.valid) {
    return { success: false, error: norm.error };
  }

  const cleanKey = data.consumer_key.trim();
  const cleanSecret = data.consumer_secret.trim();

  if (!cleanKey.startsWith("ck_")) {
    return { success: false, error: "Consumer Key must begin with 'ck_'." };
  }

  if (!cleanSecret.startsWith("cs_")) {
    return { success: false, error: "Consumer Secret must begin with 'cs_'." };
  }

  // 1. Live test connection before saving to database
  const testRes = await testWooConnection(norm.normalized, cleanKey, cleanSecret);
  if (!testRes.success) {
    return {
      success: false,
      error: testRes.error || "Connection test failed. Please verify store URL and API credentials.",
      errorCode: testRes.errorCode,
    };
  }

  // 2. Encrypt credentials per tenant
  const encryptedKey = encryptWooCredential(cleanKey, tenantId);
  const encryptedSecret = encryptWooCredential(cleanSecret, tenantId);

  // Generate or preserve webhook secret
  const existingConn = await sql`
    SELECT webhook_secret, sync_settings FROM woocommerce_connections WHERE tenant_id = ${tenantId} LIMIT 1
  `;
  const webhookSecret = existingConn[0]?.webhook_secret || generateTenantWebhookSecret();

  const finalSettings = {
    ...DEFAULT_SYNC_SETTINGS,
    ...(existingConn[0]?.sync_settings || {}),
    ...(data.sync_settings || {}),
  };

  try {
    await sql`
      INSERT INTO woocommerce_connections (
        tenant_id, store_url, encrypted_key, encrypted_secret, key_version,
        webhook_secret, status, created_by, sync_settings, updated_at
      ) VALUES (
        ${tenantId}, ${norm.normalized}, ${encryptedKey}, ${encryptedSecret}, 'v1',
        ${webhookSecret}, 'connected', ${userId}, ${JSON.stringify(finalSettings)}::jsonb, NOW()
      )
      ON CONFLICT (tenant_id) DO UPDATE SET
        store_url = EXCLUDED.store_url,
        encrypted_key = EXCLUDED.encrypted_key,
        encrypted_secret = EXCLUDED.encrypted_secret,
        key_version = 'v1',
        webhook_secret = EXCLUDED.webhook_secret,
        status = 'connected',
        sync_settings = EXCLUDED.sync_settings,
        updated_at = NOW()
    `;

    // 3. Register WooCommerce Webhooks automatically
    const whResult = await registerWooWebhooks(
      tenantId,
      norm.normalized,
      cleanKey,
      cleanSecret,
      webhookSecret
    );

    await logSystemAction(
      `Connected WooCommerce store: ${norm.normalized} (Webhooks registered: ${whResult.results.filter((r) => r.success).length}/${WOO_CORE_TOPICS.length})`
    );

    revalidatePath("/settings");
    revalidatePath("/settings/integrations");

    return {
      success: true,
      storeName: testRes.storeName,
      webhooksRegistered: whResult.results,
    };
  } catch (err: any) {
    console.error("[saveWooConnectionAction Error]", err);
    return { success: false, error: err.message || "Failed to save WooCommerce connection." };
  }
}

/**
 * Updates sync settings (conflict resolution, price sync, auto-import).
 */
export async function updateWooSyncSettingsAction(settings: Partial<WooSyncSettings>) {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    const existing = await sql`
      SELECT sync_settings FROM woocommerce_connections WHERE tenant_id = ${tenantId} LIMIT 1
    `;
    if (existing.length === 0) {
      return { success: false, error: "WooCommerce is not connected." };
    }

    const merged = {
      ...DEFAULT_SYNC_SETTINGS,
      ...(existing[0].sync_settings || {}),
      ...settings,
    };

    await sql`
      UPDATE woocommerce_connections
      SET sync_settings = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    revalidatePath("/settings/integrations");
    return { success: true, settings: merged };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update sync settings." };
  }
}

/**
 * Disconnects the WooCommerce integration.
 * Deletes API keys and registered webhooks, preserving product mappings and sync history.
 */
export async function disconnectWooAction() {
  const auth = await authorizeWooCommerceAccess(true);
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    // Unregister webhooks from WooCommerce before clearing keys
    await unregisterWooWebhooks(tenantId).catch(() => {});

    await sql`
      UPDATE woocommerce_connections
      SET status = 'disconnected',
          encrypted_key = '',
          encrypted_secret = '',
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    await logSystemAction(`Disconnected WooCommerce store integration`);

    revalidatePath("/settings");
    revalidatePath("/settings/integrations");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disconnect WooCommerce store." };
  }
}

/**
 * Executes a comprehensive live health check of the WooCommerce connection.
 */
export async function checkWooConnectionHealthAction(): Promise<WooHealthReport> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return {
      success: false,
      connected: false,
      keysValid: false,
      restReachable: false,
      webhooksCount: 0,
      webhooksTotal: WOO_CORE_TOPICS.length,
      activeWebhooks: [],
      lastSyncAt: null,
      error: auth.error,
    };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, status, last_sync_at, webhook_secret
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (connRows.length === 0 || connRows[0].status === "disconnected") {
      return {
        success: true,
        connected: false,
        keysValid: false,
        restReachable: false,
        webhooksCount: 0,
        webhooksTotal: WOO_CORE_TOPICS.length,
        activeWebhooks: [],
        lastSyncAt: null,
      };
    }

    const c = connRows[0];
    let key = "";
    let secret = "";

    try {
      key = decryptWooCredential(c.encrypted_key, tenantId);
      secret = decryptWooCredential(c.encrypted_secret, tenantId);
    } catch {
      return {
        success: false,
        connected: true,
        keysValid: false,
        restReachable: false,
        webhooksCount: 0,
        webhooksTotal: WOO_CORE_TOPICS.length,
        activeWebhooks: [],
        lastSyncAt: c.last_sync_at ? new Date(c.last_sync_at).toISOString() : null,
        error: "Failed to decrypt stored credentials.",
      };
    }

    const startTime = Date.now();
    const testRes = await testWooConnection(c.store_url, key, secret);
    const latencyMs = Date.now() - startTime;

    const webhookRows = await sql`
      SELECT topic, status
      FROM woocommerce_registered_webhooks
      WHERE tenant_id = ${tenantId} AND status = 'active'
    `;

    const activeTopics = webhookRows.map((w: any) => String(w.topic));

    return {
      success: testRes.success,
      connected: true,
      keysValid: testRes.success,
      restReachable: testRes.success,
      latencyMs,
      manageStockEnabled: testRes.manageStockEnabled,
      webhooksCount: activeTopics.length,
      webhooksTotal: WOO_CORE_TOPICS.length,
      activeWebhooks: activeTopics,
      lastSyncAt: c.last_sync_at ? new Date(c.last_sync_at).toISOString() : null,
      error: testRes.error,
    };
  } catch (err: any) {
    return {
      success: false,
      connected: true,
      keysValid: false,
      restReachable: false,
      webhooksCount: 0,
      webhooksTotal: WOO_CORE_TOPICS.length,
      activeWebhooks: [],
      lastSyncAt: null,
      error: err.message || "Health check failed.",
    };
  }
}

/**
 * Re-registers webhooks in WooCommerce for connected tenant.
 */
export async function reRegisterWebhooksAction() {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, webhook_secret
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return { success: false, error: "WooCommerce store is not currently connected." };
    }

    const c = connRows[0];
    const key = decryptWooCredential(c.encrypted_key, tenantId);
    const secret = decryptWooCredential(c.encrypted_secret, tenantId);

    const whResult = await registerWooWebhooks(
      tenantId,
      c.store_url,
      key,
      secret,
      c.webhook_secret
    );

    revalidatePath("/settings/integrations");
    return { success: whResult.success, results: whResult.results };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to re-register webhooks." };
  }
}

/**
 * Manually pushes all mapped inventory from Framebooks to WooCommerce ("Sync now").
 */
export async function pushAllMappedInventoryAction() {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, syncedCount: 0, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  try {
    const { pushAllMappedInventory } = await import("@/lib/woocommerce/push-service");
    const res = await pushAllMappedInventory(tenantId);
    revalidatePath("/settings/integrations");
    return res;
  } catch (err: any) {
    return { success: false, syncedCount: 0, error: err.message || "Sync failed." };
  }
}

/**
 * Fetches recent sync logs for tenant.
 */
export async function getSyncLogsAction(options?: { limit?: number; offset?: number; status?: string }) {
  try {
    const auth = await authorizeWooCommerceAccess();
    if (auth.error || !auth.context) {
      return { success: false, logs: [], total: 0, error: auth.error };
    }

    const tenantId = Number(auth.context.tenantId);
    const { getSyncLogs } = await import("@/lib/woocommerce/push-service");
    const res = await getSyncLogs(tenantId, options);
    return { success: true, ...res };
  } catch (err: any) {
    return { success: false, logs: [], total: 0, error: err.message };
  }
}

/**
 * Updates WooCommerce synchronization settings (conflict winner, price sync, etc.).
 */
export async function updateSyncSettingsAction(settings: Partial<WooSyncSettings>) {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT sync_settings FROM woocommerce_connections
      WHERE tenant_id = ${tenantId}
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return { success: false, error: "WooCommerce not connected." };
    }

    const current = connRows[0].sync_settings || {};
    const updated = { ...current, ...settings };

    await sql`
      UPDATE woocommerce_connections
      SET sync_settings = ${JSON.stringify(updated)},
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    revalidatePath("/settings/integrations");
    return { success: true, settings: updated };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update sync settings." };
  }
}

/**
 * Retries pending/failed sync jobs for tenant.
 */
export async function retrySyncJobAction(): Promise<{
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  error?: string;
}> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, processed: 0, succeeded: 0, failed: 0, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  try {
    const { processPendingSyncJobs } = await import("@/lib/woocommerce/push-service");
    const res = await processPendingSyncJobs(tenantId, 10);
    revalidatePath("/settings/integrations");
    return { success: true, ...res };
  } catch (err: any) {
    return { success: false, processed: 0, succeeded: 0, failed: 0, error: err.message || "Failed to retry jobs." };
  }
}

/**
 * Manually executes a full catalog drift reconciliation for this tenant.
 */
export async function reconcileNowAction(): Promise<{
  success: boolean;
  driftsFound: number;
  driftsFixed: number;
  missedOrdersProcessed: number;
  details?: string;
  error?: string;
}> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, driftsFound: 0, driftsFixed: 0, missedOrdersProcessed: 0, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  try {
    const { reconcileTenantCatalog } = await import("@/lib/woocommerce/reconciliation");
    const res = await reconcileTenantCatalog(tenantId);
    revalidatePath("/settings/integrations");
    return res;
  } catch (err: any) {
    return {
      success: false,
      driftsFound: 0,
      driftsFixed: 0,
      missedOrdersProcessed: 0,
      error: err.message || "Reconciliation failed.",
    };
  }
}

/**
 * Fetches all products and variations from WooCommerce, imports or updates them in FrameBooks,
 * and sets up real-time stock sync mappings.
 */
export async function syncAllWooProductsAction(): Promise<{
  success: boolean;
  total?: number;
  imported?: number;
  updated?: number;
  error?: string;
}> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  const userId = Number(auth.context.userId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, status
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return { success: false, error: "WooCommerce store is not connected. Please connect first." };
    }

    const c = connRows[0];
    const key = decryptWooCredential(c.encrypted_key, tenantId);
    const secret = decryptWooCredential(c.encrypted_secret, tenantId);

    const { fetchAllWooProducts } = await import("./woocommerce-mapping");
    const { computeProductContentHash } = await import("@/lib/woocommerce/mapping-service");

    // 1. Fetch all products from WooCommerce
    const wooProducts = await fetchAllWooProducts(c.store_url, key, secret);
    if (wooProducts.length === 0) {
      return { success: true, total: 0, imported: 0, updated: 0 };
    }

    // 2. Fetch existing mappings and existing FrameBooks products
    const existingMappings = await sql`
      SELECT id, inventory_id, woo_product_id, woo_variation_id, woo_sku
      FROM woocommerce_product_mappings
      WHERE tenant_id = ${tenantId}
    `;
    const mappingByWooId = new Map<string, any>();
    for (const m of existingMappings) {
      mappingByWooId.set(`${m.woo_product_id}_${m.woo_variation_id || 0}`, m);
    }

    const existingFbItems = await sql`
      SELECT id, item_name, sku, quantity, selling_price
      FROM admin_inventory
      WHERE (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
    `;
    const fbBySku = new Map<string, any>();
    const fbById = new Map<number, any>();
    for (const fb of existingFbItems) {
      fbById.set(Number(fb.id), fb);
      if (fb.sku && fb.sku.trim()) {
        fbBySku.set(fb.sku.trim().toLowerCase(), fb);
      }
    }

    let imported = 0;
    let updated = 0;

    for (const w of wooProducts) {
      const wooKey = `${w.wooProductId}_${w.wooVariationId || 0}`;
      const existingMapping = mappingByWooId.get(wooKey);
      const cleanSku = (w.sku || "").trim().toUpperCase() || `SKU-WOO-${w.wooProductId}${w.wooVariationId ? `-${w.wooVariationId}` : ""}`;
      const stock = Math.max(0, w.stockQuantity || 0);
      const price = w.price || 0;
      const name = w.name || `Product #${w.wooProductId}`;
      const category = w.category || "General";

      let targetInventoryId: number | null = null;

      if (existingMapping) {
        // Already mapped: update existing inventory item
        targetInventoryId = Number(existingMapping.inventory_id);

        await sql`
          UPDATE admin_inventory SET
            item_name = ${name},
            sku = ${cleanSku},
            category = ${category},
            selling_price = ${price},
            quantity = ${stock},
            status = ${stock > 0 ? 'Available' : 'Out of Stock'},
            updated_at = NOW()
          WHERE id = ${targetInventoryId} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
        `;

        const hash = computeProductContentHash({
          sku: cleanSku,
          name,
          price,
          stock,
        });

        await sql`
          UPDATE woocommerce_product_mappings SET
            woo_sku = ${cleanSku},
            last_synced_stock = ${stock},
            content_hash = ${hash},
            sync_status = 'synced',
            last_synced_at = NOW(),
            updated_at = NOW()
          WHERE id = ${existingMapping.id}
        `;

        updated++;
      } else {
        // Not mapped yet. Check if a FrameBooks item exists with the exact same SKU
        const matchedFbBySku = cleanSku ? fbBySku.get(cleanSku.toLowerCase()) : null;

        if (matchedFbBySku) {
          // Link with existing FrameBooks item and update with WooCommerce data
          targetInventoryId = Number(matchedFbBySku.id);

          await sql`
            UPDATE admin_inventory SET
              item_name = ${name},
              category = ${category},
              selling_price = ${price},
              quantity = ${stock},
              status = ${stock > 0 ? 'Available' : 'Out of Stock'},
              updated_at = NOW()
            WHERE id = ${targetInventoryId} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
          `;

          const hash = computeProductContentHash({
            sku: cleanSku,
            name,
            price,
            stock,
          });

          await sql`
            INSERT INTO woocommerce_product_mappings (
              tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
              last_synced_stock, content_hash, sync_status, last_synced_at, updated_at
            ) VALUES (
              ${tenantId}, ${targetInventoryId}, ${w.wooProductId}, ${w.wooVariationId || 0}, ${cleanSku},
              ${stock}, ${hash}, 'synced', NOW(), NOW()
            )
            ON CONFLICT (tenant_id, inventory_id) DO UPDATE SET
              woo_product_id = EXCLUDED.woo_product_id,
              woo_variation_id = EXCLUDED.woo_variation_id,
              woo_sku = EXCLUDED.woo_sku,
              last_synced_stock = EXCLUDED.last_synced_stock,
              content_hash = EXCLUDED.content_hash,
              sync_status = 'synced',
              last_synced_at = NOW(),
              updated_at = NOW()
          `;

          updated++;
        } else {
          // New product from WooCommerce: import into FrameBooks
          const insertRes = await sql`
            INSERT INTO admin_inventory (
              tenant_id, item_name, category, sku, selling_price, cost_price,
              quantity, status, created_at, updated_at
            ) VALUES (
              ${tenantId}, ${name}, ${category}, ${cleanSku}, ${price}, 0,
              ${stock}, ${stock > 0 ? 'Available' : 'Out of Stock'}, NOW(), NOW()
            )
            RETURNING id
          `;

          if (insertRes.length > 0) {
            targetInventoryId = Number(insertRes[0].id);

            // Record initial stock movement
            await sql`
              INSERT INTO stock_movements (
                tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, notes, created_at
              ) VALUES (
                ${tenantId}, ${targetInventoryId}, ${stock}, 0, ${stock}, 'received',
                'woocommerce_sync', ${`WOO-SYNC-${w.wooProductId}`}, ${userId}, 'Imported via Sync All Products from WooCommerce', NOW()
              )
            `.catch(() => {});

            const hash = computeProductContentHash({
              sku: cleanSku,
              name,
              price,
              stock,
            });

            await sql`
              INSERT INTO woocommerce_product_mappings (
                tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
                last_synced_stock, content_hash, sync_status, last_synced_at, created_at, updated_at
              ) VALUES (
                ${tenantId}, ${targetInventoryId}, ${w.wooProductId}, ${w.wooVariationId || 0}, ${cleanSku},
                ${stock}, ${hash}, 'synced', NOW(), NOW(), NOW()
              )
            `;

            imported++;
          }
        }
      }
    }

    await sql`
      UPDATE woocommerce_connections
      SET last_sync_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    await logSystemAction(
      `WooCommerce Full Product Sync completed: ${imported} imported, ${updated} updated (${wooProducts.length} total products processed)`
    );

    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/settings/integrations");

    return {
      success: true,
      total: wooProducts.length,
      imported,
      updated,
    };
  } catch (err: any) {
    console.error("[syncAllWooProductsAction Error]", err);
    return { success: false, error: err.message || "Failed to sync all products from WooCommerce." };
  }
}

export interface WooSyncBatchResult {
  success: boolean;
  page: number;
  totalProducts: number;
  totalPages: number;
  batchProcessed: number;
  imported: number;
  updated: number;
  isFinished: boolean;
  error?: string;
  updatedDetails?: Array<{
    name: string;
    sku: string;
    currentStock?: number;
    changes: Array<{
      field: "SKU" | "Stock" | "Price" | "Name" | "Category";
      from: string | number;
      to: string | number;
    }>;
  }>;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
}

/**
 * Progress-enabled batch importer that pulls WooCommerce products page-by-page.
 */
export async function syncWooProductsBatchAction(
  page: number = 1,
  perPage: number = 50
): Promise<WooSyncBatchResult> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return {
      success: false,
      page,
      totalProducts: 0,
      totalPages: 0,
      batchProcessed: 0,
      imported: 0,
      updated: 0,
      isFinished: true,
      error: auth.error,
    };
  }

  const tenantId = Number(auth.context.tenantId);
  const userId = Number(auth.context.userId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, status
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return {
        success: false,
        page,
        totalProducts: 0,
        totalPages: 0,
        batchProcessed: 0,
        imported: 0,
        updated: 0,
        isFinished: true,
        error: "WooCommerce store is not connected.",
      };
    }

    const c = connRows[0];
    const key = decryptWooCredential(c.encrypted_key, tenantId);
    const secret = decryptWooCredential(c.encrypted_secret, tenantId);

    const { computeProductContentHash, extractWooLkrPrice } = await import("@/lib/woocommerce/mapping-service");
    const { executeWooRequest } = await import("@/lib/woocommerce/client");

    // 1. Fetch current page of products from WooCommerce (explicitly requesting LKR currency)
    const res = await executeWooRequest<any[]>(
      c.store_url,
      key,
      secret,
      "/products",
      { params: { per_page: perPage, page, currency: "LKR", "wmc-currency": "LKR" } }
    );

    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
      return {
        success: true,
        page,
        totalProducts: res.total || 0,
        totalPages: res.totalPages || 0,
        batchProcessed: 0,
        imported: 0,
        updated: 0,
        isFinished: true,
      };
    }

    const totalProducts = res.total || res.data.length;
    const totalPages = res.totalPages || Math.ceil(totalProducts / perPage) || 1;

    // Parallel fetch variable products' variations
    const variableProds = res.data.filter((p: any) => p.type === "variable");
    const variationMap = new Map<number, any[]>();
    if (variableProds.length > 0) {
      await Promise.all(
        variableProds.map(async (prod: any) => {
          try {
            const varRes = await executeWooRequest<any[]>(
              c.store_url,
              key,
              secret,
              `/products/${prod.id}/variations`,
              { params: { per_page: 50, currency: "LKR", "wmc-currency": "LKR" }, timeoutMs: 10000 }
            );
            if (varRes.success && Array.isArray(varRes.data) && varRes.data.length > 0) {
              variationMap.set(prod.id, varRes.data);
            }
          } catch {}
        })
      );
    }

    const wooProducts: any[] = [];
    for (const prod of res.data) {
      const categoryName = decodeHtmlEntities(prod.categories?.[0]?.name || "General");
      const cleanProdName = decodeHtmlEntities(prod.name || "");
      if (prod.type === "variable" && variationMap.has(prod.id)) {
        const variations = variationMap.get(prod.id)!;
        for (const v of variations) {
          const varAttributes = v.attributes?.map((a: any) => decodeHtmlEntities(a.option)).join(" / ") || `Var #${v.id}`;
          wooProducts.push({
            wooProductId: prod.id,
            wooVariationId: v.id,
            name: `${cleanProdName} (${varAttributes})`,
            sku: (v.sku || "").trim(),
            category: categoryName,
            price: extractWooLkrPrice(v, prod),
            stockQuantity: v.stock_quantity !== null && v.stock_quantity !== undefined ? parseFloat(v.stock_quantity) : 0,
          });
        }
      } else {
        wooProducts.push({
          wooProductId: prod.id,
          wooVariationId: 0,
          name: cleanProdName,
          sku: (prod.sku || "").trim(),
          category: categoryName,
          price: extractWooLkrPrice(prod),
          stockQuantity: prod.stock_quantity !== null && prod.stock_quantity !== undefined ? parseFloat(prod.stock_quantity) : 0,
        });
      }
    }

    // 2. Fetch existing mappings and existing FrameBooks products with joined inventory in ONE query
    const existingMappings = await sql`
      SELECT m.id, m.inventory_id, m.woo_product_id, m.woo_variation_id, m.woo_sku, m.content_hash, m.last_synced_stock,
             i.item_name, i.sku, i.quantity, i.selling_price, i.category
      FROM woocommerce_product_mappings m
      LEFT JOIN admin_inventory i ON i.id = m.inventory_id
      WHERE m.tenant_id = ${tenantId}
    `;
    const mappingByWooId = new Map<string, any>();
    for (const m of existingMappings) {
      mappingByWooId.set(`${m.woo_product_id}_${m.woo_variation_id || 0}`, m);
    }

    const existingFbItems = await sql`
      SELECT id, item_name, sku, quantity, selling_price, category
      FROM admin_inventory
      WHERE (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
    `;
    const fbBySku = new Map<string, any>();
    for (const fb of existingFbItems) {
      if (fb.sku && fb.sku.trim()) {
        fbBySku.set(fb.sku.trim().toLowerCase(), fb);
      }
    }

    let imported = 0;
    let updated = 0;
    const updatedDetails: Array<{
      name: string;
      sku: string;
      currentStock?: number;
      changes: Array<{
        field: "SKU" | "Stock" | "Price" | "Name" | "Category";
        from: string | number;
        to: string | number;
      }>;
    }> = [];
    const updateTasks: Promise<void>[] = [];

    for (const w of wooProducts) {
      const wooKey = `${w.wooProductId}_${w.wooVariationId || 0}`;
      const existingMapping = mappingByWooId.get(wooKey);
      const cleanSku = (w.sku || "").trim().toUpperCase() || `SKU-WOO-${w.wooProductId}${w.wooVariationId ? `-${w.wooVariationId}` : ""}`;
      const stock = Math.max(0, w.stockQuantity || 0);
      const price = w.price || 0;
      const name = w.name || `Product #${w.wooProductId}`;
      const category = w.category || "General";

      if (existingMapping) {
        // Product is already mapped: check if ANYTHING actually changed
        const currentQty = parseFloat(existingMapping.quantity || "0");
        const currentPrice = parseFloat(existingMapping.selling_price || "0");
        const currentSku = (existingMapping.sku || "").trim();
        const currentName = existingMapping.item_name || "";
        const currentCategory = existingMapping.category || "General";

        const priceChanged = price > 0 && Math.abs(currentPrice - price) > 0.01;
        const stockChanged = Math.abs(currentQty - stock) > 0.01;
        const nameChanged = name !== currentName;
        const skuChanged = Boolean(cleanSku && cleanSku.toLowerCase() !== currentSku.toLowerCase());
        const categoryChanged = category !== currentCategory;

        // SKIP COMPLETELY if already identical (fast in-memory check, no database write)
        if (!priceChanged && !stockChanged && !nameChanged && !skuChanged && !categoryChanged) {
          continue;
        }

        const targetInventoryId = Number(existingMapping.inventory_id);
        updated++;

        const itemChanges: Array<{
          field: "SKU" | "Stock" | "Price" | "Name" | "Category";
          from: string | number;
          to: string | number;
        }> = [];
        if (stockChanged) {
          itemChanges.push({ field: "Stock", from: `${currentQty} pcs`, to: `${stock} pcs` });
        }
        if (priceChanged) {
          itemChanges.push({ field: "Price", from: `LKR ${currentPrice.toLocaleString()}`, to: `LKR ${price.toLocaleString()}` });
        }
        if (skuChanged) {
          itemChanges.push({ field: "SKU", from: currentSku || "None", to: cleanSku });
        }
        if (nameChanged) {
          itemChanges.push({ field: "Name", from: currentName, to: name });
        }
        if (categoryChanged) {
          itemChanges.push({ field: "Category", from: currentCategory, to: category });
        }

        updatedDetails.push({
          name,
          sku: cleanSku || currentSku,
          currentStock: stock,
          changes: itemChanges,
        });

        updateTasks.push(
          (async () => {
            await sql`
              UPDATE admin_inventory SET
                item_name = ${name},
                sku = ${cleanSku || currentSku},
                category = ${category},
                selling_price = ${price > 0 ? price : currentPrice},
                quantity = ${stock},
                status = ${stock > 0 ? 'Available' : 'Out of Stock'},
                updated_at = NOW()
              WHERE id = ${targetInventoryId} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
            `;

            const hash = computeProductContentHash({ sku: cleanSku || currentSku, name, price: price > 0 ? price : currentPrice, stock });
            await sql`
              UPDATE woocommerce_product_mappings SET
                woo_sku = ${cleanSku || currentSku},
                last_synced_stock = ${stock},
                content_hash = ${hash},
                sync_status = 'synced',
                last_synced_at = NOW(),
                updated_at = NOW()
              WHERE id = ${existingMapping.id}
            `;
          })()
        );
      } else {
        const matchedFbBySku = cleanSku ? fbBySku.get(cleanSku.toLowerCase()) : null;
        if (matchedFbBySku) {
          const targetInventoryId = Number(matchedFbBySku.id);
          const currentQty = parseFloat(matchedFbBySku.quantity || "0");
          const currentPrice = parseFloat(matchedFbBySku.selling_price || "0");
          const currentName = matchedFbBySku.item_name || "";
          const currentCategory = matchedFbBySku.category || "General";

          const priceChanged = price > 0 && Math.abs(currentPrice - price) > 0.01;
          const stockChanged = Math.abs(currentQty - stock) > 0.01;
          const nameChanged = name !== currentName;
          const categoryChanged = category !== currentCategory;

          updated++;
          updateTasks.push(
            (async () => {
              if (priceChanged || stockChanged || nameChanged || categoryChanged) {
                await sql`
                  UPDATE admin_inventory SET
                    item_name = ${name},
                    category = ${category},
                    selling_price = ${price > 0 ? price : currentPrice},
                    quantity = ${stock},
                    status = ${stock > 0 ? 'Available' : 'Out of Stock'},
                    updated_at = NOW()
                  WHERE id = ${targetInventoryId} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
                `;
              }

              const hash = computeProductContentHash({ sku: cleanSku, name, price: price > 0 ? price : currentPrice, stock });
              await sql`
                INSERT INTO woocommerce_product_mappings (
                  tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
                  last_synced_stock, content_hash, sync_status, last_synced_at, updated_at
                ) VALUES (
                  ${tenantId}, ${targetInventoryId}, ${w.wooProductId}, ${w.wooVariationId || 0}, ${cleanSku},
                  ${stock}, ${hash}, 'synced', NOW(), NOW()
                )
                ON CONFLICT (tenant_id, inventory_id) DO UPDATE SET
                  woo_product_id = EXCLUDED.woo_product_id,
                  woo_variation_id = EXCLUDED.woo_variation_id,
                  woo_sku = EXCLUDED.woo_sku,
                  last_synced_stock = EXCLUDED.last_synced_stock,
                  content_hash = EXCLUDED.content_hash,
                  sync_status = 'synced',
                  last_synced_at = NOW(),
                  updated_at = NOW()
              `;
            })()
          );
        } else {
          imported++;
          updateTasks.push(
            (async () => {
              const insertRes = await sql`
                INSERT INTO admin_inventory (
                  tenant_id, item_name, category, sku, selling_price, cost_price,
                  quantity, status, created_at, updated_at
                ) VALUES (
                  ${tenantId}, ${name}, ${category}, ${cleanSku}, ${price}, 0,
                  ${stock}, ${stock > 0 ? 'Available' : 'Out of Stock'}, NOW(), NOW()
                )
                RETURNING id
              `;

              if (insertRes.length > 0) {
                const targetInventoryId = Number(insertRes[0].id);
                await sql`
                  INSERT INTO stock_movements (
                    tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, notes, created_at
                  ) VALUES (
                    ${tenantId}, ${targetInventoryId}, ${stock}, 0, ${stock}, 'received',
                    'woocommerce_sync', ${`WOO-SYNC-${w.wooProductId}`}, ${userId}, 'Imported via Sync All Products from WooCommerce', NOW()
                  )
                `.catch(() => {});

                const hash = computeProductContentHash({ sku: cleanSku, name, price, stock });
                await sql`
                  INSERT INTO woocommerce_product_mappings (
                    tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
                    last_synced_stock, content_hash, sync_status, last_synced_at, created_at, updated_at
                  ) VALUES (
                    ${tenantId}, ${targetInventoryId}, ${w.wooProductId}, ${w.wooVariationId || 0}, ${cleanSku},
                    ${stock}, ${hash}, 'synced', NOW(), NOW(), NOW()
                  )
                `.catch(() => {});
              }
            })()
          );
        }
      }
    }

    if (updateTasks.length > 0) {
      await Promise.all(updateTasks);
    }

    const isFinished = page >= totalPages;
    if (isFinished) {
      await sql`
        UPDATE woocommerce_connections
        SET last_sync_at = NOW()
        WHERE tenant_id = ${tenantId}
      `;
      revalidatePath("/pos");
      revalidatePath("/user/stock");
      revalidatePath("/settings/integrations");
    }

    return {
      success: true,
      page,
      totalProducts,
      totalPages,
      batchProcessed: wooProducts.length,
      imported,
      updated,
      isFinished,
      updatedDetails,
    };
  } catch (err: any) {
    console.error("[syncWooProductsBatchAction Error]", err);
    return {
      success: false,
      page,
      totalProducts: 0,
      totalPages: 0,
      batchProcessed: 0,
      imported: 0,
      updated: 0,
      isFinished: true,
      error: err.message || "Failed to sync products batch.",
    };
  }
}

/**
 * Automatically detects and syncs newly created or recently modified products
 * from WooCommerce in the background. Useful when webhooks cannot reach localhost
 * or before webhooks trigger.
 */
export async function syncWooRecentProductsAction(): Promise<{
  success: boolean;
  imported: number;
  updated: number;
  totalChecked: number;
  error?: string;
  updatedDetails?: Array<{
    name: string;
    sku: string;
    currentStock?: number;
    changes: Array<{
      field: "SKU" | "Stock" | "Price" | "Name" | "Category";
      from: string | number;
      to: string | number;
    }>;
  }>;
  importedDetails?: Array<{
    name: string;
    sku: string;
    stock: number;
    price: number;
  }>;
}> {
  const auth = await authorizeWooCommerceAccess();
  if (auth.error || !auth.context) {
    return { success: false, imported: 0, updated: 0, totalChecked: 0, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret, status
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return { success: false, imported: 0, updated: 0, totalChecked: 0, error: "Not connected." };
    }

    const { store_url, encrypted_key, encrypted_secret } = connRows[0];
    const consumerKey = decryptWooCredential(encrypted_key, tenantId);
    const consumerSecret = decryptWooCredential(encrypted_secret, tenantId);

    // Fetch the 15 most recently created products & 15 most recently modified products
    const [createdRes, modifiedRes] = await Promise.all([
      executeWooRequest<any[]>(
        store_url,
        consumerKey,
        consumerSecret,
        "/products",
        {
          params: {
            per_page: 15,
            orderby: "date",
            order: "desc",
            currency: "LKR",
            "wmc-currency": "LKR",
          },
        }
      ).catch(() => ({ data: [] as any[] })),
      executeWooRequest<any[]>(
        store_url,
        consumerKey,
        consumerSecret,
        "/products",
        {
          params: {
            per_page: 15,
            orderby: "modified",
            order: "desc",
            currency: "LKR",
            "wmc-currency": "LKR",
          },
        }
      ).catch(() => ({ data: [] as any[] })),
    ]);

    const rawList = [...(createdRes.data || []), ...(modifiedRes.data || [])];
    const uniqueMap = new Map<number, any>();
    for (const p of rawList) {
      if (p && p.id && !uniqueMap.has(p.id)) {
        uniqueMap.set(p.id, p);
      }
    }

    const products = Array.from(uniqueMap.values());
    if (products.length === 0) {
      return { success: true, imported: 0, updated: 0, totalChecked: 0 };
    }

    // Unpack products and variations
    const itemsToProcess: Array<{
      wooProductId: number;
      wooVariationId: number;
      name: string;
      sku: string;
      price: number;
      stock: number;
      category: string;
    }> = [];

    for (const p of products) {
      const parentName = p.name || `WooCommerce Product #${p.id}`;
      const category = p.categories?.[0]?.name || "General";

      if (p.type === "variable") {
        try {
          const varRes = await executeWooRequest<any[]>(
            store_url,
            consumerKey,
            consumerSecret,
            `/products/${p.id}/variations`,
            {
              params: {
                per_page: 50,
                currency: "LKR",
                "wmc-currency": "LKR",
              },
            }
          );
          if (Array.isArray(varRes.data)) {
            for (const v of varRes.data) {
              const varAttrs = Array.isArray(v.attributes)
                ? v.attributes.map((a: any) => a.option).filter(Boolean).join(", ")
                : "";
              const varName = varAttrs ? `${parentName} (${varAttrs})` : `${parentName} (Var #${v.id})`;
              const varSku = (v.sku || "").trim();
              const varPrice = extractWooLkrPrice(v, p);
              const varStock = v.stock_quantity !== null && v.stock_quantity !== undefined
                ? Math.max(0, Number(v.stock_quantity))
                : 0;

              itemsToProcess.push({
                wooProductId: p.id,
                wooVariationId: v.id,
                name: varName,
                sku: varSku || `SKU-WOO-${p.id}-${v.id}`,
                price: varPrice,
                stock: varStock,
                category,
              });
            }
          }
        } catch {}
      } else {
        const prodSku = (p.sku || "").trim();
        const prodPrice = extractWooLkrPrice(p);
        const prodStock = p.stock_quantity !== null && p.stock_quantity !== undefined
          ? Math.max(0, Number(p.stock_quantity))
          : 0;

        itemsToProcess.push({
          wooProductId: p.id,
          wooVariationId: 0,
          name: parentName,
          sku: prodSku || `SKU-WOO-${p.id}`,
          price: prodPrice,
          stock: prodStock,
          category,
        });
      }
    }

    let imported = 0;
    let updated = 0;
    const updatedDetails: Array<{
      name: string;
      sku: string;
      currentStock?: number;
      changes: Array<{
        field: "SKU" | "Stock" | "Price" | "Name" | "Category";
        from: string | number;
        to: string | number;
      }>;
    }> = [];
    const importedDetails: Array<{
      name: string;
      sku: string;
      stock: number;
      price: number;
    }> = [];

    for (const item of itemsToProcess) {
      const cleanSku = item.sku.trim();

      // Check if mapped
      const mapRows = await sql`
        SELECT m.id, m.inventory_id, m.last_synced_stock, m.content_hash,
               i.item_name, i.quantity, i.selling_price, i.sku
        FROM woocommerce_product_mappings m
        JOIN admin_inventory i ON i.id = m.inventory_id
        WHERE m.tenant_id = ${tenantId}
          AND m.woo_product_id = ${item.wooProductId}
          AND m.woo_variation_id = ${item.wooVariationId}
        LIMIT 1
      `;

      if (mapRows.length > 0) {
        // Already mapped: check if price, stock, name, or SKU changed
        const mapping = mapRows[0];
        const currentQty = parseFloat(mapping.quantity || "0");
        const currentPrice = parseFloat(mapping.selling_price || "0");
        const currentSku = (mapping.sku || "").trim();
        const currentName = mapping.item_name || "";

        const priceChanged = item.price > 0 && Math.abs(currentPrice - item.price) > 0.01;
        const stockChanged = Math.abs(currentQty - item.stock) > 0.01;
        const nameChanged = item.name !== currentName;
        const skuChanged = Boolean(cleanSku && cleanSku.toLowerCase() !== currentSku.toLowerCase());

        if (priceChanged || stockChanged || nameChanged || skuChanged) {
          const itemChanges: Array<{
            field: "SKU" | "Stock" | "Price" | "Name" | "Category";
            from: string | number;
            to: string | number;
          }> = [];
          if (stockChanged) {
            itemChanges.push({ field: "Stock", from: `${currentQty} pcs`, to: `${item.stock} pcs` });
          }
          if (priceChanged) {
            itemChanges.push({ field: "Price", from: `LKR ${currentPrice.toLocaleString()}`, to: `LKR ${item.price.toLocaleString()}` });
          }
          if (skuChanged) {
            itemChanges.push({ field: "SKU", from: currentSku || "None", to: cleanSku });
          }
          if (nameChanged) {
            itemChanges.push({ field: "Name", from: currentName, to: item.name });
          }

          updatedDetails.push({
            name: item.name,
            sku: cleanSku || currentSku,
            currentStock: item.stock,
            changes: itemChanges,
          });

          await sql`
            UPDATE admin_inventory SET
              item_name = ${item.name},
              sku = ${cleanSku || currentSku},
              selling_price = ${item.price > 0 ? item.price : currentPrice},
              quantity = ${item.stock},
              status = ${item.stock > 0 ? "Available" : "Out of Stock"},
              category = ${item.category},
              updated_at = NOW()
            WHERE id = ${mapping.inventory_id}
          `;

          if (stockChanged) {
            const diff = item.stock - currentQty;
            await sql`
              INSERT INTO stock_movements (
                tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, notes, created_at
              ) VALUES (
                ${tenantId}, ${mapping.inventory_id}, ${diff}, ${currentQty}, ${item.stock}, 'correction',
                'woocommerce_sync', ${String(item.wooProductId)}, 'Auto-updated from WooCommerce recent sync', NOW()
              )
            `.catch(() => {});
          }

          const hash = computeProductContentHash({
            sku: cleanSku || currentSku,
            name: item.name,
            price: item.price > 0 ? item.price : currentPrice,
            stock: item.stock,
          });

          await sql`
            UPDATE woocommerce_product_mappings SET
              woo_sku = ${cleanSku || currentSku},
              last_synced_stock = ${item.stock},
              content_hash = ${hash},
              sync_status = 'synced',
              last_synced_at = NOW(),
              updated_at = NOW()
            WHERE id = ${mapping.id}
          `;

          updated++;
        }
      } else {
        // Brand new product from WooCommerce: auto-import into Framebooks!
        const existingFb = await sql`
          SELECT id FROM admin_inventory
          WHERE (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
            AND LOWER(sku) = LOWER(${cleanSku})
          LIMIT 1
        `;

        let targetInventoryId: number;

        if (existingFb.length > 0) {
          targetInventoryId = Number(existingFb[0].id);
          await sql`
            UPDATE admin_inventory SET
              item_name = ${item.name},
              selling_price = ${item.price},
              quantity = ${item.stock},
              category = ${item.category},
              status = ${item.stock > 0 ? "Available" : "Out of Stock"},
              updated_at = NOW()
            WHERE id = ${targetInventoryId}
          `;
        } else {
          const insertRes = await sql`
            INSERT INTO admin_inventory (
              tenant_id, item_name, category, sku, quantity, selling_price, cost_price, status, created_at, updated_at
            ) VALUES (
              ${tenantId}, ${item.name}, ${item.category},
              ${cleanSku}, ${item.stock}, ${item.price}, 0,
              ${item.stock > 0 ? "Available" : "Out of Stock"}, NOW(), NOW()
            )
            RETURNING id
          `;
          targetInventoryId = Number(insertRes[0].id);

          await sql`
            INSERT INTO stock_movements (
              tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, notes, created_at
            ) VALUES (
              ${tenantId}, ${targetInventoryId}, ${item.stock}, 0, ${item.stock}, 'received',
              'woocommerce_sync', ${String(item.wooProductId)}, 'Auto-imported new WooCommerce product', NOW()
            )
          `.catch(() => {});
        }

        const hash = computeProductContentHash({
          sku: cleanSku,
          name: item.name,
          price: item.price,
          stock: item.stock,
        });

        await sql`
          INSERT INTO woocommerce_product_mappings (
            tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
            last_synced_stock, content_hash, sync_status, last_synced_at, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${targetInventoryId}, ${item.wooProductId}, ${item.wooVariationId}, ${cleanSku},
            ${item.stock}, ${hash}, 'synced', NOW(), NOW(), NOW()
          )
          ON CONFLICT (tenant_id, inventory_id) DO UPDATE SET
            woo_product_id = EXCLUDED.woo_product_id,
            woo_variation_id = EXCLUDED.woo_variation_id,
            woo_sku = EXCLUDED.woo_sku,
            last_synced_stock = EXCLUDED.last_synced_stock,
            content_hash = EXCLUDED.content_hash,
            sync_status = 'synced',
            last_synced_at = NOW(),
            updated_at = NOW()
        `;

        importedDetails.push({
          name: item.name,
          sku: cleanSku,
          stock: item.stock,
          price: item.price,
        });
        imported++;
      }
    }

    if (imported > 0 || updated > 0) {
      revalidatePath("/pos");
      revalidatePath("/user/stock");
      revalidatePath("/settings/integrations");
    }

    return {
      success: true,
      imported,
      updated,
      totalChecked: itemsToProcess.length,
      updatedDetails,
      importedDetails,
    };
  } catch (err: any) {
    console.error("[syncWooRecentProductsAction Error]", err);
    return {
      success: false,
      imported: 0,
      updated: 0,
      totalChecked: 0,
      error: err.message || "Failed to auto-sync recent products.",
    };
  }
}
