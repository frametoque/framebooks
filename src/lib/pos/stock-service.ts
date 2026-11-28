import sql from "@/lib/db";
import { ensurePosSchema } from "./db-init";
import { requirePosAddon } from "./entitlement";
import { requirePermission, hasGranularPermission, getUserContext } from "@/app/(dashboard)/user/actions/rbac";

import {
  PosClientDisplaySlide,
  DEFAULT_CUSTOMER_DISPLAY_SLIDES,
} from '@/lib/pos/client-display';

export interface StockItem {
  id: number;
  item_name: string;
  category: string;
  brand?: string | null;
  sku: string;
  barcode: string | null;
  quantity: number;
  cost_price: number;
  selling_price: number;
  tax_rate: number;
  unit: string;
  reorder_level: number;
  status: string;
  is_low_stock: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  woo_sync_status?: 'synced' | 'pending' | 'error' | 'unmapped' | string | null;
}

export interface StockMovementRecord {
  id: number;
  inventory_id: number;
  item_name?: string;
  change_qty: number;
  previous_qty: number;
  new_qty: number;
  reason: 'sale' | 'refund' | 'void' | 'received' | 'damaged' | 'correction' | 'count';
  reference_type?: string | null;
  reference_id?: string | null;
  user_id?: number | null;
  user_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface PosSettings {
  allow_negative_stock: boolean;
  sku_prefix: string;
  receipt_header: string;
  receipt_footer: string;
  default_tax_rate: number;
  default_account_id: number | null;
  customer_display_slides?: PosClientDisplaySlide[];
}

/**
 * Fetch POS settings for tenant.
 */
export async function getPosSettings(tenantId: number): Promise<PosSettings> {
  await ensurePosSchema();

  const rows = await sql`
    SELECT allow_negative_stock, sku_prefix, receipt_header, receipt_footer, default_tax_rate, default_account_id, customer_display_slides
    FROM pos_settings
    WHERE tenant_id = ${tenantId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return {
      allow_negative_stock: false,
      sku_prefix: 'SKU',
      receipt_header: '',
      receipt_footer: 'Thank you for your purchase!',
      default_tax_rate: 0,
      default_account_id: null,
      customer_display_slides: DEFAULT_CUSTOMER_DISPLAY_SLIDES,
    };
  }

  const r = rows[0];
  let parsedSlides: PosClientDisplaySlide[] | undefined;
  if (r.customer_display_slides) {
    parsedSlides = typeof r.customer_display_slides === 'string'
      ? JSON.parse(r.customer_display_slides)
      : r.customer_display_slides;
  }

  return {
    allow_negative_stock: Boolean(r.allow_negative_stock),
    sku_prefix: r.sku_prefix || 'SKU',
    receipt_header: r.receipt_header || '',
    receipt_footer: r.receipt_footer || 'Thank you for your purchase!',
    default_tax_rate: parseFloat(r.default_tax_rate || 0),
    default_account_id: r.default_account_id || null,
    customer_display_slides: parsedSlides && parsedSlides.length > 0 ? parsedSlides : DEFAULT_CUSTOMER_DISPLAY_SLIDES,
  };
}

/**
 * Update POS settings for tenant.
 */
export async function updatePosSettings(tenantId: number, settings: Partial<PosSettings>) {
  await ensurePosSchema();

  const slidesJson = settings.customer_display_slides ? JSON.stringify(settings.customer_display_slides) : null;

  await sql`
    INSERT INTO pos_settings (
      tenant_id, allow_negative_stock, sku_prefix, receipt_header, receipt_footer, default_tax_rate, default_account_id, customer_display_slides, updated_at
    ) VALUES (
      ${tenantId}, 
      ${settings.allow_negative_stock ?? false}, 
      ${settings.sku_prefix ?? 'SKU'}, 
      ${settings.receipt_header ?? ''}, 
      ${settings.receipt_footer ?? 'Thank you for your purchase!'}, 
      ${settings.default_tax_rate ?? 0}, 
      ${settings.default_account_id ?? null}, 
      ${slidesJson ? sql`${slidesJson}::jsonb` : sql`NULL`},
      NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
      allow_negative_stock = COALESCE(EXCLUDED.allow_negative_stock, pos_settings.allow_negative_stock),
      sku_prefix = COALESCE(EXCLUDED.sku_prefix, pos_settings.sku_prefix),
      receipt_header = COALESCE(EXCLUDED.receipt_header, pos_settings.receipt_header),
      receipt_footer = COALESCE(EXCLUDED.receipt_footer, pos_settings.receipt_footer),
      default_tax_rate = COALESCE(EXCLUDED.default_tax_rate, pos_settings.default_tax_rate),
      default_account_id = COALESCE(EXCLUDED.default_account_id, pos_settings.default_account_id),
      customer_display_slides = CASE WHEN ${settings.customer_display_slides !== undefined} THEN EXCLUDED.customer_display_slides ELSE pos_settings.customer_display_slides END,
      updated_at = NOW()
  `;

  return { success: true };
}

/**
 * Auto-generate a unique SKU for a product.
 */
export async function generateProductSku(tenantId: number, prefix: string = 'SKU'): Promise<string> {
  await ensurePosSchema();

  const countRows = await sql`
    SELECT COUNT(*) as count FROM admin_inventory WHERE tenant_id::text = ${String(tenantId)}
  `;
  const count = parseInt(countRows[0]?.count || '0') + 1;
  const cleanPrefix = (prefix || 'SKU').trim().toUpperCase();

  let candidate = `${cleanPrefix}-${count.toString().padStart(5, '0')}`;
  let exists = await sql`
    SELECT id FROM admin_inventory WHERE tenant_id::text = ${String(tenantId)} AND sku = ${candidate} LIMIT 1
  `;

  let attempt = 1;
  while (exists.length > 0) {
    candidate = `${cleanPrefix}-${(count + attempt).toString().padStart(5, '0')}`;
    exists = await sql`
      SELECT id FROM admin_inventory WHERE tenant_id::text = ${String(tenantId)} AND sku = ${candidate} LIMIT 1
    `;
    attempt++;
  }

  return candidate;
}

/**
 * Shared Stock Movement Service with DB Transaction and Row-Level Pessimistic Locking.
 * Ensures consistent quantities and race-free concurrent checkout across multiple terminals.
 */
export async function recordStockMovements(
  tenantId: number,
  movements: Array<{
    inventoryId: number;
    changeQty: number; // negative for reduction, positive for replenishment
    reason: 'sale' | 'refund' | 'void' | 'received' | 'damaged' | 'correction' | 'count';
    referenceType?: string;
    referenceId?: string;
    notes?: string;
  }>,
  user?: { id?: number | null; name?: string | null }
) {
  await ensurePosSchema();

  if (!movements || movements.length === 0) return { success: true, results: [] };

  const settings = await getPosSettings(tenantId);

  // Execute inside a single atomic database transaction
  const txRes = await sql.begin(async (trx) => {
    const results = [];

    for (const mov of movements) {
      // Pessimistic Row Lock: FOR UPDATE locks row until transaction completes
      const itemRows = await trx`
        SELECT id, item_name, quantity, selling_price, sku
        FROM admin_inventory
        WHERE id::text = ${String(mov.inventoryId)} AND tenant_id::text = ${String(tenantId)}
        FOR UPDATE
      `;

      if (itemRows.length === 0) {
        throw new Error(`Inventory item #${mov.inventoryId} not found in this tenant.`);
      }

      const item = itemRows[0];
      const previousQty = parseFloat(item.quantity || 0);
      const changeQty = parseFloat(mov.changeQty as any);
      const newQty = previousQty + changeQty;

      // Oversell protection check
      if (newQty < 0 && !settings.allow_negative_stock) {
        throw new Error(
          `INSUFFICIENT_STOCK: Item "${item.item_name}" (${item.sku || 'No SKU'}) only has ${previousQty} in stock. Requested change: ${changeQty}.`
        );
      }

      // Update inventory table
      await trx`
        UPDATE admin_inventory
        SET quantity = ${newQty},
            status = ${newQty <= 0 ? 'Out of Stock' : 'Available'},
            updated_at = NOW()
        WHERE id::text = ${String(item.id)} AND tenant_id::text = ${String(tenantId)}
      `;

      // Log to stock_movements audit trail
      const movementRow = await trx`
        INSERT INTO stock_movements (
          tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, user_name, notes, created_at
        ) VALUES (
          ${tenantId}, ${item.id}, ${changeQty}, ${previousQty}, ${newQty}, ${mov.reason},
          ${mov.referenceType || null}, ${mov.referenceId || null},
          ${user?.id || null}, ${user?.name || null}, ${mov.notes || null}, NOW()
        )
        RETURNING id
      `;

      results.push({
        movementId: movementRow[0]?.id,
        inventoryId: item.id,
        itemName: item.item_name,
        previousQty,
        newQty,
        changeQty,
      });
    }

