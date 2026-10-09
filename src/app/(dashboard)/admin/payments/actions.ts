// src/app/(dashboard)/admin/payments/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getPaymentsList({
  search = "",
  status = "",
  method = "",
  plan = "",
  page = 1,
  limit = 15,
}: {
  search?: string;
  status?: string;
  method?: string;
  plan?: string;
  page?: number;
  limit?: number;
}) {
  await requireAdmin("view_payments");

  const offset = (Math.max(1, page) - 1) * limit;
  const searchPattern = search ? `%${search.trim()}%` : null;

  const payments = await sql`
    SELECT 
      p.*,
      pl.name AS plan_name,
      t.name AS tenant_name,
      u.email AS user_email,
      u.full_name AS user_name
    FROM payments p
    LEFT JOIN plans pl ON p.plan_id = pl.id
    LEFT JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN admin_users u ON p.user_id = u.id
    WHERE (${searchPattern}::text IS NULL OR p.provider_reference ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR t.name ILIKE ${searchPattern})
      AND (${status || null}::text IS NULL OR p.status = ${status})
      AND (${method || null}::text IS NULL OR p.method = ${method})
      AND (${plan || null}::text IS NULL OR pl.key = ${plan} OR LOWER(pl.name) = LOWER(${plan}))
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const totalCountResult = await sql`
    SELECT COUNT(*)
    FROM payments p
    LEFT JOIN plans pl ON p.plan_id = pl.id
    LEFT JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN admin_users u ON p.user_id = u.id
    WHERE (${searchPattern}::text IS NULL OR p.provider_reference ILIKE ${searchPattern} OR u.email ILIKE ${searchPattern} OR t.name ILIKE ${searchPattern})
      AND (${status || null}::text IS NULL OR p.status = ${status})
      AND (${method || null}::text IS NULL OR p.method = ${method})
      AND (${plan || null}::text IS NULL OR pl.key = ${plan} OR LOWER(pl.name) = LOWER(${plan}))
  `;

  const totalCount = parseInt(totalCountResult[0].count);

  return {
    payments,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    page,
  };
}

export async function getPaymentsSummary() {
  await requireAdmin("view_payments");

  const [collectedRes, pendingRes, failedRes, refundedRes] = await Promise.all([
    sql`SELECT COALESCE(SUM(amount), 0) AS sum FROM payments WHERE status = 'paid'`,
    sql`SELECT COALESCE(SUM(amount), 0) AS sum FROM payments WHERE status = 'pending'`,
    sql`SELECT COALESCE(SUM(amount), 0) AS sum FROM payments WHERE status = 'failed'`,
    sql`SELECT COALESCE(SUM(amount), 0) AS sum FROM payments WHERE status IN ('refunded', 'partially_refunded')`,
  ]);

  return {
    totalCollected: parseInt(collectedRes[0].sum) || 0,
    totalPending: parseInt(pendingRes[0].sum) || 0,
    totalFailed: parseInt(failedRes[0].sum) || 0,
    totalRefunded: parseInt(refundedRes[0].sum) || 0,
  };
}

/**
 * Idempotent payment approval running in a PostgreSQL transaction.
 * Extends the subscription and tenant expiration based on the selected time period (1 month, 2 months, 1 year, etc.).
 */
export async function approvePayment(
  paymentId: number,
  options?: {
    period?: string;
    monthsCount?: number;
    notes?: string;
  } | string
) {
  const actor = await requireAdmin("manage_payments");

  const opts = typeof options === "string" ? { notes: options } : options || {};
  let monthsToAdd = 1;
  if (opts.monthsCount && opts.monthsCount > 0) {
    monthsToAdd = opts.monthsCount;
  } else if (opts.period) {
    switch (opts.period) {
      case "1_month": monthsToAdd = 1; break;
      case "2_months": monthsToAdd = 2; break;
      case "3_months": monthsToAdd = 3; break;
      case "6_months": monthsToAdd = 6; break;
      case "1_year": monthsToAdd = 12; break;
      default: monthsToAdd = 1; break;
    }
  }

  const periodLabel = monthsToAdd === 12 ? "1 year" : `${monthsToAdd} month${monthsToAdd > 1 ? "s" : ""}`;
  const notesText = opts.notes ? `${opts.notes} (Period: ${periodLabel})` : `Approved for ${periodLabel}`;

  return await sql.begin(async (sqlTx) => {
    // 1. Fetch payment with lock
    const payRows = await sqlTx`
      SELECT p.*, pl.name AS plan_name, pl.key AS plan_key
      FROM payments p
      LEFT JOIN plans pl ON p.plan_id = pl.id
      WHERE p.id = ${paymentId}
      FOR UPDATE
    `;
    if (payRows.length === 0) throw new Error("Payment record not found");
    const pay = payRows[0];

    // Idempotency check: if already paid, return early safely
    if (pay.status === 'paid') {
      return { success: true, message: "Payment was already approved." };
    }

    // 2. Mark payment as paid
    await sqlTx`
      UPDATE payments SET
        status = 'paid',
        paid_at = NOW(),
        notes = ${pay.notes ? `${pay.notes} | ${notesText}` : notesText}
      WHERE id = ${paymentId}
    `;

    // 3. Extend / activate subscription if tenant exists
    if (pay.tenant_id) {
      const subRows = await sqlTx`
        SELECT * FROM subscriptions 
        WHERE id = ${pay.subscription_id || 0} OR tenant_id = ${pay.tenant_id} 
        ORDER BY id DESC 
        LIMIT 1
        FOR UPDATE
      `;

      let subId = subRows.length > 0 ? subRows[0].id : null;
      const currentEnd = (subRows.length > 0 && subRows[0].current_period_end)
        ? new Date(subRows[0].current_period_end)
        : new Date();

      const newEnd = new Date(Math.max(Date.now(), currentEnd.getTime()));
      newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

      const billingInterval = monthsToAdd >= 12 ? 'yearly' : 'monthly';

      if (subId) {
        await sqlTx`
          UPDATE subscriptions SET
            status = 'active',
            billing_interval = ${billingInterval},
            current_period_end = ${newEnd},
            plan_id = COALESCE(${pay.plan_id}, plan_id),
            updated_at = NOW()
          WHERE id = ${subId}
        `;
      } else if (pay.plan_id) {
        const newSub = await sqlTx`
          INSERT INTO subscriptions (tenant_id, user_id, plan_id, status, billing_interval, current_period_start, current_period_end, source)
          VALUES (${pay.tenant_id}, ${pay.user_id}, ${pay.plan_id}, 'active', ${billingInterval}, NOW(), ${newEnd}, 'admin')
          RETURNING id
        `;
        subId = newSub[0].id;
        await sqlTx`UPDATE payments SET subscription_id = ${subId} WHERE id = ${paymentId}`;
      }

      // Update tenant plan
      if (pay.plan_name) {
        await sqlTx`
          UPDATE tenants SET
            plan = ${pay.plan_name},
            plan_expires_at = ${newEnd}
          WHERE id = ${pay.tenant_id}
        `;
      }

      // Sync tenant_subscriptions if matching record exists
      await sqlTx`
        UPDATE tenant_subscriptions SET
          status = 'approved',
          review_note = ${notesText}
        WHERE tenant_id = ${pay.tenant_id} 
          AND (status = 'pending' OR slip_url = ${pay.receipt_url})
      `;
    }

    // 4. Audit Log
    await logAdminAction({
      actor,
      action: "APPROVE_PAYMENT",
      targetType: "payment",
      targetId: paymentId,
      before: { status: pay.status },
      after: { status: 'paid', period: periodLabel, monthsToAdd, notes: notesText }
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/payments/${paymentId}`);
    revalidatePath("/admin/subscriptions");
    return { success: true };
  });
}

