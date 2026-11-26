import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  encryptWooCredential,
  decryptWooCredential,
  maskWooKey,
  verifyWooWebhookSignature,
  generateTenantWebhookSecret,
} from "./encryption.ts";
import { normalizeStoreUrl } from "./client.ts";

test("WooCommerce Credential Encryption & Security (AES-256-GCM)", async (t) => {
  await t.test("encrypts and decrypts consumer keys and secrets round-trip", () => {
    const tenantId = 101;
    const consumerKey = "ck_a1b2c3d4e5f678901234567890abcdef12345678";
    const consumerSecret = "cs_9876543210fedcba09876543210fedcba0987654";

    const encryptedKey = encryptWooCredential(consumerKey, tenantId);
    const encryptedSecret = encryptWooCredential(consumerSecret, tenantId);

    assert.ok(encryptedKey.startsWith("v1:"), "Ciphertext must specify key version prefix");
    assert.notEqual(encryptedKey, consumerKey, "Ciphertext must not be plaintext");
    assert.notEqual(encryptedSecret, consumerSecret, "Ciphertext must not be plaintext");

    const decryptedKey = decryptWooCredential(encryptedKey, tenantId);
    const decryptedSecret = decryptWooCredential(encryptedSecret, tenantId);

    assert.equal(decryptedKey, consumerKey, "Decrypted key must match original plaintext");
    assert.equal(decryptedSecret, consumerSecret, "Decrypted secret must match original plaintext");
  });

  await t.test("enforces random 96-bit IV per encryption (non-deterministic ciphertext)", () => {
    const tenantId = 101;
    const secret = "cs_same_secret_encrypted_multiple_times";

    const enc1 = encryptWooCredential(secret, tenantId);
    const enc2 = encryptWooCredential(secret, tenantId);

    // Two encryptions of the same plaintext MUST NOT yield identical ciphertext
    assert.notEqual(enc1, enc2, "Fresh random IV must produce distinct ciphertexts");

    // Both must decrypt cleanly
    assert.equal(decryptWooCredential(enc1, tenantId), secret);
    assert.equal(decryptWooCredential(enc2, tenantId), secret);
  });

  await t.test("guarantees cross-tenant cryptographic isolation (Tenant A cannot decrypt Tenant B's data)", () => {
    const tenantA = 201;
    const tenantB = 202;
    const secretA = "cs_secret_belonging_to_tenant_a";

    const encryptedA = encryptWooCredential(secretA, tenantA);

    // Attempting to decrypt Tenant A's ciphertext with Tenant B's context must fail
    assert.throws(
      () => {
        decryptWooCredential(encryptedA, tenantB);
      },
      /Failed to decrypt|authentication tag mismatch/i,
      "Cross-tenant decryption attempt must be rejected"
    );
  });

  await t.test("detects ciphertext tampering or payload corruption", () => {
    const tenantId = 101;
    const key = "ck_test_tamper_detection";
    const encrypted = encryptWooCredential(key, tenantId);

    const parts = encrypted.split(":");
    // Tamper with the encrypted bytes:
    const tamperedEncryptedHex = parts[2].slice(0, -2) + (parts[2].slice(-2) === "aa" ? "bb" : "aa");
    const tamperedCiphertext = `${parts[0]}:${parts[1]}:${tamperedEncryptedHex}:${parts[3]}`;

    assert.throws(
      () => {
        decryptWooCredential(tamperedCiphertext, tenantId);
      },
      /Failed to decrypt|authentication tag mismatch/i,
      "Tampered ciphertext must fail authentication tag check"
    );
  });

  await t.test("masks consumer keys and secrets without leaking sensitive data", () => {
    assert.equal(maskWooKey("ck_9a8b7c6d5e4f3a2b1c"), "ck_••••2b1c");
    assert.equal(maskWooKey("cs_112233445566778899"), "cs_••••8899");
    assert.equal(maskWooKey("short"), "••••••••");
    assert.equal(maskWooKey(""), "");
    assert.equal(maskWooKey(null), "");
  });

  await t.test("verifies WooCommerce Webhook HMAC-SHA256 signatures", () => {
    const secret = generateTenantWebhookSecret();
    const payload = JSON.stringify({ id: 9942, status: "completed", total: "15000.00" });

    // Compute expected signature
    const validSignature = crypto.createHmac("sha256", secret).update(payload).digest("base64");

    // Valid signature must pass
    const isValid = verifyWooWebhookSignature(payload, validSignature, secret);
    assert.equal(isValid, true, "Valid HMAC signature must verify successfully");

    // Altered payload must fail
    const tamperedPayload = JSON.stringify({ id: 9942, status: "cancelled", total: "15000.00" });
    const isTamperedValid = verifyWooWebhookSignature(tamperedPayload, validSignature, secret);
    assert.equal(isTamperedValid, false, "Altered webhook payload must be rejected");

    // Invalid signature must fail
    const isBadSigValid = verifyWooWebhookSignature(payload, "invalid_signature_base64", secret);
    assert.equal(isBadSigValid, false, "Mismatched signature must be rejected");
  });
});

