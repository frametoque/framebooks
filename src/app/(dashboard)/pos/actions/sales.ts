"use server";

import sql from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePosPermission } from "@/app/(dashboard)/user/actions/rbac";
import { recordStockMovements, getPosSettings } from "@/lib/pos/stock-service";
import { logSystemAction } from "@/lib/logger";

export interface CartItem {
  id: number; // inventory id
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  quantity: number;
  taxRate?: number;
  discount?: number; // item-level discount percentage or amount
  discountType?: 'percent' | 'fixed';
  discountReason?: string;
  brand?: string | null;
  category?: string;
  unit?: string;
}

export interface CheckoutPayload {
  items: CartItem[];
  customerName?: string;
  customerPhone?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Split';
  amountTendered: number;
  changeReturned: number;
  notes?: string;
}

/**
 * Helper to generate unique order number like ORD-YYYYMMDD-XXXX
 */
async function generateOrderNumber(tenantId: number): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `POS-${dateStr}`;

  const lastOrder = await sql`
    SELECT order_number FROM pos_orders 
    WHERE tenant_id = ${tenantId} AND order_number LIKE ${prefix + '%'}
    ORDER BY id DESC LIMIT 1
  `;

  let nextSeq = 1;
  if (lastOrder.length > 0) {
    const parts = lastOrder[0].order_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1] || '0', 10);
    if (!isNaN(lastNum)) nextSeq = lastNum + 1;
  }

  return `${prefix}-${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Helper to generate invoice id like INV-XXXX
 */
async function generateInvoiceId(tenantId: number): Promise<string> {
  const existingRows = await sql`SELECT invoice_id FROM invoices WHERE tenant_id = ${tenantId}`;
  const numbers = new Set<number>();
  for (const row of existingRows) {
    const match = row.invoice_id?.match(/^INV-(\d+)$/i);
    if (match) numbers.add(parseInt(match[1], 10));
  }
  let nextNum = 1;
  while (numbers.has(nextNum)) nextNum++;
  return `INV-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Open or retrieve active shift for current cashier/user.
 */
export async function getOrCreateShiftAction(openingCash: number = 0, notes?: string) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, shift: null };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    // Check for open shift
    const openShifts = await sql`
      SELECT id, tenant_id, user_id, user_name, shift_number, opened_at, opening_cash, status, notes
      FROM pos_shifts
      WHERE tenant_id = ${tenantId} AND user_id = ${userId} AND status = 'open'
      ORDER BY id DESC LIMIT 1
    `;

    if (openShifts.length > 0) {
      return { success: true, shift: openShifts[0] };
    }

    // Fetch user name
    const userRow = await sql`SELECT full_name FROM admin_users WHERE id = ${userId} LIMIT 1`;
    const userName = userRow[0]?.full_name || 'Cashier';

    // Calculate next sequential shift number for this specific tenant
    const countRows = await sql`
      SELECT COALESCE(MAX(shift_number), 0) + 1 AS next_num
      FROM pos_shifts
      WHERE tenant_id = ${tenantId}
    `;
    const shiftNumber = Number(countRows[0]?.next_num || 1);

    // Create new shift
    const newShift = await sql`
      INSERT INTO pos_shifts (
        tenant_id, user_id, user_name, shift_number, opened_at, opening_cash, status, notes
      ) VALUES (
        ${tenantId}, ${userId}, ${userName}, ${shiftNumber}, NOW(), ${openingCash}, 'open', ${notes || null}
      )
      RETURNING id, tenant_id, user_id, user_name, shift_number, opened_at, opening_cash, status, notes
    `;

    await logSystemAction(`Cashier ${userName} opened POS shift #${shiftNumber} with cash ${openingCash}`);
    return { success: true, shift: newShift[0] };
  } catch (err: any) {
    return { success: false, error: err.message, shift: null };
  }
}

/**
 * Fetch shift summary metrics (sales, cash, orders).
 */
