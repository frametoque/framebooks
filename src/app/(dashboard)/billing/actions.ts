"use server";

import sql from "@/lib/db";
import { getTenantId } from "@/app/(dashboard)/user/actions/actions";
import { incrementLifetimeUsage } from "@/lib/plans";
import { revalidatePath } from "next/cache";

export async function recordWalletRechargeAsExpenseAction(params: {
  amount: number;
  accountId: number;
  category?: string;
  description?: string;
}): Promise<{
  success: boolean;
  accountName?: string;
  message?: string;
  error?: string;
}> {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return { success: false, error: "Unauthorized" };
    }

    const {
      amount,
      accountId,
      category = "Subscriptions & Software",
      description = "Workspace Wallet Recharge",
    } = params;

    if (!amount || amount <= 0) {
      return { success: false, error: "Invalid recharge amount." };
    }

    if (!accountId) {
      return { success: false, error: "Please select an account." };
    }

    // Verify account belongs to tenant
    const accRows = await sql`
      SELECT id, name FROM accounts 
      WHERE id = ${accountId} AND tenant_id = ${Number(tenantId)} 
      LIMIT 1
    `;

    if (accRows.length === 0) {
      return { success: false, error: "Selected account was not found." };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    await sql`
      INSERT INTO admin_expenses (
        date,
        amount,
        description,
        category,
        payment_method,
        account_id,
        tenant_id
      ) VALUES (
        ${todayStr},
        ${amount},
        ${description},
        ${category},
        'Card / Online',
        ${accountId},
        ${Number(tenantId)}
      )
    `;

    try {
      await incrementLifetimeUsage(Number(tenantId), "expenses");
    } catch (e) {
      console.warn("Could not increment expense lifetime usage:", e);
    }

    revalidatePath("/user/expenses");
    revalidatePath("/user/dashboard");
    revalidatePath("/user/settings");
    revalidatePath("/user/settings/billing");

    return {
      success: true,
      accountName: accRows[0].name,
      message: `Expense of LKR ${amount.toLocaleString()} was successfully recorded under "${accRows[0].name}".`,
    };
  } catch (err: any) {
    console.error("Error recording wallet recharge expense:", err);
    return {
      success: false,
      error: err.message || "Failed to record expense.",
    };
  }
}