test("WooCommerce Store URL Validation & Normalization", async (t) => {
  await t.test("normalizes valid URLs and removes trailing slashes", () => {
    const res1 = normalizeStoreUrl("https://example-shop.com/");
    assert.equal(res1.valid, true);
    assert.equal(res1.normalized, "https://example-shop.com");

    const res2 = normalizeStoreUrl("store.mybusiness.lk/shop///");
    assert.equal(res2.valid, true);
    assert.equal(res2.normalized, "https://store.mybusiness.lk/shop");
  });

  await t.test("rejects invalid or blank URLs", () => {
    assert.equal(normalizeStoreUrl("").valid, false);
    assert.equal(normalizeStoreUrl("not a url").valid, false);
  });
});

test("WooCommerce Setup Guide & Troubleshooting Content (Localization & Completeness)", async (t) => {
  const { WOO_GUIDE_CONTENT, getWebhookDeliveryUrl, WOO_CORE_TOPICS } = await import("./guide-content.ts");

  await t.test("contains all 6 mandatory onboarding wizard steps in order", () => {
    assert.equal(WOO_GUIDE_CONTENT.steps.length, 6, "Must define exactly 6 guided wizard steps");

    const expectedSteps = [
      { step: 1, id: "prerequisites", hasWpPath: true },
      { step: 2, id: "stock_management", hasWpPath: true },
      { step: 3, id: "api_keys", hasWpPath: true },
      { step: 4, id: "enter_credentials", hasWpPath: false },
      { step: 5, id: "webhooks", hasWpPath: true },
      { step: 6, id: "sync_options", hasWpPath: false },
    ];

    expectedSteps.forEach((exp, idx) => {
      const actual = WOO_GUIDE_CONTENT.steps[idx];
      assert.equal(actual.step, exp.step);
      assert.equal(actual.id, exp.id);
      assert.ok(actual.title.length > 0, "Step must have a title");
      assert.ok(actual.fullInstruction.length > 0, "Step must have detailed instruction text");
      assert.ok(actual.checkLabel.length > 0, "Step must have verification label");
      if (exp.hasWpPath) {
        assert.ok(actual.wpPath && actual.wpPath.length > 0, `Step ${exp.step} must have WordPress navigation path`);
      }
    });
  });

  await t.test("troubleshooting guide maps all major error codes with symptoms and fixes", () => {
    const errorCodes = WOO_GUIDE_CONTENT.troubleshooting.map((t) => t.errorCode);
    assert.ok(errorCodes.some((c) => c.includes("401")), "Must cover 401 invalid keys");
    assert.ok(errorCodes.some((c) => c.includes("404")), "Must cover 404 rest_no_route");
    assert.ok(errorCodes.some((c) => c.includes("SSL")), "Must cover SSL errors");
    assert.ok(errorCodes.some((c) => c.includes("403") || c.includes("TIMEOUT")), "Must cover firewall/timeout");
    assert.ok(errorCodes.some((c) => c.includes("SKUS")), "Must cover missing/duplicate SKUs");
    assert.ok(errorCodes.some((c) => c.includes("MANAGE_STOCK")), "Must cover disabled stock management");

    WOO_GUIDE_CONTENT.troubleshooting.forEach((item) => {
      assert.ok(item.title.length > 0);
      assert.ok(item.symptom.length > 0);
      assert.ok(item.fix.length > 0);
    });
  });

  await t.test("FAQs cover core store owner concerns", () => {
    assert.ok(WOO_GUIDE_CONTENT.faqs.length >= 4, "Must define at least 4 FAQs");
    const faqIds = WOO_GUIDE_CONTENT.faqs.map((f) => f.id);
    assert.ok(faqIds.includes("find_keys"), "Must cover where to find keys");
    assert.ok(faqIds.includes("disconnect_anytime"), "Must cover disconnect safety");
    assert.ok(faqIds.includes("stock_behavior"), "Must cover in-store POS stock impact");
    assert.ok(faqIds.includes("conflict_winner"), "Must cover conflict resolution");
  });

  await t.test("resolves correct tenant-scoped webhook delivery URLs and core topics", () => {
    const tenantId = 42;
    const deliveryUrl = getWebhookDeliveryUrl(tenantId);
    assert.ok(deliveryUrl.includes("/api/integrations/woocommerce/webhook/42"));
    assert.equal(WOO_CORE_TOPICS.length, 3);
    assert.deepEqual(WOO_CORE_TOPICS, ["order.created", "order.updated", "product.updated"]);
  });
});

