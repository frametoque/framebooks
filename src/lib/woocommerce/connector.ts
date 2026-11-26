import { executeWooRequest } from "./client.ts";
import { computeProductContentHash } from "./mapping-service.ts";

export interface ChannelStockUpdateItem {
  inventoryId: number;
  sku: string;
  quantity: number; // ABSOLUTE count, never relative
  sellingPrice?: number;
  itemName?: string;
  wooProductId?: number;
  wooVariationId?: number;
}

export interface ChannelPushResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors?: Array<{ sku: string; error: string }>;
  details?: string;
}

export interface ChannelConnector {
  channelName: string;
  pushStockUpdates(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    items: ChannelStockUpdateItem[]
  ): Promise<ChannelPushResult>;
}

/**
 * Loop prevention: checks if an action originated from WooCommerce sync.
 * Changes tagged with 'woocommerce' or 'woocommerce_sync' must never be re-pushed.
 */
export function isLoopOriginated(source?: string): boolean {
  if (!source) return false;
  const s = source.toLowerCase();
  return s === "woocommerce" || s === "woocommerce_sync" || s.startsWith("woo_");
}

/**
 * Builds the payload for WooCommerce batch endpoints.
 * STRICT ENFORCEMENT: ONLY writes absolute stock quantity and manage_stock: true.
 * NEVER writes regular_price, name, description, or other metadata to WooCommerce.
 */
export function buildWooBatchPayload(
  items: ChannelStockUpdateItem[]
): {
  simpleUpdates: Array<{
    id: number;
    manage_stock: boolean;
    stock_quantity: number;
  }>;
  variationUpdates: Map<
    number,
    Array<{
      id: number;
      manage_stock: boolean;
      stock_quantity: number;
    }>
  >;
} {
  const simpleUpdates: Array<{
    id: number;
    manage_stock: boolean;
    stock_quantity: number;
  }> = [];

  const variationUpdates = new Map<
    number,
    Array<{
      id: number;
      manage_stock: boolean;
      stock_quantity: number;
    }>
  >();

  for (const item of items) {
    if (!item.wooProductId) continue;

    const isVariation = Boolean(item.wooVariationId && item.wooVariationId > 0);

    if (!isVariation) {
      // Simple product: only write stock_quantity & manage_stock
      simpleUpdates.push({
        id: item.wooProductId,
        manage_stock: true,
        stock_quantity: Math.max(0, Math.round(item.quantity)),
      });
    } else {
      // Variation product: only write stock_quantity & manage_stock
      const parentId = item.wooProductId;
      const varList = variationUpdates.get(parentId) || [];
      varList.push({
        id: item.wooVariationId,
        manage_stock: true,
        stock_quantity: Math.max(0, Math.round(item.quantity)),
      });
      variationUpdates.set(parentId, varList);
    }
  }

  return { simpleUpdates, variationUpdates };
}

export class WooCommerceChannelConnector implements ChannelConnector {
  public channelName = "woocommerce";

  /**
   * Pushes absolute inventory counts ONLY to WooCommerce in batches.
   * Product names, prices, categories, and descriptions are never touched.
   */
  async pushStockUpdates(
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    items: ChannelStockUpdateItem[]
  ): Promise<ChannelPushResult> {
    if (!items || items.length === 0) {
      return { success: true, syncedCount: 0, failedCount: 0 };
    }

    const { simpleUpdates, variationUpdates } = buildWooBatchPayload(items);

    let syncedCount = 0;
    let failedCount = 0;
    const errors: Array<{ sku: string; error: string }> = [];

    // 1. Process simple products in batches of 25 (WooCommerce max safe limit is 50-100)
    const BATCH_SIZE = 25;
    for (let i = 0; i < simpleUpdates.length; i += BATCH_SIZE) {
      const slice = simpleUpdates.slice(i, i + BATCH_SIZE);
      const res = await executeWooRequest(
        storeUrl,
        consumerKey,
        consumerSecret,
        "/products/batch",
        {
          method: "POST",
          body: { update: slice },
          timeoutMs: 20000,
        }
      );

      if (res.success && res.data) {
        const updated = res.data.update || [];
        syncedCount += updated.length;
      } else {
        failedCount += slice.length;
        errors.push({
          sku: `batch_${i / BATCH_SIZE + 1}`,
          error: res.error || "Batch simple product push failed",
        });
      }
    }

    // 2. Process variations grouped by parent product ID
    for (const [parentId, variations] of variationUpdates.entries()) {
      for (let i = 0; i < variations.length; i += BATCH_SIZE) {
        const slice = variations.slice(i, i + BATCH_SIZE);
        const res = await executeWooRequest(
          storeUrl,
          consumerKey,
          consumerSecret,
          `/products/${parentId}/variations/batch`,
          {
            method: "POST",
            body: { update: slice },
            timeoutMs: 20000,
          }
        );

        if (res.success && res.data) {
          const updated = res.data.update || [];
          syncedCount += updated.length;
        } else {
          failedCount += slice.length;
          errors.push({
            sku: `parent_${parentId}`,
            error: res.error || `Batch variation push failed for parent #${parentId}`,
          });
        }
      }
    }

    const overallSuccess = failedCount === 0;
    return {
      success: overallSuccess,
      syncedCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      details: `Pushed ${syncedCount} items to WooCommerce (${failedCount} failed).`,
    };
  }
}

export const defaultWooConnector = new WooCommerceChannelConnector();
