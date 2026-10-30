"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { auth } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";
import { getActivePlans, DBPlan } from "@/lib/plans-db";

export async function getAvailablePlansAction(): Promise<{ success: boolean; plans: DBPlan[] }> {
  try {
    const plans = await getActivePlans();
    return { success: true, plans };
  } catch (err: any) {
    console.error("Error fetching active plans:", err);
    return { success: false, plans: [] };
  }
}

export async function getSubscriptionHistory() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    // Query payments table for this tenant, falling back to legacy tenant_subscriptions if none
    const paymentRows = await sql`
      SELECT 
        p.id, 
        COALESCE(pl.name, 'Pro') AS plan_name, 
        p.amount, 
        p.receipt_url AS slip_url, 
        p.status, 
        p.notes AS review_note, 
        p.created_at
      FROM payments p
      LEFT JOIN plans pl ON p.plan_id = pl.id
      WHERE p.tenant_id = ${tenantId}
      ORDER BY p.created_at DESC
    `;

    if (paymentRows.length > 0) {
      return { success: true, history: paymentRows };
    }

    const legacyRows = await sql`
      SELECT id, plan_name, amount, slip_url, status, review_note, created_at
      FROM tenant_subscriptions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;

    return { success: true, history: legacyRows };
  } catch (err: any) {
    console.error("Error fetching subscription history:", err);
    return { success: false, error: err.message };
  }
}

export async function submitSubscriptionPayment(formData: FormData) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    const { userId } = await auth();
    let dbUserId: number | null = null;
    if (userId) {
      const u = await sql`SELECT id FROM admin_users WHERE id = ${Number(userId) || 0} LIMIT 1`;
      if (u.length > 0) dbUserId = u[0].id;
    }

    const planName = formData.get("planName") as string;
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

    // Validate slip file type and size (max 10MB, raster images and PDF only)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (slipFile.size > MAX_SIZE) {
      return { success: false, error: "Payment slip must be smaller than 10MB." };
    }

    const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!ALLOWED_MIME.includes(slipFile.type)) {
      return { success: false, error: "Invalid file type. Only JPG, PNG, WebP, and PDF are allowed." };
    }

    // 1. Lookup and verify plan
    let planId: number | null = null;
    let verifiedAmount = amount;
    if (planName) {
      const p = await sql`
        SELECT id, price_monthly, price_yearly, currency, is_active FROM plans 
        WHERE LOWER(name) = LOWER(${planName}) OR key = LOWER(${planName}) 
        LIMIT 1
      `;
      if (p.length > 0) {
        planId = p[0].id;
        const catalogPrice = billingCycle === "yearly" ? p[0].price_yearly : p[0].price_monthly;
        if (catalogPrice && catalogPrice > 0) {
          verifiedAmount = catalogPrice;
        }
      }
    }

    // 2. Upload to Cloudflare R2
    const safeExt = slipFile.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const cleanFileName = `${tenantId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${safeExt}`;
    const result = await uploadToR2({
      file: slipFile,
      fileName: cleanFileName,
      folder: "subscriptions",
      contentType: slipFile.type,
    });
    const slipUrl = result.url;

    const ref = `SLIP-${tenantId}-${Date.now().toString().slice(-6)}`;
    const fullNotes = `Bank slip uploaded for ${planName} (${billingCycle})${customerNotes ? ` | Customer note: ${customerNotes}` : ''}${amount !== verifiedAmount ? ` | Claimed amount: LKR ${amount}` : ''}`;

    // 3. Insert into payments table (for admin review, approval & tracking)
    await sql`
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
        ${verifiedAmount},
        'LKR',
        'bank_transfer',
        'bank_slip',
        ${ref},
        'pending',
        ${slipUrl},
        ${fullNotes},
        NOW()
      )
    `;

    // 4. Also insert into tenant_subscriptions for backward compatibility
    await sql`
      INSERT INTO tenant_subscriptions (tenant_id, plan_name, billing_cycle, amount, slip_url, status)
      VALUES (${tenantId}, ${planName}, ${billingCycle}, ${verifiedAmount}, ${slipUrl}, 'pending')
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error submitting payment:", err);
    return { success: false, error: err.message };
  }
}

