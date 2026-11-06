"use server";

import sql from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { getLandingPlansFormatted } from "@/lib/plans-db";
import { addPackageGatewayFee } from "@/lib/payment-gateway/fee";

export async function getOnboardingPlansAction() {
  try {
    const plans = await getLandingPlansFormatted();
    return { success: true, plans };
  } catch (err: any) {
    console.error("Failed to get onboarding plans:", err);
    return { success: false, plans: [] };
  }
}

export async function validateCouponAction(code: string, planName?: string) {
  try {
    const cleanCode = code?.trim().toUpperCase();
    if (!cleanCode) return { success: false, message: "Please enter a coupon code" };

    const couponRows = await sql`
      SELECT * FROM coupons 
      WHERE UPPER(code) = ${cleanCode} AND is_active = true
      LIMIT 1
    `;

    if (couponRows.length === 0) {
      return { success: false, message: "Invalid or inactive coupon code" };
    }

    const coupon = couponRows[0];
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return { success: false, message: "Coupon is not yet active" };
    }
    if (coupon.valid_to && new Date(coupon.valid_to) < now) {
      return { success: false, message: "Coupon has expired" };
    }
    if (coupon.max_redemptions !== null && coupon.redeemed_count >= coupon.max_redemptions) {
      return { success: false, message: "Coupon redemption limit reached" };
    }

    if (planName && coupon.applicable_plans && Array.isArray(coupon.applicable_plans) && coupon.applicable_plans.length > 0) {
      const normalizedPlan = planName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      const isApplicable = coupon.applicable_plans.some((p: string) => {
        const norm = p.toLowerCase().replace(/[^a-z0-9_]/g, "_");
        return norm === normalizedPlan || p.toLowerCase() === planName.toLowerCase();
      });
      if (!isApplicable) {
        return { success: false, message: `Coupon only applies to ${coupon.applicable_plans.join(", ")}` };
      }
    }

    const discountText = coupon.type === "percent"
      ? (coupon.value >= 100 ? "100% off (Complimentary)" : `${coupon.value}% off`)
      : `LKR ${Number(coupon.value).toLocaleString()} off`;

    return {
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discountText,
        isComplimentary: coupon.type === "percent" && coupon.value >= 100,
      }
    };
  } catch (err: any) {
    console.error("Coupon validation error:", err);
    return { success: false, message: err.message || "Failed to validate coupon" };
  }
}