export async function getShiftSummaryAction(shiftId: number) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);

  try {
    const shiftRows = await sql`
      SELECT * FROM pos_shifts WHERE id = ${shiftId} AND tenant_id = ${tenantId} LIMIT 1
    `;
    if (shiftRows.length === 0) return { success: false, error: "Shift not found" };

    const shift = shiftRows[0];

    const orderStats = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount), 0) as total_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total_amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'Bank Transfer' THEN total_amount ELSE 0 END), 0) as transfer_sales
      FROM pos_orders
      WHERE tenant_id = ${tenantId} AND shift_id = ${shiftId} AND status = 'completed'
    `;

    const stats = orderStats[0];
    const openingCash = parseFloat(shift.opening_cash || 0);
    const cashSales = parseFloat(stats.cash_sales || 0);
    const expectedCash = openingCash + cashSales;

    return {
      success: true,
      shift,
      metrics: {
        totalOrders: parseInt(stats.total_orders || '0'),
        totalSales: parseFloat(stats.total_sales || 0),
        cashSales,
        cardSales: parseFloat(stats.card_sales || 0),
        transferSales: parseFloat(stats.transfer_sales || 0),
        openingCash,
        expectedCash,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Close POS Shift and reconcile cash drawer.
 */
export async function closeShiftAction(shiftId: number, closingCash: number, notes?: string) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);

  try {
    const summary = await getShiftSummaryAction(shiftId);
    if (!summary.success || !summary.metrics) {
      return { success: false, error: "Unable to calculate shift reconciliation metrics." };
    }

    const expectedCash = summary.metrics.expectedCash;

    await sql`
      UPDATE pos_shifts SET
        closed_at = NOW(),
        closing_cash = ${closingCash},
        expected_cash = ${expectedCash},
        notes = ${notes || null},
        status = 'closed'
      WHERE id = ${shiftId} AND tenant_id = ${tenantId}
    `;

    await logSystemAction(
      `Closed POS shift #${shiftId}: counted cash ${closingCash}, expected ${expectedCash} (variance: ${closingCash - expectedCash})`
    );

    return { success: true, variance: closingCash - expectedCash };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Core Checkout Service:
 * 1. Decrements stock in atomic DB transaction.
 * 2. Creates accounting invoice in `invoices` and `invoice_items`.
 * 3. Creates income entry in `admin_incomes` (posted directly to existing ledger).
 * 4. Records POS receipt in `pos_orders`.
 */
