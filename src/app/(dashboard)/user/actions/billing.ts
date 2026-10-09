"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { auth } from "@/lib/auth";
import { put } from "@vercel/blob";
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
      const u = await sql`SELECT id FROM admin_users WHERE clerk_id = ${userId} LIMIT 1`;
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

    // 1. Upload to Blob
    const filename = `admin/subscriptions/${tenantId}-${Date.now()}-${slipFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const blob = await put(filename, slipFile, { access: 'public' });
    const slipUrl = blob.url;

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
    `;

    // 4. Also insert into tenant_subscriptions for backward compatibility
    await sql`
      INSERT INTO tenant_subscriptions (tenant_id, plan_name, billing_cycle, amount, slip_url, status)
      VALUES (${tenantId}, ${planName}, ${billingCycle}, ${amount}, ${slipUrl}, 'pending')
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error submitting payment:", err);
    return { success: false, error: err.message };
  }
}

