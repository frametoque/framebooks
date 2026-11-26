import sql from "@/lib/db";
import { ensureWooCommerceSchema } from "./db-init.ts";
import { decryptWooCredential } from "./encryption.ts";
import { defaultWooConnector, ChannelStockUpdateItem, isLoopOriginated } from "./connector.ts";
import { computeProductContentHash } from "./mapping-service.ts";

export { isLoopOriginated };

export interface EnqueuePushOptions {
  source?: string; // 'pos' | 'adjustment' | 'received' | 'woocommerce' | 'woocommerce_sync' | 'manual'
  immediate?: boolean;
}

/**
 * Enqueues or immediately executes a push of absolute inventory quantities to WooCommerce.
 */
export async function enqueueWooStockPush(
  tenantId: number,
  items: Array<{
    inventoryId: number;
    newQuantity: number;
    reason?: string;
  }>,
  options?: EnqueuePushOptions
): Promise<{ success: boolean; pushed: boolean; message?: string }> {
  // 1. Loop Prevention check
  if (isLoopOriginated(options?.source)) {
    return { success: true, pushed: false, message: "Loop prevention: sync-originated change skipped." };
  }

  if (!items || items.length === 0) {
    return { success: true, pushed: false };
  }

  await ensureWooCommerceSchema();

  // 2. Check if tenant has an active WooCommerce connection
  const connRows = await sql`
    SELECT store_url, encrypted_key, encrypted_secret, status, sync_settings
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (connRows.length === 0 || connRows[0].status !== "connected") {
    return { success: true, pushed: false, message: "WooCommerce not connected." };
  }

  const conn = connRows[0];
  const syncSettings = conn.sync_settings || {};
  const inventoryIds = items.map((it) => it.inventoryId);

  // 3. Find which items are mapped to WooCommerce products/variations
  const mappedRows = await sql`
    SELECT 
      m.inventory_id, m.woo_product_id, m.woo_variation_id, m.woo_sku,
      i.item_name, i.selling_price
    FROM woocommerce_product_mappings m
    JOIN admin_inventory i ON i.id::text = m.inventory_id::text
    WHERE m.tenant_id::text = ${String(tenantId)}
      AND m.inventory_id = ANY(${inventoryIds})
  `;

  if (mappedRows.length === 0) {
    return { success: true, pushed: false, message: "No items mapped to WooCommerce." };
  }

  // 4. Build ChannelStockUpdateItem array with absolute quantity
  const updateItems: ChannelStockUpdateItem[] = [];
  for (const m of mappedRows) {
    const matchedInput = items.find((it) => it.inventoryId === m.inventory_id);
    if (!matchedInput) continue;

    updateItems.push({
      inventoryId: m.inventory_id,
      sku: m.woo_sku,
      quantity: Math.max(0, matchedInput.newQuantity),
      sellingPrice: parseFloat(m.selling_price || "0"),
      itemName: m.item_name,
      wooProductId: Number(m.woo_product_id),
      wooVariationId: Number(m.woo_variation_id || 0),
    });
  }

  const immediate = options?.immediate !== false;

  // 5. If immediate execution is requested, attempt direct push
  if (immediate) {
    try {
      const consumerKey = decryptWooCredential(conn.encrypted_key, tenantId);
      const consumerSecret = decryptWooCredential(conn.encrypted_secret, tenantId);

      const pushRes = await defaultWooConnector.pushStockUpdates(
        conn.store_url,
        consumerKey,
        consumerSecret,
        updateItems
      );

      if (pushRes.success) {
        // Update mappings and log success
        const now = new Date();
        for (const item of updateItems) {
          const hash = computeProductContentHash({
            sku: item.sku,
            name: item.itemName || "",
            price: item.sellingPrice || 0,
            stock: item.quantity,
          });

          await sql`
            UPDATE woocommerce_product_mappings
            SET last_synced_stock = ${item.quantity},
                content_hash = ${hash},
                sync_status = 'synced',
                last_synced_at = ${now},
                updated_at = ${now}
            WHERE tenant_id = ${tenantId} AND inventory_id = ${item.inventoryId}
          `;
        }

        await sql`
          UPDATE woocommerce_connections
          SET last_sync_at = ${now}
          WHERE tenant_id = ${tenantId}
        `;

        await logSyncEvent(tenantId, {
          direction: "framebooks_to_woo",
          entityType: "inventory_push",
          entityId: updateItems.map((u) => u.sku).join(", "),
          status: "success",
          details: `Pushed ${pushRes.syncedCount} items (source: ${options?.source || "pos"})`,
        });

        return { success: true, pushed: true, message: pushRes.details };
      } else {
        // If immediate push failed, fallback to queue
        console.warn("[WooCommerce Push] Immediate push failed, queuing retry job:", pushRes.errors);
      }
    } catch (err: any) {
      console.warn("[WooCommerce Push Error] Failed to execute immediate push, queuing job:", err.message);
    }
  }

  // 6. Queue the job for reliable background processing / retry
  await sql`
    INSERT INTO integration_sync_jobs (
      tenant_id, job_type, payload, attempts, max_attempts, status, scheduled_at, created_at, updated_at
    ) VALUES (
      ${tenantId},
      'stock_push',
      ${JSON.stringify({ items: updateItems, source: options?.source || "system" })},
      0,
      5,
      'pending',
      NOW(),
      NOW(),
      NOW()
    )
  `;

  await logSyncEvent(tenantId, {
    direction: "framebooks_to_woo",
    entityType: "inventory_push",
    entityId: updateItems.map((u) => u.sku).join(", "),
    status: "queued",
    details: `Queued push for ${updateItems.length} items (source: ${options?.source || "pos"})`,
  });

  return { success: true, pushed: false, message: "Stock push job queued." };
}

/**
 * Processes pending sync jobs from the queue with exponential backoff and dead-letter protection.
 */
export async function processPendingSyncJobs(
  targetTenantId?: number,
  limit: number = 10
): Promise<{ processed: number; succeeded: number; failed: number }> {
  await ensureWooCommerceSchema();

  const tenantFilter = targetTenantId ? sql`AND j.tenant_id = ${targetTenantId}` : sql``;

  // Atomically select and lock pending jobs
  const jobs = await sql`
    SELECT j.id, j.tenant_id, j.payload, j.attempts, j.max_attempts,
           c.store_url, c.encrypted_key, c.encrypted_secret, c.sync_settings
    FROM integration_sync_jobs j
    JOIN woocommerce_connections c ON c.tenant_id = j.tenant_id
    WHERE j.status = 'pending'
      AND j.scheduled_at <= NOW()
      AND c.status = 'connected'
      ${tenantFilter}
    ORDER BY j.scheduled_at ASC
    LIMIT ${limit}
    FOR UPDATE OF j SKIP LOCKED
  `;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    processed++;
    const payload = typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload;
    const items: ChannelStockUpdateItem[] = payload.items || [];
    const syncSettings = job.sync_settings || {};

    try {
      const consumerKey = decryptWooCredential(job.encrypted_key, job.tenant_id);
      const consumerSecret = decryptWooCredential(job.encrypted_secret, job.tenant_id);

      const pushRes = await defaultWooConnector.pushStockUpdates(
        job.store_url,
        consumerKey,
        consumerSecret,
        items
      );

      if (pushRes.success) {
        succeeded++;
        const now = new Date();

        for (const item of items) {
          const hash = computeProductContentHash({
            sku: item.sku,
            name: item.itemName || "",
            price: item.sellingPrice || 0,
            stock: item.quantity,
          });

          await sql`
            UPDATE woocommerce_product_mappings
            SET last_synced_stock = ${item.quantity},
                content_hash = ${hash},
                sync_status = 'synced',
                last_synced_at = ${now},
                updated_at = ${now}
            WHERE tenant_id = ${job.tenant_id} AND inventory_id = ${item.inventoryId}
          `;
        }

        await sql`
          UPDATE integration_sync_jobs
          SET status = 'completed', updated_at = ${now}
          WHERE id = ${job.id}
        `;

        await logSyncEvent(job.tenant_id, {
          direction: "framebooks_to_woo",
          entityType: "job_queue",
          entityId: `job_${job.id}`,
          status: "success",
          details: `Processed job #${job.id}: pushed ${pushRes.syncedCount} items`,
        });
      } else {
        throw new Error(pushRes.errors?.[0]?.error || "Batch push failed");
      }
    } catch (err: any) {
      failed++;
      const nextAttempts = (job.attempts || 0) + 1;
      const isDeadLetter = nextAttempts >= (job.max_attempts || 5);

      // Exponential backoff: 30s, 60s, 120s, 240s, 480s
      const delaySeconds = Math.min(1800, Math.pow(2, nextAttempts) * 15);

      await sql`
        UPDATE integration_sync_jobs
        SET attempts = ${nextAttempts},
            status = ${isDeadLetter ? "failed" : "pending"},
            last_error = ${err.message},
            scheduled_at = NOW() + (${delaySeconds} || ' seconds')::interval,
            updated_at = NOW()
        WHERE id = ${job.id}
      `;

      await logSyncEvent(job.tenant_id, {
        direction: "framebooks_to_woo",
        entityType: "job_queue",
        entityId: `job_${job.id}`,
        status: isDeadLetter ? "dead_letter" : "retry",
        errorMessage: err.message,
        details: `Job #${job.id} attempt ${nextAttempts}/${job.max_attempts}. Next retry in ${delaySeconds}s.`,
      });
    }
  }

  return { processed, succeeded, failed };
}

