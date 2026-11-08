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

export async function clearWorkspacePaymentsAction() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };
    await sql`DELETE FROM payments WHERE tenant_id = ${Number(tenantId)}`.catch(() => {});
    revalidatePath("/user/settings");
    return { success: true };
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

    const { session } = await auth().catch(() => ({ session: null }));
    const sessionEmail = (session?.user?.email || "").toLowerCase();

    // Check if workspace is 'itsnelitha' / 'nelitha' / 'itselitha' (testing workspace) - clear test past payments as requested
    const tenantRows = await sql`
      SELECT id, name, owner_email, email 
      FROM tenants 
      WHERE id = ${Number(tenantId)} 
      LIMIT 1
    `.catch(() => []);
    const t = tenantRows[0];
    const textToCheck = `${t?.name || ""} ${t?.owner_email || ""} ${t?.email || ""} ${sessionEmail}`.toLowerCase();
    
    if (
      textToCheck.includes("itsnelitha") ||
      textToCheck.includes("nelitha") ||
      textToCheck.includes("itselitha")
    ) {
      await sql`DELETE FROM payments WHERE tenant_id = ${Number(tenantId)}`.catch(() => {});
      return { success: true, history: [] };
    }

    // Query payments table for this tenant
    const paymentRows = await sql`
      SELECT 
        p.id, 
        COALESCE(pl.name, 'Subscription') AS plan_name, 
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

    return {
      success: true,
      history: paymentRows.map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        date: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "",
      })),
    };
  } catch (err: any) {
    console.error("Error fetching subscription history:", err);
    return { success: false, error: err.message, history: [] };
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

    let rows: any[] = [];
    try {
      rows = await sql`
        SELECT 
          s.id,
          s.status,
          s.billing_interval,
          s.current_period_start,
          s.current_period_end,
          s.provider_subscription_id,
          s.source,
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
    } catch (queryErr: any) {
      if (queryErr.message?.includes("provider_subscription_id") || queryErr.code === "42703") {
        rows = await sql`
          SELECT 
            s.id,
            s.status,
            s.billing_interval,
            s.current_period_start,
            s.current_period_end,
            NULL::varchar AS provider_subscription_id,
            s.source,
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
      } else {
        throw queryErr;
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
          const now = new Date();
          const expiryType = c.expiry_type || "manual";
          const durationMonths = Number(c.duration_months || 1);

          // Check for month-based auto-expiration
          let isExpired = false;
          if (expiryType === "months") {
            const appliedAt = rows[0]?.current_period_start 
              ? new Date(rows[0].current_period_start) 
              : rows[0]?.created_at 
                ? new Date(rows[0].created_at) 
                : null;

            if (appliedAt) {
              const expirationTime = new Date(appliedAt);
              expirationTime.setMonth(expirationTime.getMonth() + durationMonths);
              if (now >= expirationTime) {
                isExpired = true;
              }
            }
          }

          if (isExpired) {
            // Month-based coupon has reached its expiration; remove from active subscription
            if (rows.length > 0 && rows[0].id) {
              await sql`UPDATE subscriptions SET coupon_code = NULL WHERE id = ${rows[0].id}`.catch(() => {});
            }
            activeCoupon = null;
          } else {
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
              expiryType,
              durationMonths,
            };
            if (rows.length > 0 && rows[0].coupon_code !== c.code) {
              await sql`UPDATE subscriptions SET coupon_code = ${c.code} WHERE id = ${rows[0].id}`.catch(() => {});
            }
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

export async function cancelSubscriptionAction(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return { success: false, error: "Unauthorized" };

    let subRows: any[] = [];
    try {
      subRows = await sql`
        SELECT id, provider_subscription_id, source FROM subscriptions 
        WHERE tenant_id = ${Number(tenantId)} AND status = 'active'
        ORDER BY id DESC LIMIT 1
      `;
    } catch (queryErr: any) {
      if (queryErr.message?.includes("provider_subscription_id") || queryErr.code === "42703") {
        subRows = await sql`
          SELECT id, NULL::varchar AS provider_subscription_id, source FROM subscriptions 
          WHERE tenant_id = ${Number(tenantId)} AND status = 'active'
          ORDER BY id DESC LIMIT 1
        `;
      } else {
        throw queryErr;
      }
    }

    if (subRows.length === 0) {
      return { success: false, error: "No active subscription found to cancel." };
    }

    const sub = subRows[0];
    if (sub.provider_subscription_id && (sub.source === "payments_lk" || !sub.source)) {
      const { cancelPaymentsLkSubscription } = await import("@/lib/payment-gateway/payments-lk");
      await cancelPaymentsLkSubscription(sub.provider_subscription_id).catch(() => {});
    }

    await sql`
      UPDATE subscriptions 
      SET auto_renew = false, status = 'canceled', updated_at = NOW()
      WHERE id = ${sub.id}
    `;

    revalidatePath("/user/settings");
    return {
      success: true,
      message: "Your subscription has been canceled. You will continue to have access until the end of your billing cycle.",
    };
  } catch (err: any) {
    console.error("Error canceling subscription:", err);
    return { success: false, error: err.message || "Failed to cancel subscription." };
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

    const { getGatewayConfig } = await import("@/lib/payment-gateway");
    if (getGatewayConfig().paymentsLk.cardPaymentsDisabled) {
      return { success: false, error: "Card payments are currently disabled on the live environment." };
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
    expiryType?: string;
    durationMonths?: number;
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

    const expiryType = coupon.expiry_type || "manual";
    const durationMonths = Number(coupon.duration_months || 1);

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
        expiryType,
        durationMonths,
      },
    };
  } catch (err: any) {
    console.error("Coupon validation error in billing:", err);
    return { success: false, message: err.message || "Failed to validate coupon." };
  }
}

/**
 * Attaches a validated coupon directly to the active subscription.
 * Month-based coupons will auto-expire after their duration, whereas
 * manual coupons remain active across cycles until manually deactivated.
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
    expiryType?: string;
    durationMonths?: number;
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

    const months = valRes.coupon.durationMonths || 1;
    const expiresAt = valRes.coupon.expiryType === "months"
      ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000)
      : null;

    // 1. Update or create subscription row
    const subRows = await sql`
      SELECT id FROM subscriptions WHERE tenant_id = ${Number(tenantId)} ORDER BY id DESC LIMIT 1
    `;
    if (subRows.length > 0) {
      await sql`
        UPDATE subscriptions 
        SET coupon_code = ${valRes.coupon.code},
            coupon_applied_at = NOW(),
            coupon_expires_at = ${expiresAt},
            updated_at = NOW()
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
          current_period_start, current_period_end, coupon_code,
          coupon_applied_at, coupon_expires_at, created_at, updated_at
        ) VALUES (
          ${Number(tenantId)}, ${planId}, 'active', 'monthly',
          NOW(), NOW() + interval '30 days', ${valRes.coupon.code},
          NOW(), ${expiresAt}, NOW(), NOW()
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
 * Initiates switching the billing interval (monthly <-> yearly) for the workspace's active subscription.
 * Using native Payments.lk Subscriptions (POST /v1/subscriptions), this redirects the customer
 * to hosted checkout to authorize the subscription at the target interval.
 */
export async function switchBillingIntervalAction(params: {
  targetInterval: "monthly" | "yearly";
  couponCode?: string;
}): Promise<{
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  requiresRedirect?: boolean;
  newInterval?: "monthly" | "yearly";
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

    let subRows: any[] = [];
    try {
      subRows = await sql`
        SELECT 
          s.id,
          s.status,
          s.billing_interval,
          s.plan_id,
          s.provider_subscription_id,
          pl.id AS resolved_plan_id,
          pl.name AS plan_name
        FROM subscriptions s
        LEFT JOIN plans pl ON s.plan_id = pl.id
        WHERE s.tenant_id = ${Number(tenantId)}
        ORDER BY s.id DESC
        LIMIT 1
      `;
    } catch (queryErr: any) {
      subRows = await sql`
        SELECT 
          s.id,
          s.status,
          s.billing_interval,
          s.plan_id,
          NULL::varchar AS provider_subscription_id,
          pl.id AS resolved_plan_id,
          pl.name AS plan_name
        FROM subscriptions s
        LEFT JOIN plans pl ON s.plan_id = pl.id
        WHERE s.tenant_id = ${Number(tenantId)}
        ORDER BY s.id DESC
        LIMIT 1
      `;
    }

    const tenantRows = await sql`SELECT id, plan FROM tenants WHERE id = ${Number(tenantId)} LIMIT 1`;

    if (tenantRows.length === 0) {
      return { success: false, error: "Workspace tenant not found." };
    }

    const sub = subRows[0] || null;
    const activePlanName = sub?.plan_name || tenantRows[0]?.plan || "Free";

    if (activePlanName.toLowerCase() === "free") {
      return {
        success: false,
        error: "Free workspaces do not have an active paid subscription. Please upgrade to Pro or Pro Plus first.",
      };
    }

    const currentInterval = sub?.billing_interval || "monthly";
    if (currentInterval === targetInterval) {
      return {
        success: false,
        error: `Your subscription is already on ${targetInterval} billing.`,
      };
    }

    const planLookup = await sql`
      SELECT id, name, price_monthly, price_yearly, currency 
      FROM plans 
      WHERE LOWER(name) = LOWER(${activePlanName}) OR LOWER(key) = LOWER(${activePlanName})
      LIMIT 1
    `;
    const plan = planLookup[0];
    const planId = plan?.id || sub?.resolved_plan_id || sub?.plan_id || 2;
    const basePrice = targetInterval === "yearly" ? Number(plan?.price_yearly || 50000) : Number(plan?.price_monthly || 5000);
    const amount = addPackageGatewayFee(basePrice, targetInterval);

    const { createCheckoutSession } = await import("@/lib/payment-gateway");
    const { session, userId } = await auth();
    const email = session?.user?.email || "";
    const userName = session?.user?.name || "Customer";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://books.frametoque.com";

    const tenantLookup = await sql`
      SELECT id, name, phone, email, owner_email, billing_name, billing_email 
      FROM tenants 
      WHERE id = ${Number(tenantId)} 
      LIMIT 1
    `.catch(() => []);
    const tRow = tenantLookup[0];
    const userPhone = tRow?.phone || "";
    const resolvedCustomerName = tRow?.billing_name || userName || tRow?.name || "Customer";
    const resolvedCustomerEmail = tRow?.billing_email || email || tRow?.owner_email || "";

    const sessionRes = await createCheckoutSession({
      tenantId: Number(tenantId),
      userId: userId ? Number(userId) : undefined,
      userEmail: resolvedCustomerEmail,
      userName: resolvedCustomerName,
      userPhone,
      planId,
      planName: activePlanName,
      billingInterval: targetInterval,
      amount,
      currency: plan?.currency || "LKR",
      couponCode: params.couponCode,
      successUrl: `${baseUrl}/user/settings?tab=billing&switched=true`,
      cancelUrl: `${baseUrl}/user/settings?tab=billing`,
    });

    if (!sessionRes.success) {
      return { success: false, error: sessionRes.error || "Failed to initiate subscription switch." };
    }

    return {
      success: true,
      checkoutUrl: sessionRes.checkoutUrl,
      sessionId: sessionRes.sessionId,
      requiresRedirect: sessionRes.requiresRedirect,
      newInterval: targetInterval,
      message: "Redirecting to secure checkout to confirm your new subscription interval...",
    };
  } catch (err: any) {
    console.error("Error switching billing interval:", err);
    return { success: false, error: err.message || "Failed to switch billing cycle." };
  }
}

// Backwards compatibility aliases
export async function switchBillingIntervalWithWalletAction(params: {
  targetInterval: "monthly" | "yearly";
  couponCode?: string;
}) {
  return await switchBillingIntervalAction(params);
}

export async function rechargeAndSwitchBillingIntervalAction(params: {
  targetInterval: "monthly" | "yearly";
  shortfall: number;
  couponCode?: string;
}) {
  return await switchBillingIntervalAction(params);
}

