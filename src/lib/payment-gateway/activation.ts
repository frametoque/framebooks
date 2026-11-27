import sql from "@/lib/db";
import { ActivationParams } from "./types";
import { revalidatePath } from "next/cache";

/**
 * Centrally and idempotently activates a tenant subscription upon confirmed payment gateway capture.
 */
export async function activateSubscriptionFromGateway(params: ActivationParams): Promise<{
  success: boolean;
  paymentId?: number;
  error?: string;
}> {
  const {
    tenantId,
    userId,
    planName,
    billingInterval,
    amount,
    currency = "LKR",
    provider,
    providerReference,
    receiptUrl,
    notes,
  } = params;

  try {
    return await sql.begin(async (sqlTx) => {
      // 1. Resolve Plan
      const planRows = await sqlTx`
        SELECT id, name, key, price_monthly, price_yearly 
        FROM plans 
        WHERE LOWER(name) = LOWER(${planName}) 
           OR LOWER(key) = LOWER(${planName})
           OR REPLACE(LOWER(name), ' ', '') = LOWER(${planName})
           OR REPLACE(LOWER(key), ' ', '') = LOWER(${planName})
        LIMIT 1
      `;

      const planId = planRows.length > 0 ? planRows[0].id : null;
      const resolvedPlanName = planRows.length > 0 ? planRows[0].name : planName;

      // 2. Check for existing payment with same provider reference (idempotency check)
      const existingPay = await sqlTx`
        SELECT id, status FROM payments 
        WHERE provider = ${provider} AND provider_reference = ${providerReference}
        LIMIT 1
        FOR UPDATE
      `;

      let paymentId: number;
      const auditNote = notes || `Online checkout via ${provider} (${billingInterval})`;

      if (existingPay.length > 0) {
        paymentId = existingPay[0].id;
        if (existingPay[0].status === "paid") {
          return { success: true, paymentId };
        }
        await sqlTx`
          UPDATE payments SET
            status = 'paid',
            paid_at = NOW(),
            amount = ${amount},
            receipt_url = COALESCE(${receiptUrl || null}, receipt_url),
            notes = ${auditNote}
          WHERE id = ${paymentId}
        `;
      } else {
        const inserted = await sqlTx`
          INSERT INTO payments (
            tenant_id,
            user_id,
            plan_id,
            amount,
            currency,
            method,
            provider,
            provider_reference,
            status,
            receipt_url,
            notes,
            paid_at,
            created_at
          ) VALUES (
            ${tenantId},
            ${userId || null},
            ${planId},
            ${amount},
            ${currency},
            'card',
            ${provider},
            ${providerReference},
            'paid',
            ${receiptUrl || null},
            ${auditNote},
            NOW(),
            NOW()
          )
          RETURNING id
        `;
        paymentId = inserted[0].id;
      }

      // 3. Calculate Period End (+1 month for monthly, +12 months for yearly)
      const monthsToAdd = billingInterval === "yearly" ? 12 : 1;
      const subRows = await sqlTx`
        SELECT id, current_period_end FROM subscriptions 
        WHERE tenant_id = ${tenantId}
        ORDER BY id DESC 
        LIMIT 1
        FOR UPDATE
      `;

      const currentEnd = subRows.length > 0 && subRows[0].current_period_end
        ? new Date(subRows[0].current_period_end)
        : new Date();

      const newEnd = new Date(Math.max(Date.now(), currentEnd.getTime()));
      newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

      // 4. Upsert subscription record
      if (subRows.length > 0) {
        await sqlTx`
          UPDATE subscriptions SET
            status = 'active',
            plan_id = COALESCE(${planId}, plan_id),
            billing_interval = ${billingInterval},
            current_period_start = NOW(),
            current_period_end = ${newEnd},
            source = ${provider},
            provider_subscription_id = COALESCE(${params.providerSubscriptionId || null}, provider_subscription_id),
            saved_card_id = COALESCE(${params.savedCardId || null}, saved_card_id),
            card_brand = COALESCE(${params.cardBrand || null}, card_brand),
            card_last4 = COALESCE(${params.cardLast4 || null}, card_last4),
            card_exp_month = COALESCE(${params.cardExpMonth || null}, card_exp_month),
            card_exp_year = COALESCE(${params.cardExpYear || null}, card_exp_year),
            auto_renew = COALESCE(${params.autoRenew !== undefined ? params.autoRenew : null}, auto_renew, true),
            coupon_code = COALESCE(${params.couponCode || null}, coupon_code),
            updated_at = NOW()
          WHERE id = ${subRows[0].id}
        `;
        await sqlTx`UPDATE payments SET subscription_id = ${subRows[0].id} WHERE id = ${paymentId}`;
      } else {
        const newSub = await sqlTx`
          INSERT INTO subscriptions (
            tenant_id,
            user_id,
            plan_id,
            status,
            billing_interval,
            current_period_start,
            current_period_end,
            source,
            provider_subscription_id,
            saved_card_id,
            card_brand,
            card_last4,
            card_exp_month,
            card_exp_year,
            auto_renew,
            coupon_code,
            created_at,
            updated_at
          ) VALUES (
            ${tenantId},
            ${userId || null},
            ${planId},
            'active',
            ${billingInterval},
            NOW(),
            ${newEnd},
            ${provider},
            ${params.providerSubscriptionId || null},
            ${params.savedCardId || null},
            ${params.cardBrand || null},
            ${params.cardLast4 || null},
            ${params.cardExpMonth || null},
            ${params.cardExpYear || null},
            ${params.autoRenew !== undefined ? params.autoRenew : true},
            ${params.couponCode || null},
            NOW(),
            NOW()
          )
          RETURNING id
        `;
        await sqlTx`UPDATE payments SET subscription_id = ${newSub[0].id} WHERE id = ${paymentId}`;
      }

      // 5. Update Tenant table plan and payment status
      await sqlTx`
        UPDATE tenants SET
          plan = ${resolvedPlanName},
          payment_status = 'paid',
          plan_expires_at = ${newEnd}
        WHERE id = ${tenantId}
      `;

      // 6. Update legacy tenant_subscriptions for backward compatibility
      const safeSlipUrl = receiptUrl || `gateway_${provider}`;
      await sqlTx`
        INSERT INTO tenant_subscriptions (
          tenant_id,
          plan_name,
          billing_cycle,
          amount,
          slip_url,
          status,
          review_note
        ) VALUES (
          ${tenantId},
          ${resolvedPlanName},
          ${billingInterval},
          ${amount},
          ${safeSlipUrl},
          'approved',
          ${`Instant online gateway payment (${provider})`}
        )
      `;

      // 7. If tenant had pending POS add-on requested during onboarding, activate it
      await sqlTx`
        UPDATE tenant_addons 
        SET status = 'active', expires_at = ${newEnd}, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND addon_key = 'pos'
      `.catch(() => {});

      return { success: true, paymentId };
    });
  } catch (err: any) {
    console.error("[Activation Error] Failed to activate subscription:", err);
    return { success: false, error: err.message || "Subscription activation failed." };
  } finally {
    try {
      revalidatePath("/user/dashboard");
      revalidatePath("/user/settings");
      revalidatePath("/admin/payments");
      revalidatePath("/admin/subscriptions");
    } catch {}
  }
}