test("WooCommerce SKU Matching Engine & Review Wizard Rules", async (t) => {
  const { classifySkuCatalog, computeProductContentHash } = await import("./mapping-service.ts");

  await t.test("classifies catalog into matched, woo_only, framebooks_only, missing_sku, and duplicate_sku", () => {
    const fbProducts = [
      { id: 1, name: "Wireless Barcode Scanner", sku: "SCN-001", quantity: 20, sellingPrice: 11500, costPrice: 8000, status: "Available" },
      { id: 2, name: "POS Receipt Paper 80mm", sku: "PPR-002", quantity: 50, sellingPrice: 7800, costPrice: 5000, status: "Available" },
      { id: 3, name: "Old Legacy Item Without SKU", sku: "", quantity: 5, sellingPrice: 2000, costPrice: 1000, status: "Available" },
      { id: 4, name: "Duplicate A", sku: "DUP-999", quantity: 10, sellingPrice: 5000, costPrice: 3000, status: "Available" },
      { id: 5, name: "Duplicate B", sku: "DUP-999", quantity: 15, sellingPrice: 5000, costPrice: 3000, status: "Available" },
      { id: 6, name: "POS Stand (Store Only)", sku: "STND-006", quantity: 8, sellingPrice: 15000, costPrice: 10000, status: "Available" },
    ];

    const wooProducts = [
      // Matches SCN-001
      { wooProductId: 101, wooVariationId: 0, name: "Wireless Barcode Scanner", sku: "SCN-001", price: 12000, stockQuantity: 14, manageStock: true, type: "simple", status: "publish" },
      // Matches PPR-002
      { wooProductId: 102, wooVariationId: 0, name: "Thermal Paper Roll 80mm", sku: "PPR-002", price: 8000, stockQuantity: 50, manageStock: true, type: "simple", status: "publish" },
      // Online exclusive item
      { wooProductId: 103, wooVariationId: 0, name: "Wireless Bluetooth Mouse", sku: "MOU-003", price: 5900, stockQuantity: 30, manageStock: true, type: "simple", status: "publish" },
      // Woo product with missing SKU
      { wooProductId: 104, wooVariationId: 0, name: "Promo T-Shirt", sku: "", price: 2500, stockQuantity: 100, manageStock: false, type: "simple", status: "publish" },
    ];

    const mappedSet = new Set<number>([1]); // SCN-001 already mapped
    const comparison = classifySkuCatalog(fbProducts, wooProducts, mappedSet, "framebooks");

    // 1. Matched count
    assert.equal(comparison.summary.matched, 2);
    const matchedScn = comparison.rows.find((r) => r.sku === "SCN-001");
    assert.ok(matchedScn);
    assert.equal(matchedScn.category, "matched");
    assert.equal(matchedScn.suggestedAction, "link");
    assert.equal(matchedScn.isCurrentlyMapped, true);

    // 2. WooCommerce Only count
    assert.equal(comparison.summary.wooOnly, 1);
    const wooOnly = comparison.rows.find((r) => r.sku === "MOU-003");
    assert.ok(wooOnly);
    assert.equal(wooOnly.category, "woo_only");
    assert.equal(wooOnly.suggestedAction, "import");

    // 3. Framebooks Only count
    assert.equal(comparison.summary.framebooksOnly, 1);
    const fbOnly = comparison.rows.find((r) => r.sku === "STND-006");
    assert.ok(fbOnly);
    assert.equal(fbOnly.category, "framebooks_only");
    assert.equal(fbOnly.suggestedAction, "push_to_woo");

    // 4. Missing SKU count (1 from FB, 1 from Woo)
    assert.equal(comparison.summary.missingSku, 2);
    const missingRows = comparison.rows.filter((r) => r.category === "missing_sku");
    assert.equal(missingRows.length, 2);

    // 5. Duplicate SKU count (FB had 2 items with DUP-999)
    assert.equal(comparison.summary.duplicateSku, 2);
    const dupRows = comparison.rows.filter((r) => r.category === "duplicate_sku");
    assert.equal(dupRows.length, 2);
  });

  await t.test("respects initial stock winner policy without silent overwrites", () => {
    const fbProducts = [
      { id: 1, name: "Item A", sku: "SKU-A", quantity: 25, sellingPrice: 5000, costPrice: 3000, status: "Available" },
    ];
    const wooProducts = [
      { wooProductId: 10, wooVariationId: 0, name: "Item A", sku: "SKU-A", price: 5000, stockQuantity: 10, manageStock: true, type: "simple", status: "publish" },
    ];

    // Case 1: Framebooks wins
    const compFbWins = classifySkuCatalog(fbProducts, wooProducts, new Set(), "framebooks");
    assert.equal(compFbWins.rows[0].winner, "framebooks");

    // Case 2: WooCommerce wins
    const compWooWins = classifySkuCatalog(fbProducts, wooProducts, new Set(), "woo");
    assert.equal(compWooWins.rows[0].winner, "woo");
  });

  await t.test("maps variable products by individual variation", () => {
    const fbProducts = [
      { id: 10, name: "T-Shirt (Small)", sku: "TSHIRT-S", quantity: 15, sellingPrice: 3000, costPrice: 1500, status: "Available" },
      { id: 11, name: "T-Shirt (Medium)", sku: "TSHIRT-M", quantity: 20, sellingPrice: 3000, costPrice: 1500, status: "Available" },
    ];

    const wooProducts = [
      { wooProductId: 200, wooVariationId: 201, name: "T-Shirt (Small)", sku: "TSHIRT-S", price: 3000, stockQuantity: 15, manageStock: true, type: "variation", status: "publish" },
      { wooProductId: 200, wooVariationId: 202, name: "T-Shirt (Medium)", sku: "TSHIRT-M", price: 3000, stockQuantity: 12, manageStock: true, type: "variation", status: "publish" },
    ];

    const comp = classifySkuCatalog(fbProducts, wooProducts, new Set());
    assert.equal(comp.summary.matched, 2);

    const smallVar = comp.rows.find((r) => r.sku === "TSHIRT-S");
    assert.equal(smallVar?.wooVariationId, 201);
    assert.equal(smallVar?.isVariable, true);

    const medVar = comp.rows.find((r) => r.sku === "TSHIRT-M");
    assert.equal(medVar?.wooVariationId, 202);
    assert.equal(medVar?.isVariable, true);
  });

  await t.test("computes deterministic product content hashes", () => {
    const hash1 = computeProductContentHash({ sku: "TEST-01", name: "Product 1", price: 1000, stock: 10 });
    const hash2 = computeProductContentHash({ sku: "TEST-01", name: "Product 1", price: 1000, stock: 10 });
    assert.equal(hash1, hash2, "Identical product attributes must generate identical hash");

    const hashChangedStock = computeProductContentHash({ sku: "TEST-01", name: "Product 1", price: 1000, stock: 9 });
    assert.notEqual(hash1, hashChangedStock, "Stock change must generate a new hash");

    const hashChangedPrice = computeProductContentHash({ sku: "TEST-01", name: "Product 1", price: 1200, stock: 10 });
    assert.notEqual(hash1, hashChangedPrice, "Price change must generate a new hash");
  });
});

