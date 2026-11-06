"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { getActivePlans, DBPlan } from "@/lib/plans-db";
import { revalidatePath } from "next/cache";

export async function getAvailablePlansAction(): Promise<{ success: boolean; plans: DBPlan[] }> {
  try {
    const plans = await getActivePlans();
    return { success: true, plans };
  } catch (err: any) {
    console.error("Error fetching active plans:", err);
    return { success: false, plans: [] };
  }
}

import { createCheckoutSession, completeSandboxCheckout, getGatewayStatus } from "@/lib/payment-gateway";
import { addPackageGatewayFee } from "@/lib/payment-gateway/fee";

export async function getGatewayStatusAction() {
  try {
    return { success: true, status: getGatewayStatus() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSubscriptionHistory() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    // 1. Query payments table for this tenant
    const paymentRows = await sql`
      SELECT 
        p.id, 
        COALESCE(pl.name, 'Pro') AS plan_name, 
        p.amount, 
        p.receipt_url, 
        p.method,
        p.provider,
        p.provider_reference,
        p.status, 
        p.notes AS review_note, 
        p.created_at
      FROM payments p
      LEFT JOIN plans pl ON p.plan_id = pl.id
      WHERE p.tenant_id = ${tenantId}
      ORDER BY p.created_at DESC
    `;

    // 2. Query workspace wallet transactions
    const walletRows = await sql`
      SELECT 
        id, 
        amount, 
        type, 
        description, 
        provider, 
        provider_reference, 
        balance_after, 
        created_at
      FROM workspace_wallet_transactions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;

    // 3. Fallback to legacy tenant_subscriptions if payments is empty
    let legacyRows: any[] = [];
    if (paymentRows.length === 0) {
      legacyRows = await sql`
        SELECT id, plan_name, amount, slip_url AS receipt_url, 'card' AS method, 'online' AS provider, '' AS provider_reference, status, review_note, created_at
        FROM tenant_subscriptions
        WHERE tenant_id = ${tenantId}
        ORDER BY created_at DESC
      `;
    }

    const seenRefs = new Set<string>();
    const combined: any[] = [];

    // Add payment rows
    for (const p of (paymentRows.length > 0 ? paymentRows : legacyRows)) {
      if (p.provider_reference) seenRefs.add(p.provider_reference);
      combined.push(p);
    }

    // Add wallet transactions (wallet recharges, auto card pulls, etc.)
    for (const w of walletRows) {
      if (w.provider_reference && seenRefs.has(w.provider_reference)) {
        continue;
      }
      if (w.provider_reference) seenRefs.add(w.provider_reference);

      const isTopup = w.type === "topup" || Number(w.amount) > 0;
      combined.push({
        id: `wallet_${w.id}`,
        plan_name: isTopup ? "Wallet Recharge" : (w.description || "Wallet Payment"),
        amount: Math.abs(Number(w.amount)),
        receipt_url: null,
        method: w.type === "auto_card_pull" ? "Saved Card (Auto Top-Up)" : (w.provider === "payments_lk" ? "Payments_lk (Card)" : "Wallet"),
        provider: w.provider || "payments_lk",
        provider_reference: w.provider_reference || `WAL-${w.id}`,
        status: "paid",
        review_note: w.description,
        created_at: w.created_at,
        is_wallet_tx: true,
      });
    }

    // Sort all records by date descending
    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, history: combined };
  } catch (err: any) {
    console.error("Error fetching subscription history:", err);
    return { success: false, error: err.message };
  }
}

export async function createBillingCheckoutSession(params: {
  planName: string;
  billingCycle: "monthly" | "yearly";
}) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    const { userId, session } = await auth();
    const email = session?.user?.email || "";

    const planRows = await sql`
      SELECT id, name, price_monthly, price_yearly, currency FROM plans 
      WHERE LOWER(name) = LOWER(${params.planName}) OR LOWER(key) = LOWER(${params.planName})
      LIMIT 1
    `;

    if (planRows.length === 0) {
      return { success: false, error: "Invalid plan selected." };
    }

    const plan = planRows[0];
    const baseAmount = params.billingCycle === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    const amount = addPackageGatewayFee(baseAmount, params.billingCycle);

    const checkoutRes = await createCheckoutSession({
      tenantId: Number(tenantId),
      userId: userId ? Number(userId) : null,
      userEmail: email,
      userName: session?.user?.name || "Customer",
      planId: plan.id,
      planName: plan.name,
      billingInterval: params.billingCycle,
      amount,
      currency: plan.currency || "LKR",
    });

    return checkoutRes;
  } catch (err: any) {
    console.error("Error creating billing checkout session:", err);
    return { success: false, error: err.message || "Failed to create checkout session." };
  }
}

export async function activateSandboxSubscriptionAction(params: {
  planName: string;
  billingCycle: "monthly" | "yearly";
}) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    const { userId } = await auth();

    const planRows = await sql`
      SELECT price_monthly, price_yearly FROM plans 
      WHERE LOWER(name) = LOWER(${params.planName}) OR LOWER(key) = LOWER(${params.planName})
      LIMIT 1
    `;

    const baseAmount = params.billingCycle === "yearly" 
      ? Number(planRows[0]?.price_yearly || 25000) 
      : Number(planRows[0]?.price_monthly || 2500);
    const amount = addPackageGatewayFee(baseAmount, params.billingCycle);

    const sessionId = `SB-UPGRADE-${tenantId}-${Date.now().toString().slice(-6)}`;

    const res = await completeSandboxCheckout({
      tenantId: Number(tenantId),
      userId: userId ? Number(userId) : null,
      planName: params.planName,
      billingInterval: params.billingCycle,
      amount,
      sessionId,
    });

    return res;
  } catch (err: any) {
    console.error("Error activating sandbox subscription:", err);
    return { success: false, error: err.message };
  }
}

export async function getActiveSubscriptionDetails() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    let rows = await sql`
      SELECT 
        s.id,
        s.status,
        s.billing_interval,
        s.current_period_start,
        s.current_period_end,
        s.saved_card_id,
        s.card_brand,
        s.card_last4,
        s.card_exp_month,
        s.card_exp_year,
        s.auto_renew,
        s.coupon_code,
        pl.name AS plan_name,
        pl.price_monthly,
        pl.price_yearly,
        pl.currency
      FROM subscriptions s
      LEFT JOIN plans pl ON s.plan_id = pl.id
      WHERE s.tenant_id = ${tenantId}
      ORDER BY s.id DESC
      LIMIT 1
    `;

    // If subscription has no saved card, attempt to auto-sync with Payments.lk
    if (rows.length > 0 && !rows[0].saved_card_id) {
      const t = await sql`SELECT owner_email FROM tenants WHERE id = ${tenantId} LIMIT 1`;
      if (t[0]?.owner_email) {
        try {
          const { syncCustomerSavedCard } = await import("@/lib/payment-gateway/payments-lk");
          const syncRes = await syncCustomerSavedCard(Number(tenantId), t[0].owner_email);
          if (syncRes.card) {
            rows = await sql`
              SELECT 
                s.id,
                s.status,
                s.billing_interval,
                s.current_period_start,
                s.current_period_end,
                s.saved_card_id,
                s.card_brand,
                s.card_last4,
                s.card_exp_month,
                s.card_exp_year,
                s.auto_renew,
                s.coupon_code,
                pl.name AS plan_name,
                pl.price_monthly,
                pl.price_yearly,
                pl.currency
              FROM subscriptions s
              LEFT JOIN plans pl ON s.plan_id = pl.id
              WHERE s.tenant_id = ${tenantId}
              ORDER BY s.id DESC
              LIMIT 1
            `;
          }
        } catch (e) {
          console.error("[getActiveSubscriptionDetails] Error syncing saved card:", e);
        }
      }
    }

    let couponCodeToVerify = rows[0]?.coupon_code || null;
    if (!couponCodeToVerify) {
      const redRows = await sql`
        SELECT c.code FROM coupon_redemptions cr
        JOIN coupons c ON cr.coupon_id = c.id
        WHERE cr.tenant_id = ${tenantId}
        ORDER BY cr.redeemed_at DESC LIMIT 1
      `;
      if (redRows.length > 0 && redRows[0].code) {
        couponCodeToVerify = redRows[0].code;
      }
    }

    let activeCoupon = null;
    if (couponCodeToVerify) {
      try {
        const cleanCode = String(couponCodeToVerify).trim().toUpperCase();
        const cRows = await sql`
          SELECT * FROM coupons 
          WHERE UPPER(code) = ${cleanCode} 
            AND is_active = true 
            AND (valid_from IS NULL OR valid_from <= NOW())
            AND (valid_to IS NULL OR valid_to > NOW())
            AND (max_redemptions IS NULL OR redeemed_count <= max_redemptions)
          LIMIT 1
        `;
        if (cRows.length > 0) {
          const c = cRows[0];
          const isPercent = c.type === "percent" || c.type === "percentage";
          const discountText = isPercent
            ? (Number(c.value) >= 100 ? "100% off" : `${c.value}% off`)
            : `LKR ${Number(c.value).toLocaleString()} off`;
          activeCoupon = {
            id: c.id,
            code: c.code,
            type: (isPercent ? "percent" : "fixed") as "percent" | "fixed",
            value: Number(c.value),
            discountText,
            isComplimentary: isPercent && Number(c.value) >= 100,
            applicablePlans: c.applicable_plans,
          };
          if (rows.length > 0 && rows[0].coupon_code !== c.code) {
            await sql`UPDATE subscriptions SET coupon_code = ${c.code} WHERE id = ${rows[0].id}`.catch(() => {});
          }
        }
      } catch (cErr) {
        console.error("Error reading coupon for active subscription:", cErr);
      }
    }

    if (rows.length === 0) {
      return { 
        success: true, 
        subscription: null,
        activeCoupon,
      };
    }

    return {
      success: true,
      subscription: {
        ...rows[0],
        price_monthly: addPackageGatewayFee(Number(rows[0].price_monthly), "monthly"),
        price_yearly: addPackageGatewayFee(Number(rows[0].price_yearly), "yearly"),
        activeCoupon,
      },
      activeCoupon,
    };
  } catch (err: any) {
    console.error("Error fetching active subscription details:", err);
    return { success: false, error: err.message };
  }
}

export async function toggleAutoRenewAction(autoRenew: boolean) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    await sql`
      UPDATE subscriptions 
      SET auto_renew = ${autoRenew}, updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    return { success: true, autoRenew };
  } catch (err: any) {
    console.error("Error toggling auto renew:", err);
    return { success: false, error: err.message };
  }
}

export async function removeSavedCardAction() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const subs = await sql`
      SELECT saved_card_id FROM subscriptions WHERE tenant_id = ${tenantId} AND saved_card_id IS NOT NULL LIMIT 1
    `;

    if (subs.length > 0 && subs[0].saved_card_id) {
      const { deletePaymentsLkSavedCard } = await import("@/lib/payment-gateway");
      await deletePaymentsLkSavedCard(subs[0].saved_card_id).catch(() => {});
    }

    await sql`
      UPDATE subscriptions 
      SET 
        saved_card_id = NULL,
        card_brand = NULL,
        card_last4 = NULL,
        card_exp_month = NULL,
        card_exp_year = NULL,
        auto_renew = false,
        updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error removing saved card:", err);
    return { success: false, error: err.message };
  }
}

export async function getWalletDetailsAction() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const { getTenantWallet } = await import("@/lib/payment-gateway");
    const wallet = await getTenantWallet(Number(tenantId));
    return { success: true, wallet };
  } catch (err: any) {
    console.error("Error fetching wallet details:", err);
    return { success: false, error: err.message };
  }
}

export async function toggleAutoPullCardAction(enabled: boolean) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    await sql`
      UPDATE tenants SET auto_pull_card = ${enabled} WHERE id = ${Number(tenantId)}
    `;

    return { success: true, autoPullCard: enabled };
  } catch (err: any) {
    console.error("Error toggling auto pull card:", err);
    return { success: false, error: err.message };
  }
}

export async function rechargeWalletWithSavedCardAction(amount: number) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    if (!amount || amount < 100) {
      return { success: false, error: "Minimum recharge amount is LKR 100." };
    }

    const subs = await sql`
      SELECT saved_card_id, card_brand, card_last4 
      FROM subscriptions 
      WHERE tenant_id = ${Number(tenantId)} AND saved_card_id IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (subs.length === 0 || !subs[0].saved_card_id) {
      return { success: false, error: "No saved card on file. Please recharge via Payments.lk checkout to save your card." };
    }

    const { chargePaymentsLkSavedCard, creditWallet } = await import("@/lib/payment-gateway");
    const amountCents = Math.round(amount * 100);
    const reference = `WALLET_RECHARGE_${tenantId}_${Date.now().toString().slice(-6)}`;

    const charge = await chargePaymentsLkSavedCard({
      cardId: subs[0].saved_card_id,
      amountCents,
      description: `Workspace Wallet Recharge (LKR ${amount.toLocaleString()})`,
      reference,
    });

    if (!charge.success) {
      return { success: false, error: charge.error || "Card charge failed." };
    }

    const cred = await creditWallet({
      tenantId: Number(tenantId),
      amount,
      type: "topup",
      description: `Instant wallet recharge from saved card (${subs[0].card_brand || "card"} •••• ${subs[0].card_last4 || ""})`,
      provider: "payments_lk",
      providerReference: charge.paymentId || reference,
    });

    await sql`
      INSERT INTO payments (
        tenant_id, amount, currency, method, provider, provider_reference, status, notes, paid_at, created_at
      ) VALUES (
        ${Number(tenantId)}, ${amount}, 'LKR', 'card', 'payments_lk', ${charge.paymentId || reference}, 'paid', 'Wallet recharge via saved card', NOW(), NOW()
      )
    `;

    return { success: true, newBalance: cred.newBalance };
  } catch (err: any) {
    console.error("Error recharging wallet with saved card:", err);
    return { success: false, error: err.message };
  }
}

