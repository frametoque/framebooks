import sql from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ensureWooCommerceSchema } from "./db-init.ts";
import { recordStockMovements } from "@/lib/pos/stock-service";
import { defaultWooConnector, ChannelStockUpdateItem } from "./connector.ts";
import { decryptWooCredential } from "./encryption.ts";
import { logSyncEvent } from "./push-service.ts";
import { computeProductContentHash, extractWooLkrPrice } from "./mapping-service.ts";
import {
  computeOrderStatusDelta,
  getOrderStockAction,
  buildOrderTransitionIdempotencyKey,
  OrderStockAction,
} from "./order-delta.ts";

export { computeOrderStatusDelta, getOrderStockAction, buildOrderTransitionIdempotencyKey };
export type { OrderStockAction };

export interface WooLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  sku?: string;
  price?: number | string;
  total?: string;
}

export interface WooOrderPayload {
  id: number;
  number?: string;
  status: string;
  currency?: string;
  total?: string;
  date_created?: string;
  date_modified?: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  line_items: WooLineItem[];
}

/**
 * Processes an incoming WooCommerce order webhook (order.created or order.updated).
 * Applies stock deltas to Framebooks inventory, records idempotency, and pushes back
 * resulting absolute quantity to WooCommerce.
 */
export async function processWooOrderWebhook(
  tenantId: number,
  order: WooOrderPayload,
  topic: string
): Promise<{ success: boolean; duplicate?: boolean; modifiedItems: number; error?: string }> {
  await ensureWooCommerceSchema();

  const orderId = order.id;
  const currentStatus = order.status;
  const idempotencyKey = buildOrderTransitionIdempotencyKey(orderId, currentStatus);

  // 1. Idempotency Check: check if this exact order transition was already processed
  const existingKey = await sql`
    SELECT id FROM woocommerce_idempotency_keys
    WHERE tenant_id = ${tenantId} AND idempotency_key = ${idempotencyKey}
    LIMIT 1
  `;

  if (existingKey.length > 0) {
    return {
      success: true,
      duplicate: true,
      modifiedItems: 0,
    };
  }

  // 2. Fetch connection details and sync settings
  const connRows = await sql`
    SELECT store_url, encrypted_key, encrypted_secret, sync_settings
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId} AND status = 'connected'
    LIMIT 1
  `;

  if (connRows.length === 0) {
    return { success: false, modifiedItems: 0, error: "WooCommerce not connected." };
  }

  const conn = connRows[0];
  const syncSettings = conn.sync_settings || {};

  // Check previous status if available from sync logs
  const prevLog = await sql`
    SELECT details FROM woocommerce_sync_logs
    WHERE tenant_id = ${tenantId}
      AND entity_type = 'order'
      AND entity_id = ${String(orderId)}
      AND status = 'success'
    ORDER BY id DESC
    LIMIT 1
  `;

  let previousStatus: string | null = null;
  if (prevLog.length > 0 && prevLog[0].details) {
    const match = prevLog[0].details.match(/status: ([a-zA-Z0-9_-]+)/);
    if (match) previousStatus = match[1];
  }

  const lineItems = order.line_items || [];
  if (lineItems.length === 0) {
    await markOrderProcessed(tenantId, idempotencyKey);
    return { success: true, modifiedItems: 0 };
  }

  // 3. Find matching inventory items for line items
  const movementsToApply: Array<{
    inventoryId: number;
    changeQty: number;
    reason: "sale" | "refund" | "correction";
    referenceType: string;
    referenceId: string;
    notes: string;
  }> = [];

  const itemsToPushBack: ChannelStockUpdateItem[] = [];

  for (const item of lineItems) {
    const qty = Number(item.quantity) || 1;
    const delta = computeOrderStatusDelta(previousStatus, currentStatus, qty);

    if (delta === 0) continue; // No stock change needed for this transition

    const wooProdId = item.product_id;
    const wooVarId = item.variation_id || 0;
    const itemSku = (item.sku || "").trim();

    // Look up mapping by product ID/variation ID or SKU
    const mapRows = await sql`
      SELECT m.inventory_id, m.woo_sku, m.woo_product_id, m.woo_variation_id,
             i.quantity, i.selling_price, i.item_name
      FROM woocommerce_product_mappings m
      JOIN admin_inventory i ON i.id = m.inventory_id
      WHERE m.tenant_id = ${tenantId}
        AND (
          (m.woo_product_id = ${wooProdId} AND m.woo_variation_id = ${wooVarId})
          OR (m.woo_sku = ${itemSku} AND ${itemSku} != '')
        )
      LIMIT 1
    `;

    if (mapRows.length > 0) {
      const mapping = mapRows[0];
      const invId = mapping.inventory_id;
      const isRestoring = delta > 0;

      movementsToApply.push({
        inventoryId: invId,
        changeQty: delta, // negative for sale reduction, positive for restore
        reason: isRestoring ? "refund" : "sale",
        referenceType: "woocommerce_order",
        referenceId: String(orderId),
        notes: `WooCommerce Order #${order.number || orderId} (${currentStatus})`,
      });

      // Prepare absolute count for push-back
      const expectedNewQty = Math.max(0, parseFloat(mapping.quantity || "0") + delta);
      itemsToPushBack.push({
        inventoryId: invId,
        sku: mapping.woo_sku || itemSku,
        quantity: expectedNewQty,
        sellingPrice: parseFloat(mapping.selling_price || "0"),
        itemName: mapping.item_name,
        wooProductId: Number(mapping.woo_product_id),
        wooVariationId: Number(mapping.woo_variation_id || 0),
      });
    }
  }

  // 4. Apply movements to Framebooks stock in single atomic transaction
  if (movementsToApply.length > 0) {
    await recordStockMovements(
      tenantId,
      movementsToApply,
      { id: null, name: "WooCommerce Webhook" }
    );

    // 5. Push the resulting absolute quantity back to WooCommerce to guarantee sync consistency
    try {
      const key = decryptWooCredential(conn.encrypted_key, tenantId);
      const secret = decryptWooCredential(conn.encrypted_secret, tenantId);

      await defaultWooConnector.pushStockUpdates(
        conn.store_url,
        key,
        secret,
        itemsToPushBack
      );
    } catch (pushErr: any) {
      console.warn("[WooCommerce Webhook Push Back Warning]", pushErr.message);
    }
  }

  // 6. Record idempotency key & log success
  await markOrderProcessed(tenantId, idempotencyKey);

  await logSyncEvent(tenantId, {
    direction: "woo_to_framebooks",
    entityType: "order",
    entityId: String(orderId),
    status: "success",
    details: `Processed order #${order.number || orderId} status: ${currentStatus}. Adjusted ${movementsToApply.length} stock items.`,
  });

  return {
    success: true,
    modifiedItems: movementsToApply.length,
  };
}

