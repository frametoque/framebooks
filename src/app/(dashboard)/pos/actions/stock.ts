"use server";

import sql from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePosPermission, isCashierOnlyUser } from "@/app/(dashboard)/user/actions/rbac";
import { requirePosAddon } from "@/lib/pos/entitlement";
import { 
  getStockProducts, 
  getStockSummary,
  StockSummary,
  findProductByCode, 
  recordStockMovements, 
  getStockMovementHistory,
  getPosSettings,
  updatePosSettings,
  generateProductSku,
  StockItem,
  PosSettings
} from "@/lib/pos/stock-service";
import { seedFtDemoTenantStock } from "@/lib/pos/db-init";
import { logSystemAction } from "@/lib/logger";

export async function loadStockSummaryAction() {
  const perm = await requirePosPermission('stock.view');
  if (perm.error || !perm.context) {
    const posPerm = await requirePosPermission('pos.use');
    if (posPerm.error || !posPerm.context) {
      return { success: false, error: perm.error || posPerm.error, summary: null };
    }
  }

  const context = perm.context || (await requirePosPermission('pos.use')).context!;
  const tenantId = Number(context.tenantId);

  try {
    const summary = await getStockSummary(tenantId);
    return { success: true, summary };
  } catch (err: any) {
    console.error("loadStockSummaryAction error:", err);
    return { success: false, error: err.message, summary: null };
  }
}

export async function loadStockProductsAction(options?: {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const perm = await requirePosPermission('stock.view');
  if (perm.error || !perm.context) {
    // Also allow cashiers with pos.use to load items for scanning and sales
    const posPerm = await requirePosPermission('pos.use');
    if (posPerm.error || !posPerm.context) {
      return { success: false, error: perm.error || posPerm.error, items: [], total: 0 };
    }
  }

  const context = perm.context || (await requirePosPermission('pos.use')).context!;
  const tenantId = Number(context.tenantId);

  try {
    const result = await getStockProducts(tenantId, options);
    return { success: true, ...result };
  } catch (err: any) {
    console.error("loadStockProductsAction error:", err);
    return { success: false, error: err.message, items: [], total: 0 };
  }
}

export async function findProductByBarcodeAction(code: string) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, item: null };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    const item = await findProductByCode(tenantId, code);
    return { success: true, item };
  } catch (err: any) {
    return { success: false, error: err.message, item: null };
  }
}

export async function saveProductAction(data: {
  id?: number | null;
  item_name: string;
  category?: string;
  sku?: string;
  barcode?: string;
  quantity?: number;
  cost_price?: number;
  selling_price?: number;
  tax_rate?: number;
  unit?: string;
  reorder_level?: number;
  notes?: string;
}) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    // If WooCommerce is actively connected, products and details are managed exclusively via WooCommerce
    const wooConnRows = await sql`
      SELECT status FROM woocommerce_connections
      WHERE tenant_id = ${tenantId} AND status = 'connected'
      LIMIT 1
    `.catch(() => []);
    if (wooConnRows.length > 0) {
      return {
        success: false,
        error: "Product creation and details are managed on WooCommerce while your store is connected.",
      };
    }

    let sku = (data.sku || '').trim();
    if (!sku) {
      sku = await generateProductSku(tenantId);
    }

    // Verify SKU uniqueness
    const idFilter = data.id ? sql`AND id::text != ${String(data.id)}` : sql``;
    const existingSku = await sql`
      SELECT id FROM admin_inventory 
      WHERE tenant_id::text = ${String(tenantId)} AND LOWER(sku) = LOWER(${sku})
        ${idFilter}
      LIMIT 1
    `;
    if (existingSku.length > 0) {
      return { success: false, error: `SKU "${sku}" is already in use by another product in your workspace.` };
    }

    const barcode = data.barcode?.trim() || null;
    const costPrice = parseFloat(data.cost_price as any || 0);
    const sellingPrice = parseFloat(data.selling_price as any || 0);
    const taxRate = parseFloat(data.tax_rate as any || 0);
    const unit = data.unit?.trim() || 'pcs';
    const reorderLevel = parseFloat(data.reorder_level as any || 5);
    const initialQty = parseFloat(data.quantity as any || 0);

    if (data.id) {
      // Update existing
      await sql`
        UPDATE admin_inventory SET
          item_name = ${data.item_name},
          category = ${data.category || 'General'},
          sku = ${sku},
          barcode = ${barcode},
          cost_price = ${costPrice},
          selling_price = ${sellingPrice},
          purchase_price = ${costPrice},
          tax_rate = ${taxRate},
          unit = ${unit},
          reorder_level = ${reorderLevel},
          notes = ${data.notes || null},
          updated_at = NOW()
        WHERE id::text = ${String(data.id)} AND tenant_id::text = ${String(tenantId)}
      `;
      await logSystemAction(`Updated stock product "${data.item_name}" (${sku})`);
      revalidatePath("/pos");
      revalidatePath("/user/stock");
      revalidatePath("/user/inventory");
      revalidatePath("/settings/integrations");
      return { success: true, id: data.id, sku };
    } else {
      // Create new
      const inserted = await sql`
        INSERT INTO admin_inventory (
          tenant_id, item_name, category, sku, barcode, quantity,
          cost_price, selling_price, purchase_price, tax_rate, unit,
          reorder_level, status, notes, created_at, updated_at
        ) VALUES (
          ${tenantId}, ${data.item_name}, ${data.category || 'General'}, ${sku}, ${barcode},
          ${initialQty}, ${costPrice}, ${sellingPrice}, ${costPrice}, ${taxRate}, ${unit},
          ${reorderLevel}, ${initialQty > 0 ? 'Available' : 'Out of Stock'}, ${data.notes || null},
          NOW(), NOW()
        )
        RETURNING id
      `;

      const newId = inserted[0]?.id;

      if (initialQty > 0) {
        // Record initial stock movement
        await recordStockMovements(
          tenantId,
          [{
            inventoryId: newId,
            changeQty: initialQty,
            reason: 'received',
            referenceType: 'initial_stock',
            notes: 'Initial inventory quantity',
          }],
          { id: userId }
        );
      }

      await logSystemAction(`Created stock product "${data.item_name}" (${sku}) with qty ${initialQty}`);
      revalidatePath("/pos");
      revalidatePath("/user/stock");
      revalidatePath("/user/inventory");
      revalidatePath("/settings/integrations");
      return { success: true, id: newId, sku };
    }
  } catch (err: any) {
    console.error("saveProductAction error:", err);
    return { success: false, error: err.message };
  }
}