export async function getBillingSettingsAction() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const rows = await sql`
      SELECT 
        id,
        name,
        email,
        owner_email,
        address,
        billing_email,
        billing_name,
        billing_address,
        billing_city,
        billing_postal_code,
        billing_country
      FROM tenants 
      WHERE id = ${Number(tenantId)}
      LIMIT 1
    `;

    if (rows.length === 0) return { success: false, error: "Tenant not found" };

    const t = rows[0];
    return {
      success: true,
      data: {
        billingEmail: t.billing_email || t.owner_email || t.email || "",
        billingName: t.billing_name || t.name || "",
        billingAddress: t.billing_address || t.address || "",
        billingCity: t.billing_city || "",
        billingPostalCode: t.billing_postal_code || "",
        billingCountry: t.billing_country || "Sri Lanka",
      },
    };
  } catch (err: any) {
    console.error("Error fetching billing settings:", err);
    return { success: false, error: err.message };
  }
}

export async function updateBillingDetailsAction(data: {
  billingEmail?: string;
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingPostalCode?: string;
  billingCountry?: string;
}) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    await sql`
      UPDATE tenants SET
        billing_email = COALESCE(${data.billingEmail !== undefined ? data.billingEmail.trim() : null}, billing_email),
        billing_name = COALESCE(${data.billingName !== undefined ? data.billingName.trim() : null}, billing_name),
        billing_address = COALESCE(${data.billingAddress !== undefined ? data.billingAddress.trim() : null}, billing_address),
        billing_city = COALESCE(${data.billingCity !== undefined ? data.billingCity.trim() : null}, billing_city),
        billing_postal_code = COALESCE(${data.billingPostalCode !== undefined ? data.billingPostalCode.trim() : null}, billing_postal_code),
        billing_country = COALESCE(${data.billingCountry !== undefined ? data.billingCountry.trim() : null}, billing_country)
      WHERE id = ${Number(tenantId)}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error updating billing details:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Validates a discount coupon code for subscription billing.
 */
export async function validateBillingCouponAction(code: string, planName?: string): Promise<{
  success: boolean;
  coupon?: {
    id: number;
    code: string;
    type: "percent" | "fixed";
    value: number;
    discountText: string;
    isComplimentary: boolean;
    applicablePlans?: string[] | null;
  };
  message?: string;
}> {
  try {
    const cleanCode = code?.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: "Please enter a coupon code" };

    const couponRows = await sql`
      SELECT * FROM coupons 
      WHERE UPPER(code) = ${cleanCode} AND is_active = true
      LIMIT 1
    `;

    if (couponRows.length === 0) {
      return { success: false, message: "Invalid or inactive coupon code." };
    }

    const coupon = couponRows[0];
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { success: false, message: "Coupon is not yet active." };
    }
    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      return { success: false, message: "Coupon has expired." };
    }
    if (coupon.max_redemptions !== null && Number(coupon.redeemed_count) >= Number(coupon.max_redemptions)) {
      return { success: false, message: "Coupon redemption limit reached." };
    }

    if (planName && coupon.applicable_plans && Array.isArray(coupon.applicable_plans) && coupon.applicable_plans.length > 0) {
      const normalizedPlan = planName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const isApplicable = coupon.applicable_plans.some((p: string) => {
        const norm = p.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        return norm === normalizedPlan || p.toLowerCase() === planName.toLowerCase();
      });
      if (!isApplicable) {
        return { success: false, message: `Coupon only applies to ${coupon.applicable_plans.join(", ")}.` };
      }
    }

    const discountText = coupon.type === "percent"
      ? (Number(coupon.value) >= 100 ? "100% off (Complimentary)" : `${coupon.value}% off`)
      : `LKR ${Number(coupon.value).toLocaleString()} off`;

    return {
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        discountText,
        isComplimentary: coupon.type === "percent" && Number(coupon.value) >= 100,
        applicablePlans: coupon.applicable_plans,
      },
    };
  } catch (err: any) {
    console.error("Coupon validation error in billing:", err);
    return { success: false, message: err.message || "Failed to validate coupon." };
  }
}

/**
 * Attaches a validated coupon directly to the active subscription, ensuring it is
 * automatically honored for auto-renewal cycles as long as the coupon remains active.
 */
export async function applyCouponToSubscriptionAction(couponCode: string): Promise<{
  success: boolean;
  coupon?: {
    id: number;
    code: string;
    type: "percent" | "fixed";
    value: number;
    discountText: string;
    isComplimentary: boolean;
    applicablePlans?: string[];
  };
  message?: string;
}> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, message: "Unauthorized" };

    // Validate coupon globally (dates, active status, max redemptions)
    const valRes = await validateBillingCouponAction(couponCode);
    if (!valRes.success || !valRes.coupon) {
      return { success: false, message: valRes.message || "Invalid or inactive coupon code." };
    }

    // 1. Update or create subscription row
    const subRows = await sql`
      SELECT id FROM subscriptions WHERE tenant_id = ${Number(tenantId)} ORDER BY id DESC LIMIT 1
    `;
    if (subRows.length > 0) {
      await sql`
        UPDATE subscriptions 
        SET coupon_code = ${valRes.coupon.code}, updated_at = NOW()
        WHERE id = ${subRows[0].id}
      `;
    } else {
      const t = await sql`SELECT plan FROM tenants WHERE id = ${Number(tenantId)} LIMIT 1`;
      const planName = t[0]?.plan || "Free";
      const pRows = await sql`SELECT id FROM plans WHERE LOWER(name) = LOWER(${planName}) LIMIT 1`;
      const planId = pRows[0]?.id || 1;
      await sql`
        INSERT INTO subscriptions (
          tenant_id, plan_id, status, billing_interval,
          current_period_start, current_period_end, coupon_code, created_at, updated_at
        ) VALUES (
          ${Number(tenantId)}, ${planId}, 'active', 'monthly',
          NOW(), NOW() + interval '30 days', ${valRes.coupon.code}, NOW(), NOW()
        )
      `;
    }

    // 2. Record redemption in coupon_redemptions if not already recorded
    const redRows = await sql`
      SELECT id FROM coupon_redemptions 
      WHERE tenant_id = ${Number(tenantId)} AND coupon_id = ${valRes.coupon.id} 
      LIMIT 1
    `;
    if (redRows.length === 0) {
      await sql`
        INSERT INTO coupon_redemptions (coupon_id, tenant_id, redeemed_at)
        VALUES (${valRes.coupon.id}, ${Number(tenantId)}, NOW())
      `;
      await sql`
        UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${valRes.coupon.id}
      `;
    }

    return {
      success: true,
      coupon: valRes.coupon,
      message: `Coupon "${valRes.coupon.code}" applied! (${valRes.coupon.discountText})`,
    };
  } catch (err: any) {
    console.error("Error applying coupon to subscription:", err);
    return { success: false, message: err.message || "Failed to apply coupon." };
  }
}

/**
 * Removes the saved coupon from the active subscription.
 */
export async function removeCouponFromSubscriptionAction() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, message: "Unauthorized" };

    await sql`
      UPDATE subscriptions 
      SET coupon_code = NULL, updated_at = NOW()
      WHERE tenant_id = ${Number(tenantId)}
    `;

    await sql`
      DELETE FROM coupon_redemptions WHERE tenant_id = ${Number(tenantId)}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error removing coupon from subscription:", err);
    return { success: false, message: err.message || "Failed to remove coupon." };
  }
}

