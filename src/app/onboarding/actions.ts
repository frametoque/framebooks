"use server";

import sql from "@/lib/db";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { getLandingPlansFormatted } from "@/lib/plans-db";

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

        await sql`
          UPDATE tenants SET payment_status = 'paid' WHERE id = ${tenantId}
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

export async function getCompanyBankDetailsAction() {
  try {
    const rows = await sql`SELECT value FROM platform_settings WHERE key = 'bank_details' LIMIT 1`;
    if (rows.length > 0 && rows[0].value) {
      return { success: true, bankDetails: rows[0].value };
    }
  } catch {}
  return {
    success: true,
    bankDetails: {
      bank: "Bank of Ceylon",
      accountName: "B.N.V.P. Fernando",
      accountNumber: "4833004",
      branch: "Moratuwa / LKR",
    }
  };
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
    const tenantId = tenant.id;
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
    // Check payments table for this tenant
    const paymentRows = await sql`
      SELECT id, plan_id, amount, status, receipt_url, notes, created_at 
      FROM payments 
      WHERE tenant_id = ${tenantId} 
      ORDER BY id DESC 
      LIMIT 1
    `;

    if (paymentRows.length > 0) {
      const p = paymentRows[0];
      if (p.status === "paid") {
        return {
          success: true,
          hasTenant: true,
          isApproved: true,
          tenantId: tenant.id,
          tenantName: tenant.name,
          plan: tenant.plan,
        };
      }
      if (p.status === "failed") {
        return {
          success: true,
          hasTenant: true,
          isApproved: false,
          isRejected: true,
          reason: p.notes,
          tenantId: tenant.id,
          tenantName: tenant.name,
          plan: tenant.plan,
          payment: {
            id: p.id,
            amount: p.amount,
            receiptUrl: p.receipt_url,
            notes: p.notes,
            createdAt: p.created_at,
          },
        };
      }
      // status === 'pending'
      return {
        success: true,
        hasTenant: true,
        isApproved: false,
        isPending: true,
        tenantId: tenant.id,
        tenantName: tenant.name,
        plan: tenant.plan,
        payment: {
          id: p.id,
          amount: p.amount,
          receiptUrl: p.receipt_url,
          notes: p.notes,
          createdAt: p.created_at,
        },
      };
    }

    // No payment submitted yet, but tenant exists with pending payment
    return {
      success: true,
      hasTenant: true,
      isApproved: false,
      needsPaymentUpload: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      plan: tenant.plan,
    };
  } catch (err: any) {
    console.error("Error fetching onboarding status:", err);
    return { success: false, error: err.message };
  }
}

export async function submitOnboardingPaymentAction(formData: FormData) {
  try {
    const { userId, session } = await auth();
    if (!userId && !session?.user) {
      return { success: false, error: "Unauthorized" };
    }

    const email = session?.user?.email?.trim().toLowerCase() || "";
    const numId = Number(userId) || 0;

    const userRows = await sql`
      SELECT id, tenant_id FROM admin_users 
      WHERE (id = ${numId} AND ${numId} > 0) OR (email IS NOT NULL AND LOWER(email) = ${email})
      LIMIT 1
    `;

    let tenantId = userRows[0]?.tenant_id;
    const formTenantId = formData.get("tenantId");
    if (formTenantId) {
      tenantId = Number(formTenantId);
    }

    if (!tenantId) {
      return { success: false, error: "No workspace found to attach payment to." };
    }

    const dbUserId = userRows[0]?.id || null;
    const planName = (formData.get("planName") as string) || "Pro";
    const billingCycle = (formData.get("billingCycle") as string) || "monthly";
    const amountVal = formData.get("amount");
    const amount = amountVal ? Number(amountVal) : 0;
    const slipFile = formData.get("slip") as File;
    const customerNotes = (formData.get("notes") as string) || "";

    if (!amount || amount <= 0) {
      return { success: false, error: "Please enter a valid payment amount." };
    }

    if (!slipFile || slipFile.size === 0) {
      return { success: false, error: "Please upload a photo of the payment slip." };
    }

    // 1. Upload to Cloudflare R2
    const cleanFileName = `${tenantId}-${Date.now()}-${slipFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const result = await uploadToR2({
      file: slipFile,
      fileName: cleanFileName,
      folder: "subscriptions",
    });
    const slipUrl = result.url;

    // 2. Lookup plan ID
    let planId: number | null = null;
    if (planName) {
      const p = await sql`
        SELECT id FROM plans 
        WHERE LOWER(name) = LOWER(${planName}) OR key = LOWER(${planName}) 
        LIMIT 1
      `;
      if (p.length > 0) planId = p[0].id;
    }

    const ref = `SLIP-${tenantId}-${Date.now().toString().slice(-6)}`;
    const fullNotes = `Bank slip uploaded for ${planName} (${billingCycle})${customerNotes ? ` | Ref: ${customerNotes}` : ''}`;

    // 3. Insert into payments table
    const paymentInsert = await sql`
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
        created_at
      )
      VALUES (
        ${tenantId},
        ${dbUserId},
        ${planId},
        ${amount},
        'LKR',
        'bank_transfer',
        'bank_slip',
        ${ref},
        'pending',
        ${slipUrl},
        ${fullNotes},
        NOW()
      )
      RETURNING id, created_at
    `;

    // 4. Insert into tenant_subscriptions
    await sql`
      INSERT INTO tenant_subscriptions (tenant_id, plan_name, billing_cycle, amount, slip_url, status)
      VALUES (${tenantId}, ${planName}, ${billingCycle}, ${amount}, ${slipUrl}, 'pending')
    `;

    // 5. Ensure tenant is in pending_payment status
    await sql`
      UPDATE tenants 
      SET payment_status = 'pending_payment', plan = ${planName} 
      WHERE id = ${tenantId}
    `;

    return {
      success: true,
      payment: {
        id: paymentInsert[0].id,
        amount,
        receiptUrl: slipUrl,
        notes: fullNotes,
        createdAt: paymentInsert[0].created_at,
      }
    };
  } catch (err: any) {
    console.error("Error submitting onboarding payment:", err);
    return { success: false, error: err.message || "Failed to submit bank slip." };
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
