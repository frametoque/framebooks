export type ConflictPolicy = "framebooks_wins" | "woo_wins" | "newest_wins";

export interface ConflictItemData {
  stock: number;
  updatedAt?: string | Date | number;
}

export interface ConflictResolutionResult {
  winner: "framebooks" | "woo";
  targetStock: number;
  reason: string;
}

/**
 * Resolves a stock discrepancy according to tenant's configured conflict resolution policy.
 */
export function resolveConflict(
  policy: ConflictPolicy,
  fbData: ConflictItemData,
  wooData: ConflictItemData
): ConflictResolutionResult {
  if (policy === "framebooks_wins") {
    return {
      winner: "framebooks",
      targetStock: fbData.stock,
      reason: "Policy: Framebooks wins (In-Store POS count takes precedence)",
    };
  }

  if (policy === "woo_wins") {
    return {
      winner: "woo",
      targetStock: wooData.stock,
      reason: "Policy: WooCommerce wins (Online store count takes precedence)",
    };
  }

  // newest_wins: compare timestamps
  const fbTime = fbData.updatedAt ? new Date(fbData.updatedAt).getTime() : 0;
  const wooTime = wooData.updatedAt ? new Date(wooData.updatedAt).getTime() : 0;

  if (wooTime > fbTime) {
    return {
      winner: "woo",
      targetStock: wooData.stock,
      reason: `Policy: Newest wins (WooCommerce updated at ${new Date(wooTime).toISOString()} > Framebooks at ${new Date(fbTime).toISOString()})`,
    };
  }

  return {
    winner: "framebooks",
    targetStock: fbData.stock,
    reason: `Policy: Newest wins (Framebooks updated at ${new Date(fbTime).toISOString()} >= WooCommerce at ${new Date(wooTime).toISOString()})`,
  };
}

export interface ProductDriftRecord {
  inventoryId: number;
  wooProductId: number;
  wooVariationId: number;
  sku: string;
  name: string;
  fbStock: number;
  wooStock: number;
  drift: number;
  resolution: ConflictResolutionResult;
}

/**
 * Compares mapped items against live WooCommerce items and identifies stock drift.
 */
export function detectCatalogDrift(
  mappedItems: Array<{
    inventoryId: number;
    wooProductId: number;
    wooVariationId: number;
    sku: string;
    name: string;
    fbStock: number;
    fbUpdatedAt?: string | Date;
  }>,
  liveWooItems: Map<
    string,
    {
      stock: number;
      updatedAt?: string;
    }
  >,
  policy: ConflictPolicy
): ProductDriftRecord[] {
  const drifts: ProductDriftRecord[] = [];

  for (const m of mappedItems) {
    const key = `${m.wooProductId}_${m.wooVariationId || 0}`;
    const live = liveWooItems.get(key) || liveWooItems.get(m.sku.toUpperCase());
    if (!live) continue;

    if (m.fbStock !== live.stock) {
      const resolution = resolveConflict(
        policy,
        { stock: m.fbStock, updatedAt: m.fbUpdatedAt },
        { stock: live.stock, updatedAt: live.updatedAt }
      );

      drifts.push({
        inventoryId: m.inventoryId,
        wooProductId: m.wooProductId,
        wooVariationId: m.wooVariationId,
        sku: m.sku,
        name: m.name,
        fbStock: m.fbStock,
        wooStock: live.stock,
        drift: m.fbStock - live.stock,
        resolution,
      });
    }
  }

  return drifts;
}
