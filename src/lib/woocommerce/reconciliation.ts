import sql from "@/lib/db";
import { ensureWooCommerceSchema } from "./db-init.ts";
import { decryptWooCredential } from "./encryption.ts";
import { defaultWooConnector, ChannelStockUpdateItem } from "./connector.ts";
import { executeWooRequest } from "./client.ts";
import { recordStockMovements } from "@/lib/pos/stock-service";
import { logSyncEvent } from "./push-service.ts";
import { computeProductContentHash } from "./mapping-service.ts";
import { processWooOrderWebhook } from "./webhook-processor.ts";
import {
  resolveConflict,
  detectCatalogDrift,
  ConflictPolicy,
  ConflictItemData,
  ConflictResolutionResult,
  ProductDriftRecord,
} from "./conflict-resolver.ts";

export { resolveConflict, detectCatalogDrift };
export type { ConflictPolicy, ConflictItemData, ConflictResolutionResult, ProductDriftRecord };

/**
 * Runs full catalog reconciliation for a connected tenant.
 * Fixes drift per conflict setting, polls missed webhooks, and updates last_sync_at.
 */
export async function reconcileTenantCatalog(tenantId: number): Promise<{
  success: boolean;
  driftsFound: number;
  driftsFixed: number;
  missedOrdersProcessed: number;
  details: string;
  error?: string;
}> {
  await ensureWooCommerceSchema();

  const connRows = await sql`
    SELECT store_url, encrypted_key, encrypted_secret, status, sync_settings, last_sync_at
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId} AND status = 'connected'
    LIMIT 1
  `;

  if (connRows.length === 0) {
    return {
      success: false,
      driftsFound: 0,
      driftsFixed: 0,
      missedOrdersProcessed: 0,
      details: "Tenant WooCommerce integration inactive.",
      error: "Not connected",
    };
  }

  const conn = connRows[0];
  const syncSettings = conn.sync_settings || {};
  const conflictPolicy: ConflictPolicy = syncSettings.conflict_winner || "newest_wins";

  let key = "";
  let secret = "";
  try {
    key = decryptWooCredential(conn.encrypted_key, tenantId);
    secret = decryptWooCredential(conn.encrypted_secret, tenantId);
  } catch {
    return {
      success: false,
      driftsFound: 0,
      driftsFixed: 0,
      missedOrdersProcessed: 0,
      details: "Failed to decrypt API credentials.",
      error: "Decryption failed",
    };
  }

  // 1. Load all mapped products for tenant
  const mappedRows = await sql`
    SELECT 
      m.inventory_id, m.woo_product_id, m.woo_variation_id, m.woo_sku,
      i.item_name, i.quantity, i.selling_price, i.updated_at as fb_updated_at
    FROM woocommerce_product_mappings m
    JOIN admin_inventory i ON i.id::text = m.inventory_id::text
    WHERE m.tenant_id::text = ${String(tenantId)}
  `;

  if (mappedRows.length === 0) {
    return {
      success: true,
      driftsFound: 0,
      driftsFixed: 0,
      missedOrdersProcessed: 0,
      details: "No mapped products to reconcile.",
    };
  }

  // 2. Fetch live products from WooCommerce (paginated up to 100 items per request)
  const liveWooItems = new Map<string, { stock: number; updatedAt?: string }>();
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 5) {
    const res = await executeWooRequest<any[]>(
      conn.store_url,
      key,
      secret,
      "/products",
      {
        params: { per_page: 50, page },
        timeoutMs: 15000,
      }
    );

    if (!res.success || !res.data || res.data.length === 0) {
      hasMore = false;
      break;
    }

    for (const prod of res.data) {
      if (prod.manage_stock && prod.stock_quantity !== null) {
        liveWooItems.set(`${prod.id}_0`, {
          stock: Number(prod.stock_quantity),
          updatedAt: prod.date_modified,
        });
        if (prod.sku) {
          liveWooItems.set(prod.sku.toUpperCase(), {
            stock: Number(prod.stock_quantity),
            updatedAt: prod.date_modified,
          });
        }
      }
    }

    if (res.data.length < 50) hasMore = false;
    else page++;
  }

  // 3. Detect drift between Framebooks and WooCommerce
  const formattedMapped = mappedRows.map((r) => ({
    inventoryId: r.inventory_id,
    wooProductId: Number(r.woo_product_id),
    wooVariationId: Number(r.woo_variation_id || 0),
    sku: r.woo_sku || "",
    name: r.item_name,
    fbStock: parseFloat(r.quantity || "0"),
    fbUpdatedAt: r.fb_updated_at,
  }));

  const drifts = detectCatalogDrift(formattedMapped, liveWooItems, conflictPolicy);
  let driftsFixed = 0;

  // 4. Resolve drifts
  const itemsToPushToWoo: ChannelStockUpdateItem[] = [];

  for (const drift of drifts) {
    if (drift.resolution.winner === "woo") {
      // WooCommerce wins: adjust Framebooks stock
      const diff = drift.wooStock - drift.fbStock;
      if (diff !== 0) {
        await recordStockMovements(
          tenantId,
          [
            {
              inventoryId: drift.inventoryId,
              changeQty: diff,
              reason: "correction",
              referenceType: "woocommerce_sync",
              notes: `Reconciliation drift fix (${drift.resolution.reason})`,
            },
          ],
          { id: null, name: "Reconciliation Cron" }
        );

        const newHash = computeProductContentHash({
          sku: drift.sku,
          name: drift.name,
          price: 0,
          stock: drift.wooStock,
        });

        const now = new Date();
        await sql`
          UPDATE woocommerce_product_mappings
          SET last_synced_stock = ${drift.wooStock},
              content_hash = ${newHash},
              sync_status = 'synced',
              last_synced_at = ${now},
              updated_at = ${now}
          WHERE tenant_id = ${tenantId} AND inventory_id = ${drift.inventoryId}
        `;
        driftsFixed++;
      }
    } else {
      // Framebooks wins: queue push to WooCommerce
      itemsToPushToWoo.push({
        inventoryId: drift.inventoryId,
        sku: drift.sku,
        quantity: drift.fbStock,
        wooProductId: drift.wooProductId,
        wooVariationId: drift.wooVariationId,
      });
    }
  }

  if (itemsToPushToWoo.length > 0) {
    const pushRes = await defaultWooConnector.pushStockUpdates(
      conn.store_url,
      key,
      secret,
      itemsToPushToWoo
    );
    if (pushRes.success) {
      driftsFixed += pushRes.syncedCount;
      const now = new Date();
      for (const item of itemsToPushToWoo) {
        await sql`
          UPDATE woocommerce_product_mappings
          SET last_synced_stock = ${item.quantity},
              sync_status = 'synced',
              last_synced_at = ${now},
              updated_at = ${now}
          WHERE tenant_id = ${tenantId} AND inventory_id = ${item.inventoryId}
        `;
      }
    }
  }

  // 5. Poll missed orders using modified_after
  let missedOrdersProcessed = 0;
  if (conn.last_sync_at) {
    const isoSince = new Date(conn.last_sync_at).toISOString();
    const orderPollRes = await executeWooRequest<any[]>(
      conn.store_url,
      key,
      secret,
      "/orders",
      {
        params: { after: isoSince, per_page: 20 },
        timeoutMs: 15000,
      }
    );

    if (orderPollRes.success && orderPollRes.data && orderPollRes.data.length > 0) {
      for (const order of orderPollRes.data) {
        const orderResult = await processWooOrderWebhook(tenantId, order, "order.updated");
        if (orderResult.success && !orderResult.duplicate) {
          missedOrdersProcessed++;
        }
      }
    }
  }

  // 6. Update last_sync_at
  const now = new Date();
  await sql`
    UPDATE woocommerce_connections
    SET last_sync_at = ${now}
    WHERE tenant_id = ${tenantId}
  `;

  await logSyncEvent(tenantId, {
    direction: "woo_to_framebooks",
    entityType: "reconciliation_cron",
    status: "success",
    details: `Reconciliation complete: evaluated ${formattedMapped.length} items, found ${drifts.length} drifts, fixed ${driftsFixed}, processed ${missedOrdersProcessed} missed orders.`,
  });

  return {
    success: true,
    driftsFound: drifts.length,
    driftsFixed,
    missedOrdersProcessed,
    details: `Reconciled ${formattedMapped.length} items. Resolved ${driftsFixed} discrepancies.`,
  };
}

/**
 * Periodic cron handler: loops through all connected tenants and executes reconciliation.
 */
export async function runReconciliationCron(): Promise<{
  tenantsEvaluated: number;
  totalDriftsFixed: number;
  totalMissedOrders: number;
}> {
  await ensureWooCommerceSchema();

  const connectedTenants = await sql`
    SELECT tenant_id FROM woocommerce_connections
    WHERE status = 'connected'
  `;

  let totalDriftsFixed = 0;
  let totalMissedOrders = 0;

  for (const t of connectedTenants) {
    try {
      const res = await reconcileTenantCatalog(t.tenant_id);
      if (res.success) {
        totalDriftsFixed += res.driftsFixed;
        totalMissedOrders += res.missedOrdersProcessed;
      }
    } catch (err: any) {
      console.error(`[Reconciliation Cron Error] Tenant ${t.tenant_id}:`, err);
    }
  }

  return {
    tenantsEvaluated: connectedTenants.length,
    totalDriftsFixed,
    totalMissedOrders,
  };
}
