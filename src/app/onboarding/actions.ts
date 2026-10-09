"use server";

import sql from "@/lib/db";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";

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
      const filename = `admin/tenants/${Date.now()}-${logoFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const blob = await put(filename, logoFile, { access: 'public' });
      logoUrl = blob.url;
    }

    const planName = (formData.get("plan") as string) || "Free";
    const couponCode = (formData.get("couponCode") as string)?.trim().toUpperCase();

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const fullName = session?.user?.name || "";

    // Validate coupon if provided
    let validatedCoupon: any = null;
    if (couponCode) {
      const couponCheck = await validateCouponAction(couponCode, planName);
      if (couponCheck.success && couponCheck.coupon) {
        validatedCoupon = couponCheck.coupon;
      }
    }

    // Create a new tenant
    const newTenant = await sql`
      INSERT INTO tenants (name, plan, currency, logo_url) 
      VALUES (${businessName}, ${planName}, 'LKR', ${logoUrl})
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
        SET tenant_id = ${tenantId}, role = 'owner', full_name = COALESCE(full_name, ${fullName})
        WHERE id = ${existing[0].id}
        RETURNING id
      `;
      dbUserId = updated[0].id;
    } else {
      const inserted = await sql`
        INSERT INTO admin_users (email, full_name, tenant_id, role)
        VALUES (${email}, ${fullName}, ${tenantId}, 'owner')
        ON CONFLICT (email) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = 'owner'
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

      // If 100% off coupon applied (e.g. EARLYACCESS), activate complimentary subscription immediately
      if (validatedCoupon.isComplimentary) {
        isComplimentary = true;
        const planRows = await sql`
          SELECT id FROM plans 
          WHERE LOWER(name) = LOWER(${planName}) OR LOWER(key) = LOWER(${planName})
          LIMIT 1
        `;
        const planId = planRows[0]?.id || 1;

        await sql`
          INSERT INTO subscriptions (
            tenant_id, user_id, plan_id, status, billing_interval,
            current_period_start, current_period_end, source, created_at, updated_at
          ) VALUES (
            ${tenantId}, ${dbUserId}, ${planId}, 'active', 'monthly',
            NOW(), NOW() + interval '100 years', 'admin_comp', NOW(), NOW()
          )
        `;
      }
    }

    return { 
      success: true, 
      isComplimentary,
      hasDiscount: !!validatedCoupon,
    };
  } catch (err) {
    console.error("Onboarding error:", err);
    return { success: false, error: String(err) };
  }
}
