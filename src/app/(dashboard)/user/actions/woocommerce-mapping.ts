"use server";

import sql from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getUserContext, requirePermission } from "./rbac";
import { requirePosAddon } from "@/lib/pos/entitlement";
import { ensureWooCommerceSchema } from "@/lib/woocommerce/db-init";
import { decryptWooCredential } from "@/lib/woocommerce/encryption";
import { executeWooRequest } from "@/lib/woocommerce/client";
import {
  classifySkuCatalog,
  computeProductContentHash,
  extractWooLkrPrice,
  SkuCatalogComparisonResult,
  SkuComparisonRow,
  SkuWinner,
  SkuSyncAction,
  WooProductItem,
  FramebooksProductItem,
} from "@/lib/woocommerce/mapping-service";
import { recordStockMovements } from "@/lib/pos/stock-service";
import { logSystemAction } from "@/lib/logger";

/**
 * Validates permission and POS add-on entitlement.
 */
async function authorizeMappingAccess() {
  const context = await getUserContext();
  if (!context.tenantId || !context.userId) {
    return { error: "Authentication required.", context: null };
  }

  const addonCheck = await requirePosAddon(context.tenantId);
  if (addonCheck.error) {
    return { error: addonCheck.error, context: null };
  }

  const { error: rbacError } = await requirePermission("settings", "manage");
  if (rbacError) {
    return { error: rbacError, context: null };
  }

  return { error: null, context };
}

/**
 * Fetches all WooCommerce products and variations paginated.
 */
