import crypto from "crypto";

export type SkuMatchCategory =
  | "matched"
  | "woo_only"
  | "framebooks_only"
  | "missing_sku"
  | "duplicate_sku";

export type SkuSyncAction = "link" | "import" | "push_to_woo" | "skip";
export type SkuWinner = "framebooks" | "woo";

export interface WooProductItem {
  wooProductId: number;
  wooVariationId: number;
  name: string;
  sku: string;
  category?: string;
  price: number;
  stockQuantity: number;
  manageStock: boolean;
  type: string;
  status: string;
}

export interface FramebooksProductItem {
  id: number;
  name: string;
  sku: string;
  category?: string;
  sellingPrice: number;
  costPrice: number;
  quantity: number;
  status: string;
}

export interface SkuComparisonRow {
  rowId: string;
  sku: string;
  name: string;
  category: SkuMatchCategory;
  suggestedAction: SkuSyncAction;
  selectedAction: SkuSyncAction;
  winner: SkuWinner;

  framebooksItemId?: number;
  framebooksItemName?: string;
  framebooksStock?: number;
  framebooksPrice?: number;

  wooProductId?: number;
  wooVariationId?: number;
  wooProductName?: string;
  wooStock?: number;
  wooPrice?: number;
  isVariable?: boolean;

  isCurrentlyMapped?: boolean;
}

export interface SkuCatalogComparisonResult {
  rows: SkuComparisonRow[];
  summary: {
    total: number;
    matched: number;
    wooOnly: number;
    framebooksOnly: number;
    missingSku: number;
    duplicateSku: number;
    currentlyMapped: number;
  };
}

/**
 * Extracts the correct LKR price for a WooCommerce product or variation.
 * Checks multi-currency meta keys (WCPBC, CURCY, Aelia, WOOCS, WPML, custom LKR fields),
 * formatted price_html with LKR/Rs symbols, and falls back to base price.
 */