    return { success: true, results };
  });

  // Enqueue push of new absolute quantity to WooCommerce (if connected & mapped)
  if (txRes.success && txRes.results.length > 0) {
    try {
      const { enqueueWooStockPush } = await import("@/lib/woocommerce/push-service");
      const source = movements[0]?.referenceType || movements[0]?.reason;
      await enqueueWooStockPush(
        tenantId,
        txRes.results.map((r) => ({
          inventoryId: r.inventoryId,
          newQuantity: r.newQty,
          reason: movements[0]?.reason,
        })),
        { source, immediate: true }
      );
    } catch (hookErr) {
      // Non-blocking: stock movement has already succeeded
      console.warn("[WooCommerce Stock Push Hook]", hookErr);
    }
  }

  return txRes;
}

export interface StockSummary {
  totalProducts: number;
  totalStockUnits: number;
  lowStockCount: number;
  totalStockValue: number;
  categories: string[];
}

export async function getStockSummary(tenantId: number): Promise<StockSummary> {
  await ensurePosSchema();

  const [statsRow] = await sql`
    SELECT 
      COUNT(*)::int AS total_products,
      COALESCE(SUM(i.quantity), 0)::float AS total_stock_units,
      COUNT(CASE WHEN i.quantity <= COALESCE(i.reorder_level, 5) THEN 1 END)::int AS low_stock_count,
      COALESCE(SUM(i.quantity * COALESCE(i.selling_price, 0)), 0)::float AS total_stock_value
    FROM admin_inventory i
    WHERE (i.tenant_id::text = ${String(tenantId)} OR i.tenant_id IS NULL)
      AND (i.is_asset IS FALSE OR i.is_asset IS NULL)
  `;

  const catRows = await sql`
    SELECT DISTINCT i.category
    FROM admin_inventory i
    WHERE (i.tenant_id::text = ${String(tenantId)} OR i.tenant_id IS NULL)
      AND (i.is_asset IS FALSE OR i.is_asset IS NULL)
      AND i.category IS NOT NULL 
      AND TRIM(i.category) != ''
    ORDER BY i.category ASC
  `;

  const seenCats = new Set<string>();
  seenCats.add("all");
  const uniqueCats: string[] = [];
  for (const r of catRows) {
    const rawCat = (r.category || "").trim();
    if (!rawCat) continue;
    const cleanCat = rawCat
      .replace(/&amp;/g, "&")
      .replace(/&#038;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();
    const lower = cleanCat.toLowerCase();
    if (cleanCat && lower !== "all" && !seenCats.has(lower)) {
      seenCats.add(lower);
      uniqueCats.push(cleanCat);
    }
  }

  const categories = ["All", ...uniqueCats];

  return {
    totalProducts: statsRow?.total_products || 0,
    totalStockUnits: statsRow?.total_stock_units || 0,
    lowStockCount: statsRow?.low_stock_count || 0,
    totalStockValue: statsRow?.total_stock_value || 0,
    categories,
  };
}

/**
 * Get all stock products for POS and Stock management.
 */
export async function getStockProducts(
  tenantId: number,
  options?: {
    search?: string;
    category?: string;
    lowStockOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: StockItem[]; total: number }> {
  await ensurePosSchema();

  try {
    const { ensureWooCommerceSchema } = await import("@/lib/woocommerce/db-init");
    await ensureWooCommerceSchema();
  } catch {
    // Non-blocking if woo schema fails
  }

  // Ensure any legacy inventory rows without tenant_id are assigned to this tenant
  await sql`
    UPDATE admin_inventory 
    SET tenant_id = ${tenantId} 
    WHERE tenant_id IS NULL
  `.catch(() => {});

  const searchClean = options?.search?.trim();
  const searchFilter = searchClean
    ? sql`AND (
        LOWER(i.item_name) ILIKE ${'%' + searchClean.toLowerCase() + '%'} OR 
        LOWER(COALESCE(i.sku, '')) ILIKE ${'%' + searchClean.toLowerCase() + '%'} OR 
        LOWER(COALESCE(i.barcode, '')) ILIKE ${'%' + searchClean.toLowerCase() + '%'}
      )`
    : sql``;

  const categoryFilter = options?.category && options.category !== 'All'
    ? sql`AND i.category = ${options.category}`
    : sql``;

  const lowStockFilter = options?.lowStockOnly
    ? sql`AND i.quantity <= COALESCE(i.reorder_level, 5)`
    : sql``;

  const limitClause = options?.limit !== undefined && options?.limit !== null && options.limit > 0
    ? sql`LIMIT ${options.limit}`
    : sql``;
  const offsetClause = options?.offset && options.offset > 0
    ? sql`OFFSET ${options.offset}`
    : sql``;

  const rows = await sql`
    SELECT 
      i.id, i.item_name, i.category, i.brand, i.sku, i.barcode, i.quantity,
      i.cost_price, i.selling_price, i.tax_rate, i.unit, i.reorder_level, i.status, i.notes,
      i.created_at, i.updated_at,
      COALESCE(m.sync_status, 'unmapped') AS woo_sync_status
    FROM admin_inventory i
    LEFT JOIN woocommerce_product_mappings m 
      ON m.tenant_id::text = i.tenant_id::text AND m.inventory_id::text = i.id::text
    WHERE (i.tenant_id::text = ${String(tenantId)} OR i.tenant_id IS NULL)
      AND (i.is_asset IS FALSE OR i.is_asset IS NULL)
      ${searchFilter}
      ${categoryFilter}
      ${lowStockFilter}
    ORDER BY i.item_name ASC
    ${limitClause} ${offsetClause}
  `;

  const countRows = await sql`
    SELECT COUNT(*) as total
    FROM admin_inventory i
    WHERE (i.tenant_id::text = ${String(tenantId)} OR i.tenant_id IS NULL)
      AND (i.is_asset IS FALSE OR i.is_asset IS NULL)
      ${searchFilter}
      ${categoryFilter}
      ${lowStockFilter}
  `;

  const total = parseInt(countRows[0]?.total || '0');

  const items: StockItem[] = rows.map((r: any) => {
    const qty = parseFloat(r.quantity || 0);
    const reorder = parseFloat(r.reorder_level || 5);
    return {
      id: r.id,
      item_name: r.item_name || 'Unnamed Product',
      category: r.category || 'General',
      brand: r.brand || null,
      sku: (r.sku || `SKU-${r.id}`).trim(),
      barcode: r.barcode || null,
      quantity: qty,
      cost_price: parseFloat(r.cost_price || 0),
      selling_price: parseFloat(r.selling_price || 0),
      tax_rate: parseFloat(r.tax_rate || 0),
      unit: r.unit || 'pcs',
      reorder_level: reorder,
      status: r.status || (qty > 0 ? 'Available' : 'Out of Stock'),
      is_low_stock: qty <= reorder,
      notes: r.notes || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      woo_sync_status: r.woo_sync_status || "unmapped",
    };
  });

  return { items, total };
}

/**
 * Lookup product by exact barcode or SKU (for barcode scanners).
 */
export async function findProductByCode(tenantId: number, code: string): Promise<StockItem | null> {
  await ensurePosSchema();
  const trimmed = code.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^0+/, "") || trimmed;

  const rows = await sql`
    SELECT 
      id, item_name, category, brand, sku, barcode, quantity,
      cost_price, selling_price, tax_rate, unit, reorder_level, status, notes
    FROM admin_inventory
    WHERE tenant_id::text = ${String(tenantId)}
      AND (is_asset IS FALSE OR is_asset IS NULL)
      AND (
        LOWER(sku) = LOWER(${trimmed}) OR 
        LOWER(COALESCE(barcode, '')) = LOWER(${trimmed}) OR
        LOWER(sku) = LOWER(${stripped}) OR 
        LOWER(COALESCE(barcode, '')) = LOWER(${stripped}) OR
        LTRIM(sku, '0') = ${stripped} OR
        LTRIM(COALESCE(barcode, ''), '0') = ${stripped}
      )
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const r = rows[0];
  const qty = parseFloat(r.quantity || 0);
  const reorder = parseFloat(r.reorder_level || 5);

  return {
    id: r.id,
    item_name: r.item_name,
    category: r.category || 'General',
    brand: r.brand || null,
    sku: r.sku || `SKU-${r.id}`,
    barcode: r.barcode || null,
    quantity: qty,
    cost_price: parseFloat(r.cost_price || 0),
    selling_price: parseFloat(r.selling_price || 0),
    tax_rate: parseFloat(r.tax_rate || 0),
    unit: r.unit || 'pcs',
    reorder_level: reorder,
    status: r.status || (qty > 0 ? 'Available' : 'Out of Stock'),
    is_low_stock: qty <= reorder,
    notes: r.notes || null,
  };
}

/**
 * Fetch stock movement history.
 */
export async function getStockMovementHistory(
  tenantId: number,
  inventoryId?: number,
  limit: number = 100
): Promise<StockMovementRecord[]> {
  await ensurePosSchema();

  const rows = await sql`
    SELECT 
      m.*,
      i.item_name
    FROM stock_movements m
    JOIN admin_inventory i ON m.inventory_id = i.id
    WHERE m.tenant_id = ${tenantId}
      AND (${inventoryId || null}::integer IS NULL OR m.inventory_id = ${inventoryId})
    ORDER BY m.created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((r: any) => ({
    id: r.id,
    inventory_id: r.inventory_id,
    item_name: r.item_name,
    change_qty: parseFloat(r.change_qty || 0),
    previous_qty: parseFloat(r.previous_qty || 0),
    new_qty: parseFloat(r.new_qty || 0),
    reason: r.reason,
    reference_type: r.reference_type,
    reference_id: r.reference_id,
    user_id: r.user_id,
    user_name: r.user_name,
    notes: r.notes,
    created_at: new Date(r.created_at).toISOString(),
  }));
}