export async function checkoutPosOrderAction(payload: CheckoutPayload, shiftId?: number | null) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  if (!payload.items || payload.items.length === 0) {
    return { success: false, error: "Cart is empty." };
  }

  try {
    // 1. Resolve User Name
    const userRow = await sql`SELECT full_name FROM admin_users WHERE id = ${userId} LIMIT 1`;
    const userName = userRow[0]?.full_name || 'Cashier';

    // 2. Generate unique order number and invoice number
    const orderNumber = await generateOrderNumber(tenantId);
    const invoiceId = await generateInvoiceId(tenantId);

    // 3. Resolve customer / client in admin_clients
    const customerName = (payload.customerName || 'Walk-in Customer').trim();
    const customerPhone = payload.customerPhone?.trim() || null;

    let clientId: string | null = null;
    const clientRows = await sql`
      SELECT id FROM admin_clients 
      WHERE tenant_id = ${tenantId} AND (LOWER(full_name) = LOWER(${customerName}))
      LIMIT 1
    `;
    if (clientRows.length > 0) {
      clientId = clientRows[0].id;
    } else {
      clientId = 'C-POS-' + Date.now();
      await sql`
        INSERT INTO admin_clients (id, full_name, phone, active, tenant_id)
        VALUES (${clientId}, ${customerName}, ${customerPhone}, true, ${tenantId})
      `;
    }

    // 4. Resolve default account for income posting
    const settings = await getPosSettings(tenantId);
    let accountId = settings.default_account_id;
    if (!accountId) {
      const accRows = await sql`
        SELECT id FROM accounts 
        WHERE tenant_id = ${tenantId} 
        ORDER BY CASE WHEN LOWER(type) = 'cash' THEN 1 WHEN LOWER(name) LIKE '%cash%' THEN 2 ELSE 3 END ASC 
        LIMIT 1
      `;
      if (accRows.length > 0) accountId = accRows[0].id;
    }

    // 5. Execute stock decrement and accounting records in an atomic transaction
    const updatedStockItems: Array<{
      inventoryId: number;
      newQuantity: number;
      reason: string;
      name?: string;
      sku?: string;
      previousQty?: number;
    }> = [];

    const transactionResult = await sql.begin(async (trx) => {
      // a. Decrement stock for every line item
      const stockMovements = payload.items.map(item => ({
        inventoryId: item.id,
        changeQty: -Math.abs(item.quantity),
        reason: 'sale' as const,
        referenceType: 'pos_order',
        referenceId: orderNumber,
        notes: `POS sale ${orderNumber}`,
      }));

      // Stock decrement with concurrency check
      for (const mov of stockMovements) {
        const itemRows = await trx`
          SELECT id, item_name, quantity, sku
          FROM admin_inventory
          WHERE id::text = ${String(mov.inventoryId)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
          FOR UPDATE
        `;

        if (itemRows.length === 0) {
          throw new Error(`Inventory item #${mov.inventoryId} not found.`);
        }

        const currentItem = itemRows[0];
        const previousQty = parseFloat(currentItem.quantity || 0);
        const newQty = previousQty + mov.changeQty;

        if (newQty < 0 && !settings.allow_negative_stock) {
          throw new Error(
            `Insufficient stock for "${currentItem.item_name}" (${currentItem.sku || 'No SKU'}). In stock: ${previousQty}, requested: ${Math.abs(mov.changeQty)}`
          );
        }

        await trx`
          UPDATE admin_inventory
          SET quantity = ${newQty},
              status = ${newQty <= 0 ? 'Out of Stock' : 'Available'},
              updated_at = NOW()
          WHERE id::text = ${String(currentItem.id)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
        `;

        await trx`
          INSERT INTO stock_movements (
            tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, user_name, notes, created_at
          ) VALUES (
            ${tenantId}, ${currentItem.id}, ${mov.changeQty}, ${previousQty}, ${newQty}, ${mov.reason},
            ${mov.referenceType}, ${mov.referenceId}, ${userId}, ${userName}, ${mov.notes}, NOW()
          )
        `;

        updatedStockItems.push({
          inventoryId: Number(currentItem.id),
          name: currentItem.item_name,
          sku: currentItem.sku || 'No SKU',
          previousQty,
          newQuantity: newQty,
          reason: 'sale',
        });
      }

      // b. Insert Invoice into existing `invoices` table
      const today = new Date().toISOString().split('T')[0];
      await trx`
        INSERT INTO invoices (
          invoice_id, client_id, project_name, date,
          subtotal, discount, total, advance, total_due,
          work_status, payment_status, currency, category, bank_account_id,
          tax_rate, legal_name, tenant_id
        ) VALUES (
          ${invoiceId}, ${clientId}, ${`POS Sale: ${orderNumber}`}, ${today},
          ${payload.subtotal}, ${payload.discountAmount}, ${payload.totalAmount}, ${payload.totalAmount}, 0,
          'completed', 'fully paid', 'LKR', 'POS', ${accountId || null},
          ${payload.taxAmount > 0 ? (payload.taxAmount / (payload.subtotal || 1)) * 100 : 0}, ${customerName}, ${tenantId}
        )
      `;

      // c. Insert Invoice Line Items into `invoice_items`
      for (const item of payload.items) {
        const qty = item.quantity;
        const price = item.price;
        const lineTotal = qty * price;
        await trx`
          INSERT INTO invoice_items (invoice_id, description, quantity, price, total, tenant_id)
          VALUES (${invoiceId}, ${`${item.name} (${item.sku})`}, ${qty}, ${price}, ${lineTotal}, ${tenantId})
        `;
      }

      // d. Insert Income into existing `admin_incomes` table
      await trx`
        INSERT INTO admin_incomes (
          date, amount, description, category, payment_method, invoice_id, client_id, account_id, tenant_id
        ) VALUES (
          ${today}, ${payload.totalAmount}, ${`POS Sale #${orderNumber}`}, 'Sales', ${payload.paymentMethod},
          ${invoiceId}, ${clientId}, ${accountId || null}, ${tenantId}
        )
      `;

      // e. Insert into `pos_orders`
      const orderRow = await trx`
        INSERT INTO pos_orders (
          tenant_id, order_number, invoice_id, shift_id, user_id, user_name,
          customer_name, customer_phone, subtotal, discount_amount, tax_amount,
          total_amount, payment_method, amount_tendered, change_returned,
          status, items_json, created_at, updated_at
        ) VALUES (
          ${tenantId}, ${orderNumber}, ${invoiceId}, ${shiftId || null}, ${userId}, ${userName},
          ${customerName}, ${customerPhone}, ${payload.subtotal}, ${payload.discountAmount}, ${payload.taxAmount},
          ${payload.totalAmount}, ${payload.paymentMethod}, ${payload.amountTendered}, ${payload.changeReturned},
          'completed', ${sql.json(payload.items as any)}, NOW(), NOW()
        )
        RETURNING *
      `;

      return orderRow[0];
    });

    // Push updated stock to WooCommerce immediately so online store reflects real-time quantity
    try {
      const { enqueueWooStockPush } = await import("@/lib/woocommerce/push-service");
      await enqueueWooStockPush(
        tenantId,
        updatedStockItems,
        { source: 'pos', immediate: true }
      );
    } catch (pushErr) {
      console.warn("[POS Checkout WooCommerce Push Error]", pushErr);
    }

    await logSystemAction(`Completed POS sale #${orderNumber} for LKR ${payload.totalAmount} (${payload.paymentMethod})`);

    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/invoices");
    revalidatePath("/user/income");
    revalidatePath("/user/inventory");
    revalidatePath("/user/dashboard");

    return {
      success: true,
      order: transactionResult,
      orderNumber,
      invoiceId,
      updatedStockItems,
    };
  } catch (err: any) {
    console.error("checkoutPosOrderAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Refund POS Order and restore inventory stock.
 */
export async function refundPosOrderAction(orderId: number, reason: string = 'Customer return') {
  const perm = await requirePosPermission('pos.refund');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    const orderRows = await sql`
      SELECT * FROM pos_orders WHERE id = ${orderId} AND tenant_id = ${tenantId} LIMIT 1
    `;
    if (orderRows.length === 0) return { success: false, error: "Order not found." };

    const order = orderRows[0];
    if (order.status === 'refunded') {
      return { success: false, error: "Order is already refunded." };
    }

    const items: CartItem[] = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []);
    const restoredItems: Array<{
      inventoryId: number;
      newQuantity: number;
      reason: string;
      name?: string;
      sku?: string;
      previousQty?: number;
    }> = [];

    await sql.begin(async (trx) => {
      // 1. Restore stock
      for (const item of items) {
        const itemRows = await trx`
          SELECT id, quantity FROM admin_inventory WHERE id::text = ${String(item.id)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL) FOR UPDATE
        `;
        if (itemRows.length > 0) {
          const curQty = parseFloat(itemRows[0].quantity || 0);
          const newQty = curQty + item.quantity;
          await trx`
            UPDATE admin_inventory
            SET quantity = ${newQty}, status = 'Available', updated_at = NOW()
            WHERE id::text = ${String(item.id)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
          `;
          await trx`
            INSERT INTO stock_movements (
              tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, notes, created_at
            ) VALUES (
              ${tenantId}, ${item.id}, ${item.quantity}, ${curQty}, ${newQty}, 'refund',
              'pos_refund', ${order.order_number}, ${userId}, ${reason}, NOW()
            )
          `;
          restoredItems.push({
            inventoryId: Number(item.id),
            name: item.name || 'Product',
            sku: item.sku || 'No SKU',
            previousQty: curQty,
            newQuantity: newQty,
            reason: 'refund',
          });
        }
      }

      // 2. Mark order as refunded
      await trx`
        UPDATE pos_orders SET status = 'refunded', updated_at = NOW() WHERE id = ${orderId} AND tenant_id = ${tenantId}
      `;

      // 3. Update invoice payment status if present
      if (order.invoice_id) {
        await trx`
          UPDATE invoices SET payment_status = 'refunded' WHERE invoice_id = ${order.invoice_id} AND tenant_id = ${tenantId}
        `;
      }
    });

    // Push restored stock to WooCommerce immediately
    try {
      const { enqueueWooStockPush } = await import("@/lib/woocommerce/push-service");
      await enqueueWooStockPush(
        tenantId,
        restoredItems,
        { source: 'pos_refund', immediate: true }
      );
    } catch (pushErr) {
      console.warn("[POS Refund WooCommerce Push Error]", pushErr);
    }

    await logSystemAction(`Refunded POS order #${order.order_number}: ${reason}`);
    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/invoices");
    revalidatePath("/user/inventory");
    return { success: true, restoredItems };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Void POS Order and restore inventory stock.
 */
export async function voidPosOrderAction(orderId: number, reason: string = 'Voided by manager') {
  const perm = await requirePosPermission('pos.void');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const userId = Number(perm.context.userId);

  try {
    const orderRows = await sql`
      SELECT * FROM pos_orders WHERE id = ${orderId} AND tenant_id = ${tenantId} LIMIT 1
    `;
    if (orderRows.length === 0) return { success: false, error: "Order not found." };

    const order = orderRows[0];
    if (order.status === 'voided') {
      return { success: false, error: "Order is already voided." };
    }

    const items: CartItem[] = typeof order.items_json === 'string' ? JSON.parse(order.items_json) : (order.items_json || []);
    const voidRestoredItems: Array<{
      inventoryId: number;
      newQuantity: number;
      reason: string;
      name?: string;
      sku?: string;
      previousQty?: number;
    }> = [];

    await sql.begin(async (trx) => {
      // 1. Restore stock
      for (const item of items) {
        const itemRows = await trx`
          SELECT id, quantity FROM admin_inventory WHERE id::text = ${String(item.id)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL) FOR UPDATE
        `;
        if (itemRows.length > 0) {
          const curQty = parseFloat(itemRows[0].quantity || 0);
          const newQty = curQty + item.quantity;
          await trx`
            UPDATE admin_inventory
            SET quantity = ${newQty}, status = 'Available', updated_at = NOW()
            WHERE id::text = ${String(item.id)} AND (tenant_id::text = ${String(tenantId)} OR tenant_id IS NULL)
          `;
          await trx`
            INSERT INTO stock_movements (
              tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason, reference_type, reference_id, user_id, notes, created_at
            ) VALUES (
              ${tenantId}, ${item.id}, ${item.quantity}, ${curQty}, ${newQty}, 'void',
              'pos_void', ${order.order_number}, ${userId}, ${reason}, NOW()
            )
          `;
          voidRestoredItems.push({
            inventoryId: Number(item.id),
            name: item.name || 'Product',
            sku: item.sku || 'No SKU',
            previousQty: curQty,
            newQuantity: newQty,
            reason: 'void',
          });
        }
      }

      // 2. Mark order as voided
      await trx`
        UPDATE pos_orders SET status = 'voided', updated_at = NOW() WHERE id = ${orderId} AND tenant_id = ${tenantId}
      `;

      // 3. Mark invoice as cancelled
      if (order.invoice_id) {
        await trx`
          UPDATE invoices SET payment_status = 'cancelled' WHERE invoice_id = ${order.invoice_id} AND tenant_id = ${tenantId}
        `;
      }
    });

    // Push restored stock to WooCommerce immediately
    try {
      const { enqueueWooStockPush } = await import("@/lib/woocommerce/push-service");
      await enqueueWooStockPush(
        tenantId,
        voidRestoredItems,
        { source: 'pos_void', immediate: true }
      );
    } catch (pushErr) {
      console.warn("[POS Void WooCommerce Push Error]", pushErr);
    }

    await logSystemAction(`Voided POS order #${order.order_number}: ${reason}`);
    revalidatePath("/pos");
    revalidatePath("/user/stock");
    revalidatePath("/user/invoices");
    revalidatePath("/user/inventory");
    return { success: true, restoredItems: voidRestoredItems };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Load recent POS orders list.
 */
export async function loadPosOrdersAction(options?: {
  shiftId?: number;
  limit?: number;
  page?: number;
  search?: string;
}) {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, orders: [], total: 0 };
  }

  const tenantId = Number(perm.context.tenantId);
  const limit = options?.limit ?? 50;
  const page = options?.page ?? 1;
  const offset = (page - 1) * limit;

  try {
    const shiftFilter = options?.shiftId
      ? sql`AND shift_id = ${options.shiftId}`
      : sql``;
    const searchFilter = options?.search?.trim()
      ? sql`AND (order_number ILIKE ${`%${options.search.trim()}%`} OR customer_name ILIKE ${`%${options.search.trim()}%`})`
      : sql``;

    const orders = await sql`
      SELECT *
      FROM pos_orders
      WHERE tenant_id = ${tenantId}
        ${shiftFilter}
        ${searchFilter}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countRows = await sql`
      SELECT COUNT(*) as count
      FROM pos_orders
      WHERE tenant_id = ${tenantId}
        ${shiftFilter}
        ${searchFilter}
    `;

    return {
      success: true,
      orders: orders.map((o: any) => ({
        ...o,
        subtotal: parseFloat(o.subtotal || 0),
        discount_amount: parseFloat(o.discount_amount || 0),
        tax_amount: parseFloat(o.tax_amount || 0),
        total_amount: parseFloat(o.total_amount || 0),
        amount_tendered: parseFloat(o.amount_tendered || 0),
        change_returned: parseFloat(o.change_returned || 0),
        items: typeof o.items_json === 'string' ? JSON.parse(o.items_json) : (o.items_json || []),
        created_at: new Date(o.created_at).toISOString(),
      })),
      total: parseInt(countRows[0]?.count || '0'),
    };
  } catch (err: any) {
    return { success: false, error: err.message, orders: [], total: 0 };
  }
}
