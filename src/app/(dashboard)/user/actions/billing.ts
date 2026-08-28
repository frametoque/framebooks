"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { put } from "@vercel/blob";

export async function getSubscriptionHistory() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    const rows = await sql`
      SELECT id, plan_name, amount, slip_url, status, review_note, created_at
      FROM tenant_subscriptions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;

    return { success: true, history: rows };
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

    const planName = formData.get("planName") as string;
    const billingCycle = formData.get("billingCycle") as string;
    const amount = formData.get("amount") ? Number(formData.get("amount")) : null;
    const slipFile = formData.get("slip") as File;

    if (!planName || !billingCycle || !slipFile || slipFile.size === 0) {
      return { success: false, error: "Plan name, billing cycle, and payment slip are required." };
    }

    const filename = `admin/subscriptions/${tenantId}-${Date.now()}-${slipFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const blob = await put(filename, slipFile, { access: 'public' });
    const slipUrl = blob.url;

    await sql`
      INSERT INTO tenant_subscriptions (tenant_id, plan_name, billing_cycle, amount, slip_url)
      VALUES (${tenantId}, ${planName}, ${billingCycle}, ${amount}, ${slipUrl})
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Error submitting payment:", err);
    return { success: false, error: err.message };
  }
}
