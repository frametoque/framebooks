"use server";
import { requirePermission } from "./rbac";

import sql from "@/lib/db";
import { logSystemAction } from "@/lib/logger";

export async function getInventoryItems() {
  try {
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS purchase_invoice_url TEXT`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS warranty_letter_url TEXT`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS expense_id INTEGER`;
  } catch (e) {
    console.error("Failed to add columns to admin_inventory", e);
  }

  const items = await sql`
    SELECT i.*, 
           e.description as expense_desc, 
           e.amount as expense_amount, 
           e.receipt_url as expense_receipt_url,
           e.category as expense_category
    FROM admin_inventory i
    LEFT JOIN admin_expenses e ON i.expense_id = e.id
    ORDER BY i.created_at DESC
  `;
  return items;
}

export async function getInventoryItem(id: string) {
  const items = await sql`
    SELECT * FROM admin_inventory
    WHERE id = ${id}
  `;
  return items[0];
}

export async function getExpensesForLinking() {
  const rows = await sql`
    SELECT id, description, amount, date, receipt_url, category
    FROM admin_expenses
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

  const result = await sql`
    INSERT INTO admin_inventory (
      item_name, category, serial_number, quantity, status, purchase_date, purchase_price, notes, warranty_letter_url, expense_id
    ) VALUES (
      ${data.item_name}, ${data.category}, ${data.serial_number || null}, ${data.quantity || 1}, 
      ${data.status || 'Available'}, ${data.purchase_date || null}, ${data.purchase_price || null}, ${data.notes || null},
      ${data.warranty_letter_url || null}, ${data.expense_id || null}
    )
    RETURNING id
  `;
  await logSystemAction(`Created inventory item: "${data.item_name}"`);
  return result[0];
}

export async function updateInventoryItem(id: string, data: any) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  await sql`
    UPDATE admin_inventory SET
      item_name = ${data.item_name},
      category = ${data.category},
      serial_number = ${data.serial_number || null},
      quantity = ${data.quantity || 1},
      status = ${data.status || 'Available'},
      purchase_date = ${data.purchase_date || null},
      purchase_price = ${data.purchase_price || null},
      notes = ${data.notes || null},
      warranty_letter_url = ${data.warranty_letter_url || null},
      expense_id = ${data.expense_id || null},
      updated_at = NOW()
    WHERE id = ${id}
  `;
  await logSystemAction(`Updated inventory item: "${data.item_name}" (ID: ${id})`);
}

export async function deleteInventoryItem(id: string, itemName: string) {
  const { error: rbacError } = await requirePermission('inventory', 'update');
  if (rbacError) throw new Error(rbacError);

  await sql`DELETE FROM admin_inventory WHERE id = ${id}`;
  await logSystemAction(`Deleted inventory item: "${itemName}" (ID: ${id})`);
}

export async function uploadInventoryDocument(formData: FormData): Promise<string> {
  const { put } = await import('@vercel/blob');
  const file = formData.get('file') as File;
  if (!file) throw new Error("No file uploaded");
  const filename = `admin/inventory/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const blob = await put(filename, file, { access: 'public' });
  return blob.url;
}