test("Phase 5: Framebooks -> WooCommerce Push & Loop Prevention", async (t) => {
  const { buildWooBatchPayload, WooCommerceChannelConnector, isLoopOriginated } = await import("./connector.ts");

  await t.test("constructs batch payload with absolute quantities and manage_stock: true (stock only)", () => {
    const items = [
      { inventoryId: 1, sku: "SCN-001", quantity: 18, sellingPrice: 11500, itemName: "Scanner", wooProductId: 101, wooVariationId: 0 },
      { inventoryId: 2, sku: "PPR-002", quantity: 45, sellingPrice: 7800, itemName: "Paper", wooProductId: 102, wooVariationId: 0 },
      { inventoryId: 3, sku: "TSH-S", quantity: 8, sellingPrice: 3500, itemName: "T-Shirt (S)", wooProductId: 200, wooVariationId: 201 },
      { inventoryId: 4, sku: "TSH-M", quantity: 12, sellingPrice: 3500, itemName: "T-Shirt (M)", wooProductId: 200, wooVariationId: 202 },
    ];

    const { simpleUpdates, variationUpdates } = buildWooBatchPayload(items);

    // Simple products - must ONLY have id, manage_stock, and stock_quantity
    assert.equal(simpleUpdates.length, 2);
    assert.deepEqual(simpleUpdates[0], {
      id: 101,
      manage_stock: true,
      stock_quantity: 18,
    });
    assert.deepEqual(simpleUpdates[1], {
      id: 102,
      manage_stock: true,
      stock_quantity: 45,
    });

    // Variations grouped by parent ID 200 - must ONLY have id, manage_stock, and stock_quantity
    assert.equal(variationUpdates.size, 1);
    const parent200 = variationUpdates.get(200);
    assert.ok(parent200);
    assert.equal(parent200.length, 2);
    assert.deepEqual(parent200[0], {
      id: 201,
      manage_stock: true,
      stock_quantity: 8,
    });
    assert.deepEqual(parent200[1], {
      id: 202,
      manage_stock: true,
      stock_quantity: 12,
    });
  });

  await t.test("never pushes negative stock quantity (clamps at 0)", () => {
    const items = [
      { inventoryId: 1, sku: "NEG-01", quantity: -5, sellingPrice: 1000, wooProductId: 500, wooVariationId: 0 },
    ];

    const { simpleUpdates } = buildWooBatchPayload(items);
    assert.equal(simpleUpdates[0].stock_quantity, 0, "Negative quantity must clamp to 0 for WooCommerce");
  });

  await t.test("detects loop-originated sync sources to prevent infinite echo updates", () => {
    // Sync originated (must NOT push)
    assert.equal(isLoopOriginated("woocommerce"), true);
    assert.equal(isLoopOriginated("woocommerce_sync"), true);
    assert.equal(isLoopOriginated("woo_webhook"), true);
    assert.equal(isLoopOriginated("woo_order"), true);

    // Framebooks originated (must push)
    assert.equal(isLoopOriginated("pos"), false);
    assert.equal(isLoopOriginated("sale"), false);
    assert.equal(isLoopOriginated("refund"), false);
    assert.equal(isLoopOriginated("adjustment"), false);
    assert.equal(isLoopOriginated("received"), false);
    assert.equal(isLoopOriginated("manual"), false);
    assert.equal(isLoopOriginated(undefined), false);
  });

  await t.test("strictly enforces stock-count-only sync: never writes regular_price, name, or metadata", () => {
    const items = [
      { inventoryId: 1, sku: "TEST-01", quantity: 10, sellingPrice: 5000, itemName: "My Item", wooProductId: 101, wooVariationId: 0 },
      { inventoryId: 2, sku: "TEST-VAR", quantity: 5, sellingPrice: 2500, itemName: "My Var", wooProductId: 101, wooVariationId: 102 },
    ];

    const { simpleUpdates, variationUpdates } = buildWooBatchPayload(items);
    // Ensure simple product has no price or name fields
    assert.equal("regular_price" in simpleUpdates[0], false, "Must never write regular_price");
    assert.equal("name" in simpleUpdates[0], false, "Must never write name");
    assert.equal(simpleUpdates[0].stock_quantity, 10);

    // Ensure variation has no price or name fields
    const vars = variationUpdates.get(101)!;
    assert.equal("regular_price" in vars[0], false, "Must never write regular_price to variation");
    assert.equal("name" in vars[0], false, "Must never write name to variation");
    assert.equal(vars[0].stock_quantity, 5);
  });
});