export function extractWooLkrPrice(productOrVar: any, parentProduct?: any): number {
  if (!productOrVar) return 0;

  // 1. Try extracting from variation / product's own meta_data & parent meta_data
  const ownMeta = Array.isArray(productOrVar.meta_data) ? productOrVar.meta_data : [];
  const parentMeta = Array.isArray(parentProduct?.meta_data) ? parentProduct.meta_data : [];
  const combinedMeta = [...ownMeta, ...parentMeta];

  // Specific high-priority LKR keys used by WooCommerce plugins
  const specificKeys = [
    "_price_LKR",
    "_regular_price_LKR",
    "_sale_price_LKR",
    "_price_lkr",
    "_regular_price_lkr",
    "_sale_price_lkr",
    "price_LKR",
    "regular_price_LKR",
    "sale_price_LKR",
    "price_lkr",
    "regular_price_lkr",
    "_lkr_price",
    "lkr_price",
    "_lkr_regular_price",
    "lkr_regular_price",
    "_woocs_price_LKR",
    "_woocs_regular_price_LKR",
    "woocs_price_LKR",
    "woocs_regular_price_LKR",
    "_wcpbc_price_lkr",
    "_wcpbc_regular_price_lkr",
    "wcpbc_price_lkr",
    "_wcpbc_pricing_lkr",
    "_custom_price_lkr",
    "custom_price_lkr",
  ];

  for (const key of specificKeys) {
    const item = combinedMeta.find(
      (m: any) => m && m.key && String(m.key).toLowerCase() === key.toLowerCase()
    );
    if (item && item.value !== undefined && item.value !== null && item.value !== "") {
      const val = parseFloat(String(item.value).replace(/,/g, ""));
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  // Multi-currency dictionary / JSON objects in meta (CURCY, Aelia, WOOCS)
  const dictKeys = [
    "_wmc_custom_price",
    "wmc_custom_price",
    "_regular_currency_prices",
    "regular_currency_prices",
    "_currency_prices",
    "currency_prices",
    "_custom_currency_prices",
    "custom_currency_prices",
    "_woocs_prices",
    "woocs_prices",
    "_wcml_custom_prices",
  ];

  for (const dKey of dictKeys) {
    const item = combinedMeta.find(
      (m: any) => m && m.key && String(m.key).toLowerCase() === dKey.toLowerCase()
    );
    if (item && item.value) {
      let parsed = item.value;
      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // May be serialized PHP string, e.g. s:3:"LKR";s:4:"1350"
          const match = parsed.match(/(?:LKR|lkr)["']?[;:](?:s:\d+:["']|i:)?([0-9.,]+)/i);
          if (match) {
            const val = parseFloat(match[1].replace(/,/g, ""));
            if (!isNaN(val) && val > 0) return val;
          }
        }
      }
      if (parsed && typeof parsed === "object") {
        const rawLkr =
          parsed.LKR ??
          parsed.lkr ??
          parsed["LKR_price"] ??
          parsed["lkr_price"] ??
          parsed["price_LKR"] ??
          parsed["regular_price_LKR"];
        if (rawLkr !== undefined && rawLkr !== null && rawLkr !== "") {
          const val = parseFloat(String(rawLkr).replace(/,/g, ""));
          if (!isNaN(val) && val > 0) {
            return val;
          }
        }
      }
    }
  }

  // Any meta key containing 'lkr' with a numeric price
  for (const m of combinedMeta) {
    if (m && typeof m.key === "string" && m.key.toLowerCase().includes("lkr")) {
      if (m.value !== undefined && m.value !== null && m.value !== "") {
        if (typeof m.value === "object") {
          const inner = m.value.price || m.value.regular_price || m.value.amount || m.value.value;
          if (inner !== undefined) {
            const val = parseFloat(String(inner).replace(/,/g, ""));
            if (!isNaN(val) && val > 0) return val;
          }
        } else {
          const val = parseFloat(String(m.value).replace(/,/g, ""));
          if (!isNaN(val) && val > 0) {
            return val;
          }
        }
      }
    }
  }

  // Parse HTML price string if available (e.g. "Rs 1,350.00" or "LKR 1,350.00" or "රු 1,350.00")
  const priceHtml = productOrVar.price_html || parentProduct?.price_html || "";
  if (priceHtml && typeof priceHtml === "string") {
    if (/(?:LKR|Rs|₨|&#8360;|&#x20A8;|රු)/i.test(priceHtml)) {
      // Strip HTML tags and entities to get clean text e.g. "Rs 1,350.00"
      const cleanText = priceHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#8360;|&#x20A8;/gi, "Rs");
      const match = cleanText.match(
        /(?:LKR|Rs|₨|රු)[.\s]*([0-9,]+(?:\.[0-9]+)?)/i
      );
      if (match) {
        const val = parseFloat(match[1].replace(/,/g, ""));
        if (!isNaN(val) && val > 0) {
          return val;
        }
      }
    }
  }

  // Fall back to standard price or regular_price (e.g., if ?currency=LKR converted it or base is LKR)
  const fallback = parseFloat(productOrVar.price || productOrVar.regular_price || 0);
  return isNaN(fallback) ? 0 : fallback;
}

/**
 * Computes a deterministic SHA-256 content hash of product attributes.
 */
export function computeProductContentHash(data: {
  sku: string;
  name: string;
  price: number;
  stock: number;
}): string {
  const normalized = `${data.sku.trim().toUpperCase()}|${data.name.trim()}|${Number(data.price).toFixed(2)}|${Number(data.stock).toFixed(2)}`;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Compares Framebooks and WooCommerce products by SKU, classifying each item.
 */
export function classifySkuCatalog(
  framebooksProducts: FramebooksProductItem[],
  wooProducts: WooProductItem[],
  existingMappedInventoryIds: Set<number> = new Set(),
  defaultWinner: SkuWinner = "framebooks"
): SkuCatalogComparisonResult {
  const rows: SkuComparisonRow[] = [];

  // 1. Detect duplicate SKUs in Framebooks
  const fbSkuCounts = new Map<string, FramebooksProductItem[]>();
  for (const p of framebooksProducts) {
    const rawSku = (p.sku || "").trim().toUpperCase();
    if (!rawSku) continue;
    const list = fbSkuCounts.get(rawSku) || [];
    list.push(p);
    fbSkuCounts.set(rawSku, list);
  }

  // 2. Detect duplicate SKUs in WooCommerce
  const wooSkuCounts = new Map<string, WooProductItem[]>();
  for (const w of wooProducts) {
    const rawSku = (w.sku || "").trim().toUpperCase();
    if (!rawSku) continue;
    const list = wooSkuCounts.get(rawSku) || [];
    list.push(w);
    wooSkuCounts.set(rawSku, list);
  }

  // Set of handled product identifiers
  const handledFbIds = new Set<number>();
  const handledWooKeys = new Set<string>();

  // Helper for Woo identifier key
  const getWooKey = (w: WooProductItem) => `${w.wooProductId}_${w.wooVariationId}`;

  // Process Duplicate SKUs on Framebooks side
  for (const [sku, items] of fbSkuCounts.entries()) {
    if (items.length > 1) {
      for (const item of items) {
        handledFbIds.add(item.id);
        rows.push({
          rowId: `fb_dup_${item.id}`,
          sku,
          name: item.name,
          category: "duplicate_sku",
          suggestedAction: "skip",
          selectedAction: "skip",
          winner: defaultWinner,
          framebooksItemId: item.id,
          framebooksItemName: item.name,
          framebooksStock: item.quantity,
          framebooksPrice: item.sellingPrice,
        });
      }
    }
  }

  // Process Duplicate SKUs on WooCommerce side
  for (const [sku, items] of wooSkuCounts.entries()) {
    if (items.length > 1) {
      for (const item of items) {
        handledWooKeys.add(getWooKey(item));
        rows.push({
          rowId: `woo_dup_${getWooKey(item)}`,
          sku,
          name: item.name,
          category: "duplicate_sku",
          suggestedAction: "skip",
          selectedAction: "skip",
          winner: defaultWinner,
          wooProductId: item.wooProductId,
          wooVariationId: item.wooVariationId,
          wooProductName: item.name,
          wooStock: item.stockQuantity,
          wooPrice: item.price,
          isVariable: item.wooVariationId > 0,
        });
      }
    }
  }

  // Process Missing SKU on Framebooks side
  for (const p of framebooksProducts) {
    const rawSku = (p.sku || "").trim();
    if (!rawSku) {
      handledFbIds.add(p.id);
      rows.push({
        rowId: `fb_nosku_${p.id}`,
        sku: "NO-SKU",
        name: p.name,
        category: "missing_sku",
        suggestedAction: "skip",
        selectedAction: "skip",
        winner: defaultWinner,
        framebooksItemId: p.id,
        framebooksItemName: p.name,
        framebooksStock: p.quantity,
        framebooksPrice: p.sellingPrice,
      });
    }
  }

  // Process Missing SKU on WooCommerce side
  for (const w of wooProducts) {
    const rawSku = (w.sku || "").trim();
    if (!rawSku) {
      handledWooKeys.add(getWooKey(w));
      rows.push({
        rowId: `woo_nosku_${getWooKey(w)}`,
        sku: "NO-SKU",
        name: w.name,
        category: "missing_sku",
        suggestedAction: "skip",
        selectedAction: "skip",
        winner: defaultWinner,
        wooProductId: w.wooProductId,
        wooVariationId: w.wooVariationId,
        wooProductName: w.name,
        wooStock: w.stockQuantity,
        wooPrice: w.price,
        isVariable: w.wooVariationId > 0,
      });
    }
  }

  // Match by unique SKU
  for (const p of framebooksProducts) {
    if (handledFbIds.has(p.id)) continue;
    const cleanSku = (p.sku || "").trim().toUpperCase();
    const wooMatches = wooSkuCounts.get(cleanSku);

    if (wooMatches && wooMatches.length === 1) {
      const woo = wooMatches[0];
      handledFbIds.add(p.id);
      handledWooKeys.add(getWooKey(woo));

      const isMapped = existingMappedInventoryIds.has(p.id);

      rows.push({
        rowId: `match_${p.id}_${getWooKey(woo)}`,
        sku: cleanSku,
        name: p.name || woo.name,
        category: "matched",
        suggestedAction: "link",
        selectedAction: "link",
        winner: defaultWinner,
        framebooksItemId: p.id,
        framebooksItemName: p.name,
        framebooksStock: p.quantity,
        framebooksPrice: p.sellingPrice,
        wooProductId: woo.wooProductId,
        wooVariationId: woo.wooVariationId,
        wooProductName: woo.name,
        wooStock: woo.stockQuantity,
        wooPrice: woo.price,
        isVariable: woo.wooVariationId > 0,
        isCurrentlyMapped: isMapped,
      });
    } else if (!wooMatches || wooMatches.length === 0) {
      // Framebooks Only
      handledFbIds.add(p.id);
      rows.push({
        rowId: `fb_only_${p.id}`,
        sku: cleanSku,
        name: p.name,
        category: "framebooks_only",
        suggestedAction: "push_to_woo",
        selectedAction: "push_to_woo",
        winner: "framebooks",
        framebooksItemId: p.id,
        framebooksItemName: p.name,
        framebooksStock: p.quantity,
        framebooksPrice: p.sellingPrice,
        isCurrentlyMapped: existingMappedInventoryIds.has(p.id),
      });
    }
  }

  // Process Remaining WooCommerce Only
  for (const w of wooProducts) {
    if (handledWooKeys.has(getWooKey(w))) continue;
    const cleanSku = (w.sku || "").trim().toUpperCase();

    rows.push({
      rowId: `woo_only_${getWooKey(w)}`,
      sku: cleanSku,
      name: w.name,
      category: "woo_only",
      suggestedAction: "import",
      selectedAction: "import",
      winner: "woo",
      wooProductId: w.wooProductId,
      wooVariationId: w.wooVariationId,
      wooProductName: w.name,
      wooStock: w.stockQuantity,
      wooPrice: w.price,
      isVariable: w.wooVariationId > 0,
    });
  }

  // Summary counts
  const summary = {
    total: rows.length,
    matched: rows.filter((r) => r.category === "matched").length,
    wooOnly: rows.filter((r) => r.category === "woo_only").length,
    framebooksOnly: rows.filter((r) => r.category === "framebooks_only").length,
    missingSku: rows.filter((r) => r.category === "missing_sku").length,
    duplicateSku: rows.filter((r) => r.category === "duplicate_sku").length,
    currentlyMapped: rows.filter((r) => r.isCurrentlyMapped).length,
  };

  return { rows, summary };
}
