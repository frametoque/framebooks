import sql from "@/lib/db";
import { chargeOrDeductWithAutoPull } from "./wallet";
import { addPackageGatewayFee } from "./fee";

export interface RenewalResult {
  tenantId: number;
  subscriptionId: number;
  planName: string;
  amount: number;
  success: boolean;
  paidVia?: string;
  paymentId?: string | number;
  error?: string;
}

/**
 * Iterates through all active subscriptions due for renewal.
 * Automatically attempts to deduct from the workspace wallet first;
 * if balance is insufficient, automatically pulls the shortfall from the saved card.
 */
export async function processDueSubscriptionRenewals(): Promise<{
  totalProcessed: number;
  successful: number;
  failed: number;
  results: RenewalResult[];
}> {
  const dueSubscriptions = await sql`
    SELECT 
      s.id,
      s.tenant_id,
      s.user_id,
      s.plan_id,
      s.billing_interval,
      s.saved_card_id,
      s.current_period_end,
      s.coupon_code,
      pl.name AS plan_name,
      pl.price_monthly,
      pl.price_yearly,
      pl.currency,
      t.name AS tenant_name,
      t.owner_email,
      t.wallet_balance
    FROM subscriptions s
    JOIN plans pl ON s.plan_id = pl.id
    JOIN tenants t ON s.tenant_id = t.id
    WHERE s.status = 'active'
      AND s.auto_renew = true
      AND (s.saved_card_id IS NOT NULL OR t.wallet_balance > 0)
      AND s.current_period_end <= NOW() + INTERVAL '1 hour'
    ORDER BY s.current_period_end ASC
    LIMIT 50
  `;

  const results: RenewalResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const sub of dueSubscriptions) {
    const isYearly = sub.billing_interval === "yearly";
    const baseAmount = isYearly ? Number(sub.price_yearly) : Number(sub.price_monthly);
    let amount = addPackageGatewayFee(baseAmount, isYearly ? "yearly" : "monthly");
    let appliedCouponName: string | null = null;

    // Apply coupon discount on renewal only if coupon is currently active and valid
    if (sub.coupon_code) {
      try {
        const cleanCoupon = String(sub.coupon_code).trim().toUpperCase();
        const cRows = await sql`
          SELECT * FROM coupons
          WHERE UPPER(code) = ${cleanCoupon}
            AND is_active = true
            AND (valid_from IS NULL OR valid_from <= NOW())
            AND (valid_to IS NULL OR valid_to > NOW())
            AND (max_redemptions IS NULL OR redeemed_count < max_redemptions)
          LIMIT 1
        `;

        if (cRows.length > 0) {
          const coupon = cRows[0];
          const rawPlans = coupon.applicable_plans;
          const normPlan = (sub.plan_name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const isApplicable =
            !rawPlans ||
            !Array.isArray(rawPlans) ||
            rawPlans.length === 0 ||
            rawPlans.some((p: string) => p.toLowerCase().replace(/[^a-z0-9]/g, "") === normPlan);

          if (isApplicable) {
            let discount = 0;
            if (coupon.type === "percent" || coupon.type === "percentage") {
              discount = Math.round(amount * (Number(coupon.value) / 100));
            } else if (coupon.type === "fixed") {
              discount = Math.min(amount, Number(coupon.value));
            }
            amount = Math.max(0, amount - discount);
            appliedCouponName = coupon.code;
          }
        }
      } catch (err) {
        console.error(`[Recurring Renewal] Error checking coupon for subscription ${sub.id}:`, err);
      }
    }

    const sanitizedPlan = (sub.plan_name || "Pro").replace(/\s+/g, "");
    const renewalRef = `FB_RENEW_${sub.tenant_id}_${sanitizedPlan}_${sub.billing_interval}_${Date.now().toString().slice(-6)}`;

    try {
      const deductRes = await chargeOrDeductWithAutoPull({
        tenantId: sub.tenant_id,
        userId: sub.user_id,
        amount,
        planName: sub.plan_name,
        billingInterval: sub.billing_interval as "monthly" | "yearly",
        description: appliedCouponName
          ? `Automated renewal for ${sub.plan_name} (${sub.billing_interval}) [Coupon: ${appliedCouponName}]`
          : `Automated renewal for ${sub.plan_name} (${sub.billing_interval})`,
        reference: renewalRef,
      });

      if (deductRes.success) {
        successful++;
        results.push({
          tenantId: sub.tenant_id,
          subscriptionId: sub.id,
          planName: sub.plan_name,
          amount,
          success: true,
          paidVia: deductRes.paidVia,
          paymentId: deductRes.paymentId,
        });
      } else {
        failed++;
        results.push({
          tenantId: sub.tenant_id,
          subscriptionId: sub.id,
          planName: sub.plan_name,
          amount,
          success: false,
          error: deductRes.error || "Renewal deduction failed",
        });
      }
    } catch (err: any) {
      failed++;
      results.push({
        tenantId: sub.tenant_id,
        subscriptionId: sub.id,
        planName: sub.plan_name,
        amount,
        success: false,
        error: err.message,
      });
    }
  }

  return {
    totalProcessed: dueSubscriptions.length,
    successful,
    failed,
    results,
  };
}

