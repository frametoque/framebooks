"use server";
import { requirePermission } from "./rbac";
import { revalidatePath } from "next/cache";

import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";
import { getTenantId } from "./actions";

let inventoryColumnsChecked = false;

export async function getInventoryItems() {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  if (!inventoryColumnsChecked) {
    inventoryColumnsChecked = true;
    try {
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS purchase_invoice_url TEXT`;
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS warranty_letter_url TEXT`;
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS expense_id INTEGER`;
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS tenant_id INTEGER`;
      await sql`UPDATE admin_inventory SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`.catch(() => {});
    } catch (e) {
      console.error("Failed to add columns to admin_inventory", e);
    }
  }

  const items = await sql`
    SELECT i.*, 
           e.description as expense_desc, 
           e.amount as expense_amount, 
           e.receipt_url as expense_receipt_url,
           e.category as expense_category
    FROM admin_inventory i
    LEFT JOIN admin_expenses e ON e.id::text = i.expense_id::text AND e.tenant_id::text = ${String(tenantId)}
    WHERE (i.tenant_id::text = ${String(tenantId)} OR i.tenant_id IS NULL)
    ORDER BY i.purchase_date DESC NULLS LAST, i.created_at DESC
  `;
  return items;
}

export async function getInventoryItem(id: string) {
  const tenantId = await getTenantId();
  if (!tenantId) return null;

  const items = await sql`
    SELECT * FROM admin_inventory
    WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}
  `;
  return items[0];
}

export async function getExpensesForLinking() {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  const rows = await sql`
    SELECT id, description, amount, date, receipt_url, category
    FROM admin_expenses
    WHERE tenant_id = ${tenantId}
    ORDER BY date DESC
    LIMIT 200
  `;
  return rows.map((r: any) => ({
    id: r.id,
    description: r.description,
    amount: parseFloat(r.amount || 0),
    date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    receipt_url: r.receipt_url || null,
    category: r.category || ''
  }));
}

export async function createInventoryItem(data: any) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  if (!tenantId) throw new Error("Tenant required");

  const qty = parseFloat(data.quantity || 1) || 1;
  const costPrice = parseFloat(data.cost_price ?? data.purchase_price ?? 0) || 0;
  const sellingPrice = parseFloat(data.selling_price ?? data.purchase_price ?? 0) || 0;
  const sku = (data.sku && data.sku.trim()) || `SKU-${Date.now().toString().slice(-6)}`;
  const barcode = (data.barcode && data.barcode.trim()) || null;
  const unit = data.unit || 'pcs';
  const reorderLevel = parseFloat(data.reorder_level || 5) || 5;

  const result = await sql`
    INSERT INTO admin_inventory (
      item_name, category, serial_number, quantity, status, purchase_date, purchase_price,
      cost_price, selling_price, sku, barcode, unit, reorder_level,
      notes, warranty_letter_url, expense_id, tenant_id, created_at, updated_at
    ) VALUES (
      ${data.item_name}, ${data.category}, ${data.serial_number || null}, ${qty}, 
      ${data.status || 'Available'}, ${data.purchase_date || null}, ${data.purchase_price || null},
      ${costPrice}, ${sellingPrice}, ${sku}, ${barcode}, ${unit}, ${reorderLevel},
      ${data.notes || null}, ${data.warranty_letter_url || null}, ${data.expense_id || null},
      ${tenantId}, NOW(), NOW()
    )
    RETURNING id
  `;

  const newItemId = result[0].id;

  // Sync with POS Stock Movements Audit
  await sql`
    INSERT INTO stock_movements (
      tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, notes, created_at
    ) VALUES (
      ${tenantId}, ${newItemId}, ${qty}, 0, ${qty}, 'initial', 'manual', 'ERP-INVENTORY', 'Created via ERP Inventory', NOW()
    )
  `.catch(() => {});

  await logSystemAction(`Created inventory item: "${data.item_name}" (${sku})`);
  revalidatePath("/user/stock");
  revalidatePath("/user/inventory");
  revalidatePath("/pos");
  revalidatePath("/settings/integrations");
  return result[0];
}

export async function updateInventoryItem(id: string, data: any) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();

  // Retrieve previous quantity for stock movement tracking
  const prevRows = await sql`
    SELECT quantity, sku FROM admin_inventory WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}
  `;
  const prevQty = prevRows.length > 0 ? parseFloat(prevRows[0].quantity || 0) : 0;
  const newQty = data.quantity !== undefined ? (parseFloat(data.quantity) || 0) : prevQty;
  const costPrice = data.cost_price !== undefined ? parseFloat(data.cost_price) : (data.purchase_price !== undefined ? parseFloat(data.purchase_price) : null);
  const sellingPrice = data.selling_price !== undefined ? parseFloat(data.selling_price) : null;
  const sku = data.sku ? data.sku.trim() : null;

  await sql`
    UPDATE admin_inventory SET
      item_name = ${data.item_name},
      category = ${data.category},
      serial_number = ${data.serial_number || null},
      quantity = ${newQty},
      status = ${data.status || (newQty <= 0 ? 'Out of Stock' : 'Available')},
      purchase_date = ${data.purchase_date || null},
      purchase_price = ${data.purchase_price || null},
      cost_price = COALESCE(${costPrice}, cost_price, purchase_price, 0),
      selling_price = COALESCE(${sellingPrice}, selling_price, purchase_price, 0),
      sku = COALESCE(${sku}, sku, 'SKU-' || LPAD(${id}::text, 6, '0')),
      barcode = COALESCE(${data.barcode || null}, barcode),
      unit = COALESCE(${data.unit || null}, unit, 'pcs'),
      notes = ${data.notes || null},
      warranty_letter_url = ${data.warranty_letter_url || null},
      expense_id = ${data.expense_id || null},
      updated_at = NOW()
    WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}
  `;

  // Log stock movement if quantity changed
  if (prevQty !== newQty) {
    const diff = newQty - prevQty;
    await sql`
      INSERT INTO stock_movements (
        tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, notes, created_at
      ) VALUES (
        ${tenantId}, ${id}, ${diff}, ${prevQty}, ${newQty}, 'correction', 'manual', 'ERP-UPDATE', 'Quantity adjusted via ERP Inventory', NOW()
      )
    `.catch(() => {});
  }

  await logSystemAction(`Updated inventory item: "${data.item_name}" (ID: ${id})`);
  revalidatePath("/user/stock");
  revalidatePath("/user/inventory");
  revalidatePath("/pos");
  revalidatePath("/settings/integrations");
}

export async function deleteInventoryItem(id: string, itemName: string) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();

  await sql`DELETE FROM admin_inventory WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}`;
  await logSystemAction(`Deleted inventory item: "${itemName}" (ID: ${id})`);
  revalidatePath("/user/stock");
  revalidatePath("/user/inventory");
  revalidatePath("/pos");
  revalidatePath("/settings/integrations");
}

export async function uploadInventoryDocument(formData: FormData): Promise<string> {
  const { uploadToR2 } = await import('@/lib/r2');
  const file = formData.get('file') as File;
  if (!file) throw new Error("No file uploaded");
  const cleanName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const result = await uploadToR2({
    file,
    fileName: cleanName,
    folder: "inventory",
  });
  return result.url;
}