export async function rejectPayment(paymentId: number, reason: string) {
  const actor = await requireAdmin("manage_payments");

  const payRows = await sql`SELECT * FROM payments WHERE id = ${paymentId} LIMIT 1`;
  if (payRows.length === 0) throw new Error("Payment record not found");
  const pay = payRows[0];

  await sql`
    UPDATE payments SET
      status = 'failed',
      notes = ${reason ? `${pay.notes ? pay.notes + ' | Reason: ' : 'Reason: '}${reason}` : pay.notes}
    WHERE id = ${paymentId}
  `;

  if (pay.tenant_id) {
    await sql`
      UPDATE tenant_subscriptions SET
        status = 'rejected',
        review_note = ${reason || 'Declined by admin'}
      WHERE tenant_id = ${pay.tenant_id} 
        AND (status = 'pending' OR slip_url = ${pay.receipt_url})
    `;
  }

  await logAdminAction({
    actor,
    action: "REJECT_PAYMENT",
    targetType: "payment",
    targetId: paymentId,
    before: { status: pay.status },
    after: { status: 'failed', reason }
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  return { success: true };
}

export async function refundPayment(paymentId: number, amount: number, reason: string) {
  const actor = await requireAdmin("refund_payments");

  return await sql.begin(async (sqlTx) => {
    const payRows = await sqlTx`SELECT * FROM payments WHERE id = ${paymentId} FOR UPDATE`;
    if (payRows.length === 0) throw new Error("Payment record not found");
    const pay = payRows[0];

    if (pay.status !== 'paid' && pay.status !== 'partially_refunded') {
      throw new Error("Only completed payments can be refunded.");
    }

    if (amount <= 0 || amount > pay.amount) {
      throw new Error(`Refund amount must be between 1 and ${pay.amount} LKR`);
    }

    // Insert refund record
    await sqlTx`
      INSERT INTO refunds (payment_id, amount, reason, status, processed_by)
      VALUES (${paymentId}, ${amount}, ${reason}, 'completed', ${actor.email})
    `;

    // Check prior refunds
    const refundsTotal = await sqlTx`
      SELECT COALESCE(SUM(amount), 0) AS sum FROM refunds WHERE payment_id = ${paymentId}
    `;
    const totalRefunded = parseInt(refundsTotal[0].sum);
    const newStatus = totalRefunded >= pay.amount ? 'refunded' : 'partially_refunded';

    await sqlTx`
      UPDATE payments SET status = ${newStatus} WHERE id = ${paymentId}
    `;

    await logAdminAction({
      actor,
      action: "REFUND_PAYMENT",
      targetType: "payment",
      targetId: paymentId,
      before: { status: pay.status },
      after: { status: newStatus, refundedAmount: amount, reason }
    });

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/payments/${paymentId}`);
    return { success: true };
  });
}

export async function createManualPayment({
  tenantId,
  userId,
  planKey,
  amount,
  period = "1_month",
  monthsCount = 1,
  method = "bank_transfer",
  providerReference,
  receiptUrl,
  notes,
  isPaid = true,
}: {
  tenantId: number;
  userId?: number;
  planKey?: string;
  amount: number;
  period?: string;
  monthsCount?: number;
  method?: string;
  providerReference?: string;
  receiptUrl?: string;
  notes?: string;
  isPaid?: boolean;
}) {
  const actor = await requireAdmin("manage_payments");

  if (!tenantId) {
    throw new Error("Please select a tenant/workspace.");
  }

  let planId: number | null = null;
  if (planKey) {
    const p = await sql`SELECT id FROM plans WHERE key = ${planKey} OR LOWER(name) = LOWER(${planKey}) LIMIT 1`;
    if (p.length > 0) planId = p[0].id;
  }

  const payRows = await sql`
    INSERT INTO payments (
      tenant_id, user_id, plan_id, amount, currency, method, provider, provider_reference, status, receipt_url, notes, paid_at
    )
    VALUES (
      ${tenantId},
      ${userId || null},
      ${planId},
      ${amount},
      'LKR',
      ${method},
      'manual',
      ${providerReference || `MAN-${Date.now()}`},
      ${isPaid ? 'paid' : 'pending'},
      ${receiptUrl || null},
      ${notes || 'Created via admin console'},
      ${isPaid ? new Date() : null}
    )
    RETURNING id
  `;

  const newPayId = payRows[0].id;

  if (isPaid && tenantId) {
    await approvePayment(newPayId, {
      period,
      monthsCount,
      notes: notes || "Auto-activated manual payment",
    });
  }

  await logAdminAction({
    actor,
    action: "CREATE_MANUAL_PAYMENT",
    targetType: "payment",
    targetId: newPayId,
    after: { amount, method, tenantId, period, monthsCount }
  });

  revalidatePath("/admin/payments");
  return { success: true, paymentId: newPayId };
}

export async function getAllTenantsList() {
  await requireAdmin("view_payments");
  return await sql`
    SELECT id, name, plan, currency 
    FROM tenants 
    ORDER BY name ASC
  `;
}

export async function getPaymentDetail(paymentId: number) {
  await requireAdmin("view_payments");

  const payRows = await sql`
    SELECT 
      p.*,
      pl.name AS plan_name,
      pl.price_monthly,
      pl.price_yearly,
      t.name AS tenant_name,
      t.email AS tenant_email,
      u.email AS user_email,
      u.full_name AS user_name,
      s.status AS subscription_status,
      s.billing_interval AS subscription_interval
    FROM payments p
    LEFT JOIN plans pl ON p.plan_id = pl.id
    LEFT JOIN tenants t ON p.tenant_id = t.id
    LEFT JOIN admin_users u ON p.user_id = u.id
    LEFT JOIN subscriptions s ON p.subscription_id = s.id
    WHERE p.id = ${paymentId}
    LIMIT 1
  `;

  if (payRows.length === 0) return null;

  const refunds = await sql`
    SELECT * FROM refunds WHERE payment_id = ${paymentId} ORDER BY created_at DESC
  `;

  return {
    payment: payRows[0],
    refunds,
  };
}
