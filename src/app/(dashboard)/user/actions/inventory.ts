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
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS is_asset BOOLEAN DEFAULT FALSE`;
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS location VARCHAR(150)`;
      await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(150)`;
      await sql`UPDATE admin_inventory SET tenant_id = ${tenantId} WHERE tenant_id IS NULL`.catch(() => {});
      // Ensure any item created with warranty document or linked expense is marked as an internal asset
      await sql`
        UPDATE admin_inventory 
        SET is_asset = TRUE 
        WHERE is_asset IS NULL 
          AND ((warranty_letter_url IS NOT NULL AND warranty_letter_url != '') OR expense_id IS NOT NULL)
      `.catch(() => {});
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
      AND i.is_asset = TRUE
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
  const purchasePrice = data.purchase_price !== '' && data.purchase_price !== null && data.purchase_price !== undefined ? parseFloat(data.purchase_price) : null;
  const costPrice = parseFloat(data.cost_price ?? purchasePrice ?? 0) || 0;
  const sku = (data.sku && data.sku.trim()) || `AST-${Date.now().toString().slice(-6)}`;
  const serialNumber = (data.serial_number && data.serial_number.trim()) || null;
  const location = (data.location && data.location.trim()) || null;
  const assignedTo = (data.assigned_to && data.assigned_to.trim()) || null;
  const unit = data.unit || 'pcs';

  const result = await sql`
    INSERT INTO admin_inventory (
      item_name, category, serial_number, quantity, status, purchase_date, purchase_price,
      cost_price, selling_price, sku, barcode, unit, location, assigned_to,
      notes, warranty_letter_url, expense_id, tenant_id, is_asset, created_at, updated_at
    ) VALUES (
      ${data.item_name}, ${data.category}, ${serialNumber}, ${qty}, 
      ${data.status || 'Available'}, ${data.purchase_date || null}, ${purchasePrice},
      ${costPrice}, 0, ${sku}, null, ${unit}, ${location}, ${assignedTo},
      ${data.notes || null}, ${data.warranty_letter_url || null}, ${data.expense_id || null},
      ${tenantId}, TRUE, NOW(), NOW()
    )
    RETURNING id
  `;

  await logSystemAction(`Created business asset: "${data.item_name}" (${sku})`);
  revalidatePath("/user/assets");
  revalidatePath("/assets");
  return result[0];
}

export async function updateInventoryItem(id: string, data: any) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();

  const newQty = data.quantity !== undefined ? (parseFloat(data.quantity) || 0) : 1;
  const purchasePrice = data.purchase_price !== '' && data.purchase_price !== null && data.purchase_price !== undefined ? parseFloat(data.purchase_price) : null;
  const costPrice = parseFloat(data.cost_price ?? purchasePrice ?? 0) || 0;
  const sku = data.sku ? data.sku.trim() : null;
  const location = data.location !== undefined ? (data.location?.trim() || null) : undefined;
  const assignedTo = data.assigned_to !== undefined ? (data.assigned_to?.trim() || null) : undefined;

  await sql`
    UPDATE admin_inventory SET
      item_name = ${data.item_name},
      category = ${data.category},
      serial_number = ${data.serial_number || null},
      quantity = ${newQty},
      status = ${data.status || 'Available'},
      purchase_date = ${data.purchase_date || null},
      purchase_price = ${purchasePrice},
      cost_price = COALESCE(${purchasePrice}, cost_price, 0),
      sku = COALESCE(${sku}, sku, 'AST-' || LPAD(${id}::text, 6, '0')),
      location = ${location !== undefined ? location : sql`location`},
      assigned_to = ${assignedTo !== undefined ? assignedTo : sql`assigned_to`},
      unit = COALESCE(${data.unit || null}, unit, 'pcs'),
      notes = ${data.notes || null},
      warranty_letter_url = ${data.warranty_letter_url || null},
      expense_id = ${data.expense_id || null},
      is_asset = TRUE,
      updated_at = NOW()
    WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}
  `;

  await logSystemAction(`Updated business asset: "${data.item_name}" (ID: ${id})`);
  revalidatePath("/user/assets");
  revalidatePath("/assets");
}

export async function deleteInventoryItem(id: string, itemName: string) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();

  await sql`DELETE FROM admin_inventory WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}`;
  await logSystemAction(`Deleted business asset: "${itemName}" (ID: ${id})`);
  revalidatePath("/user/assets");
  revalidatePath("/assets");
}

export async function convertItemTypeAction(id: string, toAsset: boolean) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  const tenantId = await getTenantId();
  if (!tenantId) throw new Error("Tenant required");

  await sql`
    UPDATE admin_inventory
    SET is_asset = ${toAsset},
        updated_at = NOW()
    WHERE id::text = ${String(id)} AND tenant_id::text = ${String(tenantId)}
  `;

  await logSystemAction(`Converted item #${id} to ${toAsset ? 'Business Asset' : 'Stock Product'}`);
  revalidatePath("/user/assets");
  revalidatePath("/assets");
  revalidatePath("/user/stock");
  revalidatePath("/stock");
  return { success: true };
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