test("Phase 6: WooCommerce -> Framebooks Webhooks & Order Idempotency", async (t) => {
  const { computeOrderStatusDelta, getOrderStockAction, buildOrderTransitionIdempotencyKey } = await import("./order-delta.ts");

  await t.test("maps order statuses to appropriate stock actions", () => {
    assert.equal(getOrderStockAction("processing"), "decrement");
    assert.equal(getOrderStockAction("completed"), "decrement");
    assert.equal(getOrderStockAction("on-hold"), "decrement");
    assert.equal(getOrderStockAction("cancelled"), "restore");
    assert.equal(getOrderStockAction("refunded"), "restore");
    assert.equal(getOrderStockAction("failed"), "restore");
    assert.equal(getOrderStockAction("pending"), "noop");
    assert.equal(getOrderStockAction("draft"), "noop");
  });

  await t.test("computes correct stock deltas across order status transitions", () => {
    // New processing order: reduces stock by quantity
    assert.equal(computeOrderStatusDelta(null, "processing", 3), -3);
    assert.equal(computeOrderStatusDelta("pending", "processing", 2), -2);
    assert.equal(computeOrderStatusDelta("pending", "completed", 5), -5);

    // Processing to completed: already decremented, no double count
    assert.equal(computeOrderStatusDelta("processing", "completed", 3), 0);

    // Processing to cancelled: restores stock (+3)
    assert.equal(computeOrderStatusDelta("processing", "cancelled", 3), 3);

    // Completed to refunded: restores stock (+5)
    assert.equal(computeOrderStatusDelta("completed", "refunded", 5), 5);

    // Cancelled to processing: re-deducts stock (-2)
    assert.equal(computeOrderStatusDelta("cancelled", "processing", 2), -2);

    // Order cancelled before ever being paid/processing: no restore
    assert.equal(computeOrderStatusDelta("pending", "cancelled", 2), 0);
  });

  await t.test("generates deterministic transition idempotency keys", () => {
    const key1 = buildOrderTransitionIdempotencyKey(9942, "processing");
    const key2 = buildOrderTransitionIdempotencyKey(9942, "PROCESSING");
    assert.equal(key1, "order_9942_processing");
    assert.equal(key1, key2, "Case-insensitive status must yield identical idempotency key");

    const keyDifferentStatus = buildOrderTransitionIdempotencyKey(9942, "completed");
    assert.notEqual(key1, keyDifferentStatus, "Different status transition must generate distinct key");
  });

  await t.test("computes product.updated diff against last_synced_stock", () => {
    const lastSyncedStock = 20;

    // Online stock increased (e.g. stock adjustment in WP admin)
    const currentStockIncreased = 25;
    const diffPositive = currentStockIncreased - lastSyncedStock;
    assert.equal(diffPositive, 5, "Positive difference when online stock increases");

    // Online stock decreased
    const currentStockDecreased = 17;
    const diffNegative = currentStockDecreased - lastSyncedStock;
    assert.equal(diffNegative, -3, "Negative difference when online stock decreases");

    // No change
    const currentStockSame = 20;
    assert.equal(currentStockSame - lastSyncedStock, 0, "Zero diff when stock unchanged");
  });
});