export async function adjustStockAction(data: {
  inventoryId: number;
  changeQty: number;
  reason: 'received' | 'damaged' | 'correction' | 'count';
  notes?: string;
}) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    const result = await recordStockMovements(
      tenantId,
      [{
        inventoryId: data.inventoryId,
        changeQty: data.changeQty,
        reason: data.reason,
        referenceType: 'manual_adjustment',
        notes: data.notes || `Stock adjustment: ${data.reason}`,
      }],
      { id: userId }
    );

    await logSystemAction(`Adjusted stock for item #${data.inventoryId}: ${data.changeQty > 0 ? '+' : ''}${data.changeQty} (${data.reason})`);
    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/inventory");
    revalidatePath("/settings/integrations");
    return { success: true, ...result };
  } catch (err: any) {
    console.error("adjustStockAction error:", err);
    return { success: false, error: err.message };
  }
}

export async function bulkStockTakeAction(items: Array<{
  id: number;
  countedQty: number;
  notes?: string;
}>) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    const movements = [];
    for (const item of items) {
      const current = await sql`
        SELECT quantity FROM admin_inventory WHERE id::text = ${String(item.id)} AND tenant_id::text = ${String(tenantId)}
      `;
      if (current.length > 0) {
        const curQty = parseFloat(current[0].quantity || 0);
        const diff = item.countedQty - curQty;
        if (diff !== 0) {
          movements.push({
            inventoryId: item.id,
            changeQty: diff,
            reason: 'count' as const,
            referenceType: 'bulk_stocktake',
            notes: item.notes || `Stocktake: counted ${item.countedQty} (was ${curQty})`,
          });
        }
      }
    }

    if (movements.length > 0) {
      await recordStockMovements(tenantId, movements, { id: userId });
      await logSystemAction(`Completed bulk stocktake adjusting ${movements.length} items`);
    }

    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/inventory");
    revalidatePath("/settings/integrations");
    return { success: true, count: movements.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function loadStockHistoryAction(inventoryId?: number) {
  const perm = await requirePosPermission('stock.view');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, history: [] };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    const history = await getStockMovementHistory(tenantId, inventoryId);
    return { success: true, history };
  } catch (err: any) {
    return { success: false, error: err.message, history: [] };
  }
}

export async function loadPosSettingsAction(): Promise<{ success: boolean; settings?: PosSettings; error?: string }> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    const settings = await getPosSettings(tenantId);
    return { success: true, settings };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function savePosSettingsAction(settings: Partial<PosSettings>) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error || "Unauthorized" };
  }

  const role = perm.context.role;
  const isCashier = await isCashierOnlyUser(role, perm.context.tenantId);
  if (isCashier || role?.toLowerCase() === 'cashier') {
    return { success: false, error: "Cashiers cannot access or modify POS settings." };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    await updatePosSettings(tenantId, settings);
    revalidatePath("/pos");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function seedFtDemoStockAction(): Promise<{ success: boolean; message: string }> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) return { success: false, message: perm.error || "Unauthorized" };
  const tenantId = Number(perm.context.tenantId);

  const tenantRows = await sql`SELECT name FROM tenants WHERE id = ${tenantId} LIMIT 1`;
  const tenantName = tenantRows[0]?.name || '';

  if (tenantName.toLowerCase().includes('ft demo') || tenantName.toLowerCase().includes('ft')) {
    await seedFtDemoTenantStock(tenantId);
    return { success: true, message: "Demo stock products seeded for FT DEMO." };
  }
  return { success: false, message: "Seeding is exclusively configured for FT DEMO workspace." };
}