/**
 * Changes the billing interval (monthly <-> yearly) for an active subscription,
 * strictly verifying and deducting the required plan fee from the workspace wallet balance.
 */
export async function switchBillingIntervalWithWalletAction(params: {
  targetInterval: "monthly" | "yearly";
  couponCode?: string;
}): Promise<{
  success: boolean;
  insufficientFunds?: boolean;
  requiredAmount?: number;
  walletBalance?: number;
  shortfall?: number;
  newInterval?: "monthly" | "yearly";
  newBalance?: number;
  error?: string;
  message?: string;
}> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const { targetInterval } = params;
    if (targetInterval !== "monthly" && targetInterval !== "yearly") {
      return { success: false, error: "Invalid billing cycle requested." };
    }

    // 1. Fetch current subscription and tenant plan
    const [subRows, tenantRows] = await Promise.all([
      sql`
        SELECT 
          s.id,
          s.status,
          s.billing_interval,
          s.plan_id,
          s.current_period_end,
          pl.id AS resolved_plan_id,
          pl.name AS plan_name,
          pl.price_monthly,
          pl.price_yearly,
          pl.currency
        FROM subscriptions s
        LEFT JOIN plans pl ON s.plan_id = pl.id
        WHERE s.tenant_id = ${Number(tenantId)}
        ORDER BY s.id DESC
        LIMIT 1
      `,
      sql`
        SELECT id, plan, wallet_balance FROM tenants WHERE id = ${Number(tenantId)} LIMIT 1
      `,
    ]);

    if (tenantRows.length === 0) {
      return { success: false, error: "Workspace tenant not found." };
    }

    const currentTenant = tenantRows[0];
    const sub = subRows[0] || null;

    // Check if free plan
    const activePlanName = sub?.plan_name || currentTenant.plan || "Free";
    if (activePlanName.toLowerCase() === "free") {
      return {
        success: false,
        error: "Free workspaces do not have an active paid subscription. Please upgrade to Pro or Pro Plus first.",
      };
    }

    // Check if already on requested interval
    const currentInterval = sub?.billing_interval || "monthly";
    if (currentInterval === targetInterval) {
      return {
        success: false,
        error: `Your subscription is already on ${targetInterval} billing.`,
      };
    }

    // Resolve plan pricing
    let priceMonthly = Number(sub?.price_monthly || 0);
    let priceYearly = Number(sub?.price_yearly || 0);
    let planId = sub?.resolved_plan_id || sub?.plan_id;

    if (!priceMonthly || !priceYearly || !planId) {
      const planLookup = await sql`
        SELECT id, name, price_monthly, price_yearly, currency
        FROM plans
        WHERE LOWER(name) = LOWER(${activePlanName}) OR LOWER(key) = LOWER(${activePlanName})
        LIMIT 1
      `;
      if (planLookup.length > 0) {
        planId = planLookup[0].id;
        priceMonthly = Number(planLookup[0].price_monthly);
        priceYearly = Number(planLookup[0].price_yearly);
      }
    }

    let requiredAmount = addPackageGatewayFee(targetInterval === "yearly" ? priceYearly : priceMonthly, targetInterval);
    let appliedCouponRow: any = null;

    if (params.couponCode) {
      const cleanCoupon = String(params.couponCode).trim().toUpperCase();
      const cRows = await sql`
        SELECT * FROM coupons 
        WHERE UPPER(code) = ${cleanCoupon} AND is_active = true
        AND (valid_to IS NULL OR valid_to > NOW())
        LIMIT 1
      `;
      if (cRows.length > 0) {
        appliedCouponRow = cRows[0];
        const rawPlans = appliedCouponRow.applicable_plans;
        const normPlan = activePlanName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isApplicable =
          !rawPlans ||
          !Array.isArray(rawPlans) ||
          rawPlans.length === 0 ||
          rawPlans.some((p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, "") === normPlan);

        if (isApplicable) {
          if (appliedCouponRow.type === "percent" || appliedCouponRow.type === "percentage") {
            requiredAmount = Math.round(requiredAmount * (1 - Number(appliedCouponRow.value) / 100));
          } else if (appliedCouponRow.type === "fixed") {
            requiredAmount = Math.max(0, requiredAmount - Number(appliedCouponRow.value));
          }
        }
      }
    }

    if (requiredAmount < 0) {
      return { success: false, error: "Invalid plan pricing for requested interval." };
    }

    const currentWalletBalance = Number(currentTenant.wallet_balance || 0);

    // 2. Strict Wallet Balance Check
    if (currentWalletBalance < requiredAmount) {
      const shortfall = requiredAmount - currentWalletBalance;
      return {
        success: false,
        insufficientFunds: true,
        requiredAmount,
        walletBalance: currentWalletBalance,
        shortfall,
        error: `Insufficient wallet balance. You have LKR ${currentWalletBalance.toLocaleString()}, but LKR ${requiredAmount.toLocaleString()} is required to switch to ${targetInterval} billing (Shortfall: LKR ${shortfall.toLocaleString()}). Please recharge your wallet first.`,
      };
    }

    // 3. Atomically deduct and apply interval change
    const { userId } = await auth();

    return await sql.begin(async (sqlTx) => {
      // Lock tenant row
      const tLocked = await sqlTx`
        SELECT wallet_balance FROM tenants WHERE id = ${Number(tenantId)} FOR UPDATE
      `;
      const freshBalance = Number(tLocked[0]?.wallet_balance || 0);
      if (freshBalance < requiredAmount) {
        return {
          success: false,
          insufficientFunds: true,
          error: "Insufficient wallet balance during checkout.",
        };
      }

      const newBalance = Math.round((freshBalance - requiredAmount) * 100) / 100;
      await sqlTx`
        UPDATE tenants SET wallet_balance = ${newBalance} WHERE id = ${Number(tenantId)}
      `;

      if (appliedCouponRow) {
        try {
          await sqlTx`
            INSERT INTO coupon_redemptions (coupon_id, tenant_id, user_id, redeemed_at)
            VALUES (${appliedCouponRow.id}, ${Number(tenantId)}, ${userId ? Number(userId) : null}, NOW())
          `;
          await sqlTx`
            UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${appliedCouponRow.id}
          `;
        } catch (e) {
          console.warn("Coupon redemption log error in switch:", e);
        }
      }

      const ref = `SW_CYCLE_${tenantId}_${targetInterval.toUpperCase()}_${Date.now().toString().slice(-6)}`;
      const description = `Switched billing cycle to ${targetInterval} for ${activePlanName}`;

      // Insert wallet transaction
      await sqlTx`
        INSERT INTO workspace_wallet_transactions (
          tenant_id,
          amount,
          type,
          description,
          provider,
          provider_reference,
          balance_after
        ) VALUES (
          ${Number(tenantId)},
          ${-requiredAmount},
          'subscription_fee',
          ${description},
          'wallet',
          ${ref},
          ${newBalance}
        )
      `;

      // Calculate period end: +12 months for yearly, +1 month for monthly from now
      const monthsToAdd = targetInterval === "yearly" ? 12 : 1;
      const newEnd = new Date();
      newEnd.setMonth(newEnd.getMonth() + monthsToAdd);

      // Update or create subscription
      if (sub?.id) {
        await sqlTx`
          UPDATE subscriptions SET
            billing_interval = ${targetInterval},
            current_period_start = NOW(),
            current_period_end = ${newEnd},
            status = 'active',
            coupon_code = COALESCE(${appliedCouponRow?.code || null}, coupon_code),
            updated_at = NOW()
          WHERE id = ${sub.id}
        `;
      } else {
        await sqlTx`
          INSERT INTO subscriptions (
            tenant_id,
            user_id,
            plan_id,
            status,
            billing_interval,
            current_period_start,
            current_period_end,
            source,
            coupon_code,
            auto_renew,
            created_at,
            updated_at
          ) VALUES (
            ${Number(tenantId)},
            ${userId ? Number(userId) : null},
            ${planId || null},
            'active',
            ${targetInterval},
            NOW(),
            ${newEnd},
            'workspace_wallet',
            ${appliedCouponRow?.code || null},
            true,
            NOW(),
            NOW()
          )
        `;
      }

      // Update tenant
      await sqlTx`
        UPDATE tenants SET
          plan = ${activePlanName},
          plan_expires_at = ${newEnd},
          payment_status = 'paid'
        WHERE id = ${Number(tenantId)}
      `;

      // Record payment
      await sqlTx`
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
          notes,
          paid_at,
          created_at
        ) VALUES (
          ${Number(tenantId)},
          ${userId ? Number(userId) : null},
          ${planId || null},
          ${requiredAmount},
          'LKR',
          'wallet',
          'workspace_wallet',
          ${ref},
          'paid',
          ${`Billing cycle changed to ${targetInterval} (LKR ${requiredAmount.toLocaleString()} paid from workspace wallet)`},
          NOW(),
          NOW()
        )
      `;

      return {
        success: true,
        newInterval: targetInterval,
        amountDeducted: requiredAmount,
        newBalance,
        message: `Billing cycle changed to ${targetInterval}! LKR ${requiredAmount.toLocaleString()} was deducted from your wallet balance.`,
      };
    });
  } catch (err: any) {
    console.error("Error switching billing interval with wallet:", err);
    return { success: false, error: err.message || "Failed to switch billing cycle." };
  } finally {
    try {
      revalidatePath("/user/settings");
      revalidatePath("/user/dashboard");
      revalidatePath("/admin/payments");
      revalidatePath("/admin/subscriptions");
    } catch {}
  }
}

