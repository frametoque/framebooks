import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { createCheckoutSession } from "@/lib/payment-gateway";
import { addPackageGatewayFee } from "@/lib/payment-gateway/fee";

export async function POST(req: NextRequest) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const numId = Number(userId) || 0;

    const body = await req.json().catch(() => ({}));
    const {
      planName = "Pro",
      billingInterval = "monthly",
      couponCode,
      tenantId: requestedTenantId,
    } = body;

    // 1. Resolve user and tenant
    const userRows = await sql`
      SELECT id, email, full_name, tenant_id FROM admin_users 
      WHERE (id = ${numId} AND ${numId} > 0) OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    let tenantId = requestedTenantId ? Number(requestedTenantId) : userRows[0]?.tenant_id;
    if (!tenantId) {
      // Check owned tenant
      const owned = await sql`
        SELECT id FROM tenants WHERE LOWER(owner_email) = ${email} ORDER BY id DESC LIMIT 1
      `;
      if (owned.length > 0) tenantId = owned[0].id;
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "No workspace found to attach payment to." },
        { status: 400 }
      );
    }

    // Resolve dynamic base URL so return URLs always match the current environment
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "https://books.frametoque.com");

    // 2. Fetch plan details and pricing
    const planRows = await sql`
      SELECT id, name, key, price_monthly, price_yearly, currency 
      FROM plans 
      WHERE LOWER(name) = LOWER(${planName}) OR LOWER(key) = LOWER(${planName})
      LIMIT 1
    `;

    if (planRows.length === 0) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    const plan = planRows[0];
    const baseAmount = billingInterval === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    let amount = addPackageGatewayFee(baseAmount, billingInterval);

    // 3. Apply coupon if provided
    let appliedCouponData: any = null;
    if (couponCode) {
      const cleanCode = String(couponCode).trim().toUpperCase();
      const couponRows = await sql`
        SELECT * FROM coupons 
        WHERE UPPER(code) = ${cleanCode} AND is_active = true 
        AND (valid_to IS NULL OR valid_to > NOW())
        LIMIT 1
      `;
      if (couponRows.length > 0) {
        const c = couponRows[0];
        appliedCouponData = c;
        if (c.type === "percent" || c.type === "percentage") {
          amount = Math.round(amount * (1 - Number(c.value) / 100));
        } else if (c.type === "fixed") {
          amount = Math.max(0, amount - Number(c.value));
        }
      }
    }

    // If amount is 0 (100% complimentary discount / free), immediately activate subscription without gateway redirect
    if (amount <= 0) {
      await sql`
        UPDATE tenants 
        SET plan = ${plan.name}, payment_status = 'paid'
        WHERE id = ${tenantId}
      `;

      const existingSub = await sql`
        SELECT id FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY id DESC LIMIT 1
      `;
      const isComplimentaryLifetime = Boolean(appliedCouponData && (appliedCouponData.type === 'percent' || appliedCouponData.type === 'percentage') && Number(appliedCouponData.value) >= 100);
      const periodEnd = new Date();
      if (isComplimentaryLifetime) {
        periodEnd.setFullYear(periodEnd.getFullYear() + 100);
      } else if (billingInterval === "yearly") {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      if (existingSub.length > 0) {
        await sql`
          UPDATE subscriptions SET
            plan_id = ${plan.id},
            status = 'active',
            billing_interval = ${billingInterval},
            current_period_start = NOW(),
            current_period_end = ${periodEnd},
            coupon_code = COALESCE(${appliedCouponData ? appliedCouponData.code : null}, coupon_code),
            updated_at = NOW()
          WHERE id = ${existingSub[0].id}
        `;
      } else {
        await sql`
          INSERT INTO subscriptions (
            tenant_id, plan_id, status, billing_interval, current_period_start, current_period_end, coupon_code
          ) VALUES (
            ${tenantId},
            ${plan.id},
            'active',
            ${billingInterval},
            NOW(),
            ${periodEnd},
            ${appliedCouponData ? appliedCouponData.code : null}
          )
        `;
      }

      if (appliedCouponData) {
        try {
          await sql`
            INSERT INTO coupon_redemptions (coupon_id, tenant_id, user_id, redeemed_at)
            VALUES (${appliedCouponData.id}, ${tenantId}, ${userRows[0]?.id || null}, NOW())
          `;
          await sql`
            UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${appliedCouponData.id}
          `;
        } catch (e) {
          console.warn("Could not log coupon redemption:", e);
        }
      }

      try {
        await sql`
          INSERT INTO subscription_payments (
            tenant_id, user_id, plan_name, billing_cycle, amount, currency, status, method, provider, provider_reference
          ) VALUES (
            ${tenantId},
            ${userRows[0]?.id || null},
            ${plan.name},
            ${billingInterval},
            0,
            ${plan.currency || 'LKR'},
            'paid',
            ${appliedCouponData ? 'coupon' : 'free'},
            ${appliedCouponData ? 'coupon' : 'free'},
            ${appliedCouponData ? `CPN-${appliedCouponData.code}-${Date.now().toString().slice(-6)}` : `PLAN-FREE-${Date.now().toString().slice(-6)}`}
          )
        `;
      } catch (e) {
        console.warn("Could not insert payment record:", e);
      }

      return NextResponse.json({
        success: true,
        checkoutUrl: appliedCouponData 
          ? `${baseUrl}/billing/success?session_id=CPN_${appliedCouponData.code}` 
          : `${baseUrl}/billing/success?plan=${encodeURIComponent(plan.name)}`,
      });
    }

    // 4. Create Gateway Checkout Session
    const userName = userRows[0]?.full_name || session?.user?.name || "Customer";

    const result = await createCheckoutSession({
      tenantId,
      userId: userRows[0]?.id || null,
      userEmail: email,
      userName,
      planId: plan.id,
      planName: plan.name,
      billingInterval,
      amount,
      currency: plan.currency || "LKR",
      couponCode,
      successUrl: `${baseUrl}/billing/success`,
      cancelUrl: `${baseUrl}/user/settings/billing?billing_status=cancelled`,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[Checkout API Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to create checkout session." },
      { status: 500 }
    );
  }
}