export async function completeOnboarding(formData: FormData) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const businessName = formData.get("businessName") as string;
    if (!businessName) {
      return { success: false, error: "Business name is required." };
    }

    let logoUrl = null;
    const logoFile = formData.get("logo") as File;
    if (logoFile && logoFile.size > 0) {
      const cleanName = `${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const result = await uploadToR2({
        file: logoFile,
        fileName: cleanName,
        folder: "logos",
      });
      logoUrl = result.url;
    }

    const planName = (formData.get("plan") as string) || "Free";
    const couponCode = (formData.get("couponCode") as string)?.trim().toUpperCase();

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const fullName = session?.user?.name || "";

    // Enforce rule: each account can create at most 1 owned business profile
    const alreadyOwns = await sql`
      SELECT id, name FROM tenants WHERE LOWER(owner_email) = ${email} LIMIT 1
    `;
    if (alreadyOwns.length > 0) {
      return { 
        success: false, 
        error: `You have already created your business profile ("${alreadyOwns[0].name}"). Each account can create at most 1 owned business profile.` 
      };
    }

    // Validate coupon if provided
    let validatedCoupon: any = null;
    if (couponCode) {
      const couponCheck = await validateCouponAction(couponCode, planName);
      if (couponCheck.success && couponCheck.coupon) {
        validatedCoupon = couponCheck.coupon;
      }
    }

    const isFreePlan = planName.toLowerCase() === "free";
    const paymentStatus = isFreePlan ? 'paid' : 'pending_payment';

    // Create a new tenant with payment_status
    const newTenant = await sql`
      INSERT INTO tenants (name, owner_email, plan, currency, logo_url, payment_status) 
      VALUES (${businessName}, ${email}, ${planName}, 'LKR', ${logoUrl}, ${paymentStatus})
      RETURNING id
    `;
    const tenantId = newTenant[0].id;

    // Check if user already exists in admin_users
    const existing = await sql`
      SELECT id FROM admin_users 
      WHERE id = ${Number(userId) || 0} OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    let dbUserId: number;
    if (existing.length > 0) {
      const updated = await sql`
        UPDATE admin_users 
        SET tenant_id = ${tenantId}, role = 'owner', full_name = COALESCE(full_name, ${fullName}), last_login_at = NOW()
        WHERE id = ${existing[0].id}
        RETURNING id
      `;
      dbUserId = updated[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO admin_users (email, full_name, tenant_id, role, last_login_at)
        VALUES (${email}, ${fullName}, ${tenantId}, 'owner', NOW())
        ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = 'owner', last_login_at = NOW()
        RETURNING id
      `;
      dbUserId = inserted[0].id;
    }

    let isComplimentary = false;

    // If coupon was applied, record redemption
    if (validatedCoupon) {
      await sql`
        INSERT INTO coupon_redemptions (coupon_id, tenant_id, user_id, redeemed_at)
        VALUES (${validatedCoupon.id}, ${tenantId}, ${dbUserId}, NOW())
      `;
      await sql`
        UPDATE coupons SET redeemed_count = redeemed_count + 1 WHERE id = ${validatedCoupon.id}
      `;

      const planRows = await sql`
        SELECT id FROM plans 
        WHERE LOWER(name) = LOWER(${planName}) OR LOWER(key) = LOWER(${planName})
        LIMIT 1
      `;
      const planId = planRows[0]?.id || 1;

      if (validatedCoupon.isComplimentary) {
        isComplimentary = true;
        await sql`
          INSERT INTO subscriptions (
            tenant_id, user_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, coupon_code, source, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${dbUserId}, ${planId}, 'active', 'monthly',
            NOW(), NOW() + interval '100 years', ${validatedCoupon.code}, 'admin_comp', NOW(), NOW()
          )
        `;

        await sql`
          UPDATE tenants SET payment_status = 'paid' WHERE id = ${tenantId}
        `;
      } else {
        // Save coupon code on initial subscription record so it persists into settings & billing
        await sql`
          INSERT INTO subscriptions (
            tenant_id, user_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, coupon_code, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${dbUserId}, ${planId}, 'active', 'monthly',
            NOW(), NOW() + interval '30 days', ${validatedCoupon.code}, NOW(), NOW()
          )
        `;
      }
    }

    const requiresPayment = !isFreePlan && !isComplimentary;

    return {
      success: true,
      tenantId,
      planName,
      isComplimentary,
      hasDiscount: !!validatedCoupon,
      requiresPayment,
      coupon: validatedCoupon,
    };
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return { success: false, error: String(err?.message || err) };
  }
}

import { createCheckoutSession, completeSandboxCheckout, getGatewayStatus } from "@/lib/payment-gateway";

export async function getPaymentGatewayStatusAction() {
  try {
    return { success: true, status: getGatewayStatus() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getOnboardingStatusAction() {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const email = session?.user?.email?.trim().toLowerCase() || "";
    if (!email) {
      return { success: true, hasTenant: false };
    }

    // Check if the user owns a business profile
    const ownedTenantRows = await sql`
      SELECT id, name, plan, payment_status, logo_url, plan_expires_at 
      FROM tenants 
      WHERE LOWER(owner_email) = ${email}
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (ownedTenantRows.length === 0) {
      return { success: true, hasTenant: false };
    }

    const tenant = ownedTenantRows[0];
    const isFree = (tenant.plan || "").toLowerCase() === "free";

    // If tenant is on Free plan or explicitly marked as paid
    if (isFree || tenant.payment_status === "paid") {
      return {
        success: true,
        hasTenant: true,
        isApproved: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        plan: tenant.plan,
        paymentStatus: tenant.payment_status || "paid",
      };
    }

    // Tenant is on paid plan and payment_status is pending_payment
    return {
      success: true,
      hasTenant: true,
      isApproved: false,
      needsPayment: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan || "Pro",
    };
  } catch (err: any) {
    console.error("Error fetching onboarding status:", err);
    return { success: false, error: err.message };
  }
}

export async function initiateOnboardingCheckoutAction(params: {
  tenantId?: number;
  planName: string;
  billingCycle: "monthly" | "yearly";
  couponCode?: string;
}) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const numId = Number(userId) || 0;

    const userRows = await sql`
      SELECT id, full_name, tenant_id FROM admin_users 
      WHERE (id = ${numId} AND ${numId} > 0) OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    let tenantId = params.tenantId ? Number(params.tenantId) : userRows[0]?.tenant_id;
    if (!tenantId) {
      const owned = await sql`SELECT id FROM tenants WHERE LOWER(owner_email) = ${email} ORDER BY id DESC LIMIT 1`;
      if (owned.length > 0) tenantId = owned[0].id;
    }

    if (!tenantId) {
      return { success: false, error: "No workspace found to attach payment to." };
    }

    // Lookup plan
    const planRows = await sql`
      SELECT id, name, price_monthly, price_yearly, currency 
      FROM plans 
      WHERE LOWER(name) = LOWER(${params.planName}) OR LOWER(key) = LOWER(${params.planName})
      LIMIT 1
    `;

    if (planRows.length === 0) {
      return { success: false, error: "Invalid plan selected." };
    }

    const plan = planRows[0];
    const baseAmount = params.billingCycle === "yearly" ? Number(plan.price_yearly) : Number(plan.price_monthly);
    let amount = addPackageGatewayFee(baseAmount, params.billingCycle);

    if (params.couponCode) {
      const valRes = await validateCouponAction(params.couponCode, params.planName);
      if (valRes.success && valRes.coupon) {
        const c = valRes.coupon;
        if (c.type === "percent" || (c as any).type === "percentage") {
          amount = Math.round(amount * (1 - Number(c.value) / 100));
        } else if (c.type === "fixed") {
          amount = Math.max(0, amount - Number(c.value));
        }
      }
    }

    const userName = userRows[0]?.full_name || session?.user?.name || "Customer";
    const checkoutRes = await createCheckoutSession({
      tenantId,
      userId: userRows[0]?.id || null,
      userEmail: email,
      userName,
      planId: plan.id,
      planName: plan.name,
      billingInterval: params.billingCycle,
      amount,
      currency: plan.currency || "LKR",
      couponCode: params.couponCode,
    });

    return checkoutRes;
  } catch (err: any) {
    console.error("Error creating onboarding checkout:", err);
    return { success: false, error: err.message || "Failed to create checkout session." };
  }
}

export async function completeOnboardingSandboxAction(params: {
  tenantId: number;
  planName: string;
  billingCycle: "monthly" | "yearly";
  amount: number;
}) {
  try {
    const { userId } = await auth();
    const sandboxSession = `SB-${params.tenantId}-${Date.now().toString().slice(-6)}`;
    const res = await completeSandboxCheckout({
      tenantId: params.tenantId,
      userId: userId ? Number(userId) : null,
      planName: params.planName,
      billingInterval: params.billingCycle,
      amount: params.amount,
      sessionId: sandboxSession,
    });
    return res;
  } catch (err: any) {
    console.error("Error completing sandbox onboarding payment:", err);
    return { success: false, error: err.message };
  }
}

export async function switchToFreePlanAction() {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const numId = Number(userId) || 0;

    const userRows = await sql`
      SELECT tenant_id FROM admin_users 
      WHERE (id = ${numId} AND ${numId} > 0) OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    if (userRows.length === 0 || !userRows[0].tenant_id) {
      return { success: false, error: "Workspace not found." };
    }

    const tenantId = userRows[0].tenant_id;
    await sql`
      UPDATE tenants 
      SET plan = 'Free', payment_status = 'paid' 
      WHERE id = ${tenantId}
    `;

    return { success: true, redirect: "/user/dashboard" };
  } catch (err: any) {
    console.error("Error switching to free plan:", err);
    return { success: false, error: err.message };
  }
}