/**
 * Recharges the wallet with the exact shortfall amount from the saved card
 * and immediately switches the billing interval to the target interval.
 */
export async function rechargeAndSwitchBillingIntervalAction(params: {
  targetInterval: "monthly" | "yearly";
  shortfall: number;
  couponCode?: string;
}): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  newBalance?: number;
}> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    const { targetInterval, shortfall, couponCode } = params;
    if (shortfall <= 0) {
      return await switchBillingIntervalWithWalletAction({ targetInterval, couponCode });
    }

    // Check saved card
    const subs = await sql`
      SELECT saved_card_id, card_brand, card_last4 
      FROM subscriptions 
      WHERE tenant_id = ${Number(tenantId)} AND saved_card_id IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (subs.length === 0 || !subs[0].saved_card_id) {
      return {
        success: false,
        error: "No saved card available to recharge the shortfall. Please top up your wallet manually.",
      };
    }

    const { chargePaymentsLkSavedCard, creditWallet } = await import("@/lib/payment-gateway");
    const amountCents = Math.round(shortfall * 100);
    const reference = `WALLET_PULL_${tenantId}_${Date.now().toString().slice(-6)}`;

    const charge = await chargePaymentsLkSavedCard({
      cardId: subs[0].saved_card_id,
      amountCents,
      description: `Workspace Wallet Recharge for Billing Cycle Switch (LKR ${shortfall.toLocaleString()})`,
      reference,
    });

    if (!charge.success) {
      return {
        success: false,
        error: charge.error || "Failed to charge saved card for wallet shortfall.",
      };
    }

    // Credit wallet with shortfall
    await creditWallet({
      tenantId: Number(tenantId),
      amount: shortfall,
      type: "auto_card_pull",
      description: `Auto card pull for billing cycle switch (${subs[0].card_brand || "card"} •••• ${subs[0].card_last4 || ""})`,
      provider: "payments_lk",
      providerReference: charge.paymentId || reference,
    });

    // Now execute wallet switch
    return await switchBillingIntervalWithWalletAction({ targetInterval, couponCode });
  } catch (err: any) {
    console.error("Error in rechargeAndSwitchBillingIntervalAction:", err);
    return { success: false, error: err.message || "Failed to recharge and switch." };
  }
}