test("Phase 7: Reconciliation & Conflict Resolution Policy Rules", async (t) => {
  const { resolveConflict, detectCatalogDrift } = await import("./conflict-resolver.ts");

  await t.test("enforces Framebooks Wins conflict policy", () => {
    const res = resolveConflict(
      "framebooks_wins",
      { stock: 25, updatedAt: "2026-11-20T10:00:00Z" },
      { stock: 15, updatedAt: "2026-11-25T12:00:00Z" }
    );

    assert.equal(res.winner, "framebooks");
    assert.equal(res.targetStock, 25);
    assert.ok(res.reason.includes("Framebooks wins"));
  });

  await t.test("enforces WooCommerce Wins conflict policy", () => {
    const res = resolveConflict(
      "woo_wins",
      { stock: 25, updatedAt: "2026-11-25T12:00:00Z" },
      { stock: 15, updatedAt: "2026-11-20T10:00:00Z" }
    );

    assert.equal(res.winner, "woo");
    assert.equal(res.targetStock, 15);
    assert.ok(res.reason.includes("WooCommerce wins"));
  });

  await t.test("enforces Newest Wins conflict policy based on modification timestamps", () => {
    // Case 1: WooCommerce has newer edit
    const resWooNewer = resolveConflict(
      "newest_wins",
      { stock: 20, updatedAt: "2026-11-20T10:00:00Z" },
      { stock: 14, updatedAt: "2026-11-22T14:30:00Z" }
    );
    assert.equal(resWooNewer.winner, "woo");
    assert.equal(resWooNewer.targetStock, 14);

    // Case 2: Framebooks has newer edit
    const resFbNewer = resolveConflict(
      "newest_wins",
      { stock: 22, updatedAt: "2026-11-25T09:00:00Z" },
      { stock: 18, updatedAt: "2026-11-24T18:00:00Z" }
    );
    assert.equal(resFbNewer.winner, "framebooks");
    assert.equal(resFbNewer.targetStock, 22);
  });

  await t.test("detects catalog drift across mapped products", () => {
    const mappedItems = [
      { inventoryId: 1, wooProductId: 101, wooVariationId: 0, sku: "SCN-001", name: "Scanner", fbStock: 20 },
      { inventoryId: 2, wooProductId: 102, wooVariationId: 0, sku: "PPR-002", name: "Paper", fbStock: 50 },
      { inventoryId: 3, wooProductId: 200, wooVariationId: 201, sku: "TSH-S", name: "T-Shirt", fbStock: 10 },
    ];

    const liveWooItems = new Map([
      ["101_0", { stock: 15 }], // SCN-001 has drifted: FB=20, Woo=15
      ["102_0", { stock: 50 }], // PPR-002 is in sync: FB=50, Woo=50
      ["200_201", { stock: 8 }], // TSH-S has drifted: FB=10, Woo=8
    ]);

    const drifts = detectCatalogDrift(mappedItems, liveWooItems as any, "framebooks_wins");

    assert.equal(drifts.length, 2, "Must identify exactly 2 drifting items");

    const scannerDrift = drifts.find((d) => d.sku === "SCN-001");
    assert.ok(scannerDrift);
    assert.equal(scannerDrift.fbStock, 20);
    assert.equal(scannerDrift.wooStock, 15);
    assert.equal(scannerDrift.drift, 5);
    assert.equal(scannerDrift.resolution.winner, "framebooks");

    const tshirtDrift = drifts.find((d) => d.sku === "TSH-S");
    assert.ok(tshirtDrift);
    assert.equal(tshirtDrift.drift, 2);
  });
});