export async function fetchAllWooProducts(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<WooProductItem[]> {
  const items: WooProductItem[] = [];
  let page = 1;
  const perPage = 100;
  let hasMore = true;

  while (hasMore && page <= 20) { // Limit to 2000 products for safety per run
    const res = await executeWooRequest<any[]>(
      storeUrl,
      consumerKey,
      consumerSecret,
      "/products",
      { params: { per_page: perPage, page, currency: "LKR", "wmc-currency": "LKR" } }
    );

    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
      hasMore = false;
      break;
    }

    for (const prod of res.data) {
      const categoryName = prod.categories?.[0]?.name || "General";

      if (prod.type === "variable") {
        // Fetch variations for variable product
        const varRes = await executeWooRequest<any[]>(
          storeUrl,
          consumerKey,
          consumerSecret,
          `/products/${prod.id}/variations`,
          { params: { per_page: 50, currency: "LKR", "wmc-currency": "LKR" } }
        );

        if (varRes.success && Array.isArray(varRes.data) && varRes.data.length > 0) {
          for (const v of varRes.data) {
            const varAttributes = v.attributes?.map((a: any) => a.option).join(" / ") || `Var #${v.id}`;
            items.push({
              wooProductId: prod.id,
              wooVariationId: v.id,
              name: `${prod.name} (${varAttributes})`,
              sku: (v.sku || "").trim(),
              category: categoryName,
              price: extractWooLkrPrice(v, prod),
              stockQuantity: v.stock_quantity !== null && v.stock_quantity !== undefined ? parseFloat(v.stock_quantity) : 0,
              manageStock: v.manage_stock === true,
              type: "variation",
              status: v.status || "publish",
            });
          }
        } else {
          // Fallback parent variable entry if variations fetch failed or empty
          items.push({
            wooProductId: prod.id,
            wooVariationId: 0,
            name: prod.name,
            sku: (prod.sku || "").trim(),
            category: categoryName,
            price: extractWooLkrPrice(prod),
            stockQuantity: prod.stock_quantity !== null ? parseFloat(prod.stock_quantity) : 0,
            manageStock: prod.manage_stock === true,
            type: "variable",
            status: prod.status || "publish",
          });
        }
      } else {
        // Simple, grouped, or external product
        items.push({
          wooProductId: prod.id,
          wooVariationId: 0,
          name: prod.name,
          sku: (prod.sku || "").trim(),
          category: categoryName,
          price: extractWooLkrPrice(prod),
          stockQuantity: prod.stock_quantity !== null && prod.stock_quantity !== undefined ? parseFloat(prod.stock_quantity) : 0,
          manageStock: prod.manage_stock === true,
          type: prod.type || "simple",
          status: prod.status || "publish",
        });
      }
    }

    if (res.data.length < perPage) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return items;
}

/**
 * Fetches and compares WooCommerce and Framebooks catalog for SKU Mapping Wizard.
 */
export async function getSkuCatalogComparisonAction(
  defaultWinner: SkuWinner = "framebooks"
): Promise<{
  success: boolean;
  result?: SkuCatalogComparisonResult;
  error?: string;
}> {
  const auth = await authorizeMappingAccess();
  if (auth.error || !auth.context) {
    return { success: false, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  await ensureWooCommerceSchema();

  try {
    // 1. Fetch connection details
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

    // 2. Fetch Framebooks inventory items
    const fbRows = await sql`
      SELECT id, item_name, sku, category, selling_price, cost_price, quantity, status
      FROM admin_inventory
      WHERE (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
      ORDER BY id ASC
    `;

    const fbProducts: FramebooksProductItem[] = fbRows.map((r: any) => ({
      id: Number(r.id),
      name: r.item_name || "Unnamed Item",
      sku: (r.sku || "").trim(),
      category: r.category || "General",
      sellingPrice: parseFloat(r.selling_price || 0),
      costPrice: parseFloat(r.cost_price || 0),
      quantity: parseFloat(r.quantity || 0),
      status: r.status || "Available",
    }));

    // 3. Fetch existing mappings
    const mappingRows = await sql`
      SELECT inventory_id FROM woocommerce_product_mappings
      WHERE tenant_id = ${tenantId}
    `;
    const mappedSet = new Set<number>(mappingRows.map((m: any) => Number(m.inventory_id)));

    // 4. Fetch WooCommerce catalog
    const wooProducts = await fetchAllWooProducts(c.store_url, key, secret);

    // 5. Run classification algorithm
    const comparison = classifySkuCatalog(fbProducts, wooProducts, mappedSet, defaultWinner);

    return {
      success: true,
      result: comparison,
    };
  } catch (err: any) {
    console.error("[getSkuCatalogComparisonAction Error]", err);
    return { success: false, error: err.message || "Failed to compare catalog SKUs." };
  }
}

export interface SkuMappingBatchPayload {
  rowId: string;
  sku: string;
  action: SkuSyncAction;
  winner: SkuWinner;
  framebooksItemId?: number;
  wooProductId?: number;
  wooVariationId?: number;
  wooProductName?: string;
  wooPrice?: number;
  wooStock?: number;
}

/**
 * Applies the selected SKU mapping decisions (Link, Import, Push to Woo, Skip)
 * with atomic stock reconciliation and audit logging.
 */
export async function applySkuMappingsBatchAction(
  items: SkuMappingBatchPayload[],
  defaultWinner: SkuWinner = "framebooks"
): Promise<{
  success: boolean;
  linkedCount: number;
  importedCount: number;
  pushedCount: number;
  skippedCount: number;
  error?: string;
}> {
  const auth = await authorizeMappingAccess();
  if (auth.error || !auth.context) {
    return { success: false, linkedCount: 0, importedCount: 0, pushedCount: 0, skippedCount: 0, error: auth.error };
  }

  const tenantId = Number(auth.context.tenantId);
  const userId = Number(auth.context.userId);
  await ensureWooCommerceSchema();

  try {
    const connRows = await sql`
      SELECT store_url, encrypted_key, encrypted_secret
      FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `;

    if (connRows.length === 0) {
      return { success: false, linkedCount: 0, importedCount: 0, pushedCount: 0, skippedCount: 0, error: "WooCommerce not connected." };
    }

    const c = connRows[0];
    const key = decryptWooCredential(c.encrypted_key, tenantId);
    const secret = decryptWooCredential(c.encrypted_secret, tenantId);

    let linkedCount = 0;
    let importedCount = 0;
    let pushedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (item.action === "skip") {
        skippedCount++;
        continue;
      }

      // --- 1. ACTION: LINK EXISTING MATCHED ITEMS ---
      if (item.action === "link" && item.framebooksItemId && item.wooProductId) {
        const fbItem = (
          await sql`SELECT id, item_name, quantity, selling_price, sku FROM admin_inventory WHERE id::text = ${String(item.framebooksItemId)} AND tenant_id::text = ${String(tenantId)} LIMIT 1`
        )[0];

        if (!fbItem) continue;

        const curFbStock = parseFloat(fbItem.quantity || 0);
        const curWooStock = item.wooStock || 0;
        let finalStock = curFbStock;

        // Apply Winner Policy
        const winner = item.winner || defaultWinner;
        if (winner === "woo" && curWooStock !== curFbStock) {
          // WooCommerce wins: adjust Framebooks stock
          const diff = curWooStock - curFbStock;
          await recordStockMovements(
            tenantId,
            [
              {
                inventoryId: fbItem.id,
                changeQty: diff,
                reason: "correction",
                referenceType: "woocommerce_sync",
                referenceId: `WOO-INIT-${item.wooProductId}`,
                notes: `Initial SKU mapping sync: WooCommerce stock (${curWooStock}) took precedence over Framebooks (${curFbStock})`,
              },
            ],
            { id: userId }
          );
          finalStock = curWooStock;
        } else if (winner === "framebooks" && curWooStock !== curFbStock) {
          // Framebooks wins: push absolute quantity to WooCommerce
          finalStock = curFbStock;
          const endpoint =
            item.wooVariationId && item.wooVariationId > 0
              ? `/products/${item.wooProductId}/variations/${item.wooVariationId}`
              : `/products/${item.wooProductId}`;

          await executeWooRequest(c.store_url, key, secret, endpoint, {
            method: "PUT",
            body: {
              manage_stock: true,
              stock_quantity: curFbStock,
            },
          }).catch(() => {});
        }

        const hash = computeProductContentHash({
          sku: item.sku,
          name: fbItem.item_name,
          price: parseFloat(fbItem.selling_price || 0),
          stock: finalStock,
        });

        await sql`
          INSERT INTO woocommerce_product_mappings (
            tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
            last_synced_stock, content_hash, sync_status, last_synced_at, updated_at
          ) VALUES (
            ${tenantId}, ${fbItem.id}, ${item.wooProductId}, ${item.wooVariationId || 0}, ${item.sku},
            ${finalStock}, ${hash}, 'synced', NOW(), NOW()
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

        linkedCount++;
      }

      // --- 2. ACTION: IMPORT WOO-ONLY PRODUCT INTO FRAMEBOOKS ---
      if (item.action === "import" && item.wooProductId) {
        const cleanSku = (item.sku || "").trim().toUpperCase() || `SKU-WOO-${item.wooProductId}`;
        const cleanName = item.wooProductName || `WooCommerce Product #${item.wooProductId}`;
        const price = item.wooPrice || 0;
        const initialStock = item.wooStock || 0;

        // Insert into Framebooks admin_inventory
        const insertRes = await sql`
          INSERT INTO admin_inventory (
            tenant_id, item_name, category, sku, selling_price, cost_price,
            quantity, status, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${cleanName}, 'WooCommerce Import', ${cleanSku}, ${price}, ${price},
            ${initialStock}, ${initialStock <= 0 ? 'Out of Stock' : 'Available'}, NOW(), NOW()
          )
          RETURNING id
        `;

        const newInvId = Number(insertRes[0].id);

        // Record initial inventory stock movement
        await sql`
          INSERT INTO stock_movements (
            tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, notes, created_at
          ) VALUES (
            ${tenantId}, ${newInvId}, ${initialStock}, 0, ${initialStock}, 'received',
            'woocommerce_sync', ${`WOO-IMP-${item.wooProductId}`}, ${userId}, 'Imported from WooCommerce initial sync', NOW()
          )
        `.catch(() => {});

        const hash = computeProductContentHash({
          sku: cleanSku,
          name: cleanName,
          price,
          stock: initialStock,
        });

        await sql`
          INSERT INTO woocommerce_product_mappings (
            tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
            last_synced_stock, content_hash, sync_status, last_synced_at, updated_at
          ) VALUES (
            ${tenantId}, ${newInvId}, ${item.wooProductId}, ${item.wooVariationId || 0}, ${cleanSku},
            ${initialStock}, ${hash}, 'synced', NOW(), NOW()
          )
        `;

        importedCount++;
      }

      // --- 3. ACTION: PUSH FRAMEBOOKS-ONLY PRODUCT TO WOOCOMMERCE ---
      if (item.action === "push_to_woo" && item.framebooksItemId) {
        const fbItem = (
          await sql`SELECT id, item_name, category, sku, selling_price, quantity FROM admin_inventory WHERE id::text = ${String(item.framebooksItemId)} AND tenant_id::text = ${String(tenantId)} LIMIT 1`
        )[0];

        if (!fbItem) continue;

        const curStock = parseFloat(fbItem.quantity || 0);
        const cleanSku = (fbItem.sku || "").trim().toUpperCase();

        const createRes = await executeWooRequest<{ id: number }>(
          c.store_url,
          key,
          secret,
          "/products",
          {
            method: "POST",
            body: {
              name: fbItem.item_name,
              type: "simple",
              regular_price: String(fbItem.selling_price || 0),
              sku: cleanSku,
              manage_stock: true,
              stock_quantity: curStock,
              status: "publish",
            },
          }
        );

        if (createRes.success && createRes.data?.id) {
          const wooId = createRes.data.id;
          const hash = computeProductContentHash({
            sku: cleanSku,
            name: fbItem.item_name,
            price: parseFloat(fbItem.selling_price || 0),
            stock: curStock,
          });

          await sql`
            INSERT INTO woocommerce_product_mappings (
              tenant_id, inventory_id, woo_product_id, woo_variation_id, woo_sku,
              last_synced_stock, content_hash, sync_status, last_synced_at, updated_at
            ) VALUES (
              ${tenantId}, ${fbItem.id}, ${wooId}, 0, ${cleanSku},
              ${curStock}, ${hash}, 'synced', NOW(), NOW()
            )
            ON CONFLICT (tenant_id, inventory_id) DO UPDATE SET
              woo_product_id = EXCLUDED.woo_product_id,
              woo_variation_id = 0,
              woo_sku = EXCLUDED.woo_sku,
              last_synced_stock = EXCLUDED.last_synced_stock,
              content_hash = EXCLUDED.content_hash,
              sync_status = 'synced',
              last_synced_at = NOW(),
              updated_at = NOW()
          `;

          pushedCount++;
        }
      }
    }

    // Log batch mapping execution
    await sql`
      INSERT INTO woocommerce_sync_logs (
        tenant_id, direction, entity_type, entity_id, status, details, created_at
      ) VALUES (
        ${tenantId}, 'inbound', 'product', 'SKU_WIZARD_BATCH', 'success',
        ${`SKU Wizard Applied: ${linkedCount} linked, ${importedCount} imported, ${pushedCount} pushed, ${skippedCount} skipped.`},
        NOW()
      )
    `;

    await logSystemAction(
      `WooCommerce SKU Mapping Applied: Linked ${linkedCount}, Imported ${importedCount}, Pushed ${pushedCount}`
    );

    revalidatePath("/settings/integrations");
    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/inventory");

    return {
      success: true,
      linkedCount,
      importedCount,
      pushedCount,
      skippedCount,
    };
  } catch (err: any) {
    console.error("[applySkuMappingsBatchAction Error]", err);
    return {
      success: false,
      linkedCount: 0,
      importedCount: 0,
      pushedCount: 0,
      skippedCount: 0,
      error: err.message || "Failed to apply SKU mappings.",
    };
  }
}