/**
 * Pushes all currently mapped products from Framebooks to WooCommerce ("Sync now" manual trigger).
 */
export async function pushAllMappedInventory(
  tenantId: number
): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  await ensureWooCommerceSchema();

  const connRows = await sql`
    SELECT store_url, encrypted_key, encrypted_secret, status, sync_settings
    FROM woocommerce_connections
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (connRows.length === 0 || connRows[0].status !== "connected") {
    return { success: false, syncedCount: 0, error: "WooCommerce is not connected." };
  }

  const conn = connRows[0];
  const syncSettings = conn.sync_settings || {};

  const mappedItems = await sql`
    SELECT 
      m.inventory_id, m.woo_product_id, m.woo_variation_id, m.woo_sku,
      i.item_name, i.quantity, i.selling_price
    FROM woocommerce_product_mappings m
    JOIN admin_inventory i ON i.id = m.inventory_id
    WHERE m.tenant_id = ${tenantId}
  `;

  if (mappedItems.length === 0) {
    return { success: true, syncedCount: 0, error: "No products currently mapped." };
  }

  const updateItems: ChannelStockUpdateItem[] = mappedItems.map((m) => ({
    inventoryId: m.inventory_id,
    sku: m.woo_sku,
    quantity: Math.max(0, parseFloat(m.quantity || "0")),
    sellingPrice: parseFloat(m.selling_price || "0"),
    itemName: m.item_name,
    wooProductId: Number(m.woo_product_id),
    wooVariationId: Number(m.woo_variation_id || 0),
  }));

  try {
    const consumerKey = decryptWooCredential(conn.encrypted_key, tenantId);
    const consumerSecret = decryptWooCredential(conn.encrypted_secret, tenantId);

    const pushRes = await defaultWooConnector.pushStockUpdates(
      conn.store_url,
      consumerKey,
      consumerSecret,
      updateItems
    );

    const now = new Date();
    for (const item of updateItems) {
      const hash = computeProductContentHash({
        sku: item.sku,
        name: item.itemName || "",
        price: item.sellingPrice || 0,
        stock: item.quantity,
      });

      await sql`
        UPDATE woocommerce_product_mappings
        SET last_synced_stock = ${item.quantity},
            content_hash = ${hash},
            sync_status = 'synced',
            last_synced_at = ${now},
            updated_at = ${now}
        WHERE tenant_id = ${tenantId} AND inventory_id = ${item.inventoryId}
      `;
    }

    await sql`
      UPDATE woocommerce_connections
      SET last_sync_at = ${now}
      WHERE tenant_id = ${tenantId}
    `;

    await logSyncEvent(tenantId, {
      direction: "framebooks_to_woo",
      entityType: "manual_sync_now",
      entityId: `catalog_${updateItems.length}`,
      status: "success",
      details: `Manual sync completed: pushed ${pushRes.syncedCount} items.`,
    });

    return { success: true, syncedCount: pushRes.syncedCount };
  } catch (err: any) {
    await logSyncEvent(tenantId, {
      direction: "framebooks_to_woo",
      entityType: "manual_sync_now",
      status: "error",
      errorMessage: err.message,
    });
    return { success: false, syncedCount: 0, error: err.message };
  }
}

/**
 * Records an entry into woocommerce_sync_logs.
 */
export async function logSyncEvent(
  tenantId: number,
  event: {
    direction: "framebooks_to_woo" | "woo_to_framebooks";
    entityType: string;
    entityId?: string;
    status: "success" | "error" | "queued" | "retry" | "dead_letter";
    details?: string;
    errorMessage?: string;
  }
) {
  try {
    await ensureWooCommerceSchema();
    await sql`
      INSERT INTO woocommerce_sync_logs (
        tenant_id, direction, entity_type, entity_id, status, details, error_message, created_at
      ) VALUES (
        ${tenantId}, ${event.direction}, ${event.entityType}, ${event.entityId || null},
        ${event.status}, ${event.details || null}, ${event.errorMessage || null}, NOW()
      )
    `;
  } catch (err) {
    console.error("[WooCommerce Sync Log Error]", err);
  }
}

/**
 * Fetches recent sync logs for tenant.
 */
export async function getSyncLogs(
  tenantId: number,
  options?: { limit?: number; offset?: number; status?: string }
) {
  await ensureWooCommerceSchema();
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;
  const statusFilter = options?.status ? sql`AND status = ${options.status}` : sql``;

  const rows = await sql`
    SELECT id, direction, entity_type, entity_id, status, details, error_message, created_at
    FROM woocommerce_sync_logs
    WHERE tenant_id = ${tenantId}
      ${statusFilter}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`
    SELECT COUNT(*) as total FROM woocommerce_sync_logs
    WHERE tenant_id = ${tenantId} ${statusFilter}
  `;

  return {
    logs: rows.map((r) => ({
      id: r.id,
      direction: r.direction,
      entityType: r.entity_type,
      entityId: r.entity_id,
      status: r.status,
      details: r.details,
      errorMessage: r.error_message,
      createdAt: r.created_at,
    })),
    total: parseInt(countRows[0]?.total || "0"),
  };
}