test("Phase 7: Multi-Currency LKR Price Extraction (No POS Multipliers)", async (t) => {
  const { extractWooLkrPrice } = await import("./mapping-service.ts");

  await t.test("extracts LKR price from direct _price_LKR meta tag", () => {
    const product = {
      price: "4.4", // Base USD
      regular_price: "4.4",
      meta_data: [
        { key: "_price_LKR", value: "1450.00" },
        { key: "_regular_price_LKR", value: "1450.00" },
      ],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 1450);
  });

  await t.test("extracts LKR price from CURCY JSON meta (_wmc_custom_price)", () => {
    const product = {
      price: "9.5", // Base USD
      meta_data: [
        {
          key: "_wmc_custom_price",
          value: JSON.stringify({ USD: "9.5", LKR: "3150.00" }),
        },
      ],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 3150);
  });

  await t.test("extracts LKR price from Aelia / WooCommerce multi-currency object", () => {
    const product = {
      price: "12",
      meta_data: [
        {
          key: "_regular_currency_prices",
          value: { USD: 12, LKR: 3950 },
        },
      ],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 3950);
  });

  await t.test("extracts LKR price from WOOCS meta (_woocs_regular_price_LKR)", () => {
    const product = {
      price: "15",
      meta_data: [
        { key: "_woocs_regular_price_LKR", value: "4850" },
      ],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 4850);
  });

  await t.test("extracts LKR price from price_html containing Rs/LKR currency symbols", () => {
    const product = {
      price: "4.4",
      price_html: "<span class=\"woocommerce-Price-amount amount\"><bdi><span class=\"woocommerce-Price-currencySymbol\">Rs&nbsp;</span>1,350.00</bdi></span>",
      meta_data: [],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 1350);
  });

  await t.test("variation inherits LKR meta from parent product if variation lacks specific meta", () => {
    const parent = {
      price: "4.4",
      meta_data: [
        { key: "_regular_price_LKR", value: "1750.00" },
      ],
    };
    const variation = {
      price: "4.4",
      meta_data: [],
    };
    const extracted = extractWooLkrPrice(variation, parent);
    assert.equal(extracted, 1750);
  });

  await t.test("falls back to standard product.price when store is already in LKR or no multi-currency meta", () => {
    const product = {
      price: "1200",
      regular_price: "1200",
      meta_data: [],
    };
    const extracted = extractWooLkrPrice(product);
    assert.equal(extracted, 1200);
  });
});