/**
 * Processes an incoming WooCommerce product update webhook (product.updated).
 * Computes difference against last_synced_stock and records adjustment without re-pushing.
 */
export async function processWooProductWebhook(
  tenantId: number,
  product: any,
  topic: string
): Promise<{ success: boolean; updated: boolean; message?: string }> {
  await ensureWooCommerceSchema();

  const prodId = Number(product.id);
  const sku = (product.sku || "").trim();
  const manageStock = Boolean(product.manage_stock);
  const currentStock = product.stock_quantity !== null && product.stock_quantity !== undefined
    ? Number(product.stock_quantity)
    : null;

  // 0. Handle product deletion
  if (topic === "product.deleted") {
    await sql`
      UPDATE admin_inventory SET
        status = 'Archived',
        quantity = 0,
        updated_at = NOW()
      WHERE id IN (
        SELECT inventory_id FROM woocommerce_product_mappings
        WHERE tenant_id = ${tenantId} AND woo_product_id = ${prodId}
      )
    `;
    await sql`
      DELETE FROM woocommerce_product_mappings
      WHERE tenant_id = ${tenantId} AND woo_product_id = ${prodId}
    `;
    try {
      revalidatePath("/pos");
      revalidatePath("/user/stock");
    } catch {}
    return { success: true, updated: true, message: `Archived deleted WooCommerce product #${prodId}` };
  }

  // 1. Look up mapping in woocommerce_product_mappings
  const mapRows = await sql`
    SELECT m.id, m.inventory_id, m.last_synced_stock, m.content_hash,
           i.item_name, i.quantity, i.selling_price
    FROM woocommerce_product_mappings m
    JOIN admin_inventory i ON i.id = m.inventory_id
    WHERE m.tenant_id = ${tenantId}
      AND m.woo_product_id = ${prodId}
      AND m.woo_variation_id = 0
    LIMIT 1
  `;

  if (mapRows.length > 0) {
    const mapping = mapRows[0];
    const currentFbQty = parseFloat(mapping.quantity || "0");
    const extractedPrice = extractWooLkrPrice(product);
    const price = extractedPrice > 0 ? extractedPrice : parseFloat(mapping.selling_price || "0");
    const name = product.name || mapping.item_name;
    const category = product.categories?.[0]?.name || null;

    // Always keep name, price, and category in sync from WooCommerce
    await sql`
      UPDATE admin_inventory SET
        item_name = ${name},
        selling_price = ${price},
        category = COALESCE(${category}, category),
        updated_at = NOW()
      WHERE id = ${mapping.inventory_id}
    `;

    // If stock tracking is enabled and quantity changed in WooCommerce
    if (manageStock && currentStock !== null) {
      const diff = currentStock - currentFbQty;

      if (diff !== 0) {
        // Record adjustment tagged source='woocommerce_sync' so loop prevention prevents re-push
        await recordStockMovements(
          tenantId,
          [
            {
              inventoryId: mapping.inventory_id,
              changeQty: diff,
              reason: "correction",
              referenceType: "woocommerce_sync",
              referenceId: String(prodId),
              notes: `WooCommerce product update: stock changed from ${currentFbQty} to ${currentStock}`,
            },
          ],
          { id: null, name: "WooCommerce Sync" }
        );
      }
    }

    const newStock = currentStock !== null ? currentStock : currentFbQty;
    const newHash = computeProductContentHash({
      sku: sku || mapping.item_name,
      name,
      price,
      stock: newStock,
    });

    const now = new Date();
    await sql`
      UPDATE woocommerce_product_mappings
      SET last_synced_stock = ${newStock},
          content_hash = ${newHash},
          sync_status = 'synced',
          last_synced_at = ${now},
          updated_at = ${now}
      WHERE id = ${mapping.id}
    `;

    try {
      revalidatePath("/pos");
      revalidatePath("/user/stock");
    } catch {}

    await logSyncEvent(tenantId, {
      direction: "woo_to_framebooks",
      entityType: "product",
      entityId: String(prodId),
      status: "success",
      details: `Updated product "${name}" (Stock: ${newStock}, Price: ${price})`,
    });

    return { success: true, updated: true, message: `Updated product #${prodId}` };
  }

  // 2. Unmapped Product: Auto-import new WooCommerce product into FrameBooks immediately
  const connRows = await sql`
    SELECT sync_settings FROM woocommerce_connections
    WHERE tenant_id = ${tenantId} AND status = 'connected'
    LIMIT 1
  `;

  if (connRows.length > 0) {
    const cleanSku = (sku || "").trim().toUpperCase() || `SKU-WOO-${prodId}`;
    const price = extractWooLkrPrice(product);
    const stock = Math.max(0, currentStock || 0);
    const name = product.name || `WooCommerce Product #${prodId}`;
    const category = product.categories?.[0]?.name || "WooCommerce";

    // Check if an item already exists with this exact SKU
    const existingFb = await sql`
      SELECT id FROM admin_inventory
      WHERE (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
        AND LOWER(sku) = LOWER(${cleanSku})
      LIMIT 1
    `;

    let targetInvId: number;

    if (existingFb.length > 0) {
      targetInvId = Number(existingFb[0].id);
      await sql`
        UPDATE admin_inventory SET
          item_name = ${name},
          selling_price = ${price},
          quantity = ${stock},
          category = ${category},
          status = ${stock > 0 ? "Available" : "Out of Stock"},
          updated_at = NOW()
        WHERE id = ${targetInvId}
      `;
    } else {
      const invInsert = await sql`
        INSERT INTO admin_inventory (
          tenant_id, item_name, category, sku, quantity, selling_price, cost_price, status, created_at, updated_at
        ) VALUES (
          ${tenantId}, ${name}, ${category},
          ${cleanSku}, ${stock}, ${price}, 0, ${stock > 0 ? "Available" : "Out of Stock"}, NOW(), NOW()
        )
        RETURNING id
      `;
      targetInvId = Number(invInsert[0].id);

      await sql`
        INSERT INTO stock_movements (
          tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, notes, created_at
        ) VALUES (
          ${tenantId}, ${targetInvId}, ${stock}, 0, ${stock}, 'received',
          'woocommerce_sync', ${String(prodId)}, 'Auto-imported from WooCommerce product webhook', NOW()
        )
      `.catch(() => {});
    }

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
        ${tenantId}, ${targetInvId}, ${prodId}, 0, ${cleanSku},
        ${stock}, ${hash}, 'synced', NOW(), NOW(), NOW()
      )
      ON CONFLICT (tenant_id, inventory_id) DO UPDATE SET
        woo_product_id = EXCLUDED.woo_product_id,
        woo_sku = EXCLUDED.woo_sku,
        last_synced_stock = EXCLUDED.last_synced_stock,
        content_hash = EXCLUDED.content_hash,
        sync_status = 'synced',
        last_synced_at = NOW(),
        updated_at = NOW()
    `;

    try {
      revalidatePath("/pos");
      revalidatePath("/user/stock");
    } catch {}

    await logSyncEvent(tenantId, {
      direction: "woo_to_framebooks",
      entityType: "product",
      entityId: String(prodId),
      status: "success",
      details: `Auto-imported new product "${name}" (SKU: ${cleanSku}, Stock: ${stock}).`,
    });

    return { success: true, updated: true, message: `Auto-imported new product SKU: ${cleanSku}` };
  }

  return { success: true, updated: false, message: "Unmapped product ignored." };
}

async function markOrderProcessed(tenantId: number, idempotencyKey: string) {
  try {
    await sql`
      INSERT INTO woocommerce_idempotency_keys (tenant_id, idempotency_key, created_at)
      VALUES (${tenantId}, ${idempotencyKey}, NOW())
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    `;
  } catch (err) {
    console.error("[Idempotency Insert Error]", err);
  }
}
