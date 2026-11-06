import sql from "@/lib/db";
import { chargePaymentsLkSavedCard } from "./payments-lk";
import { activateSubscriptionFromGateway } from "./activation";

export interface WalletTransaction {
  id: number;
  tenant_id: number;
  amount: number;
  type: "topup" | "subscription_fee" | "auto_card_pull" | "refund";
  description: string;
  provider: string;
  provider_reference: string;
  balance_after: number;
  created_at: string;
}

export interface TenantWalletData {
  walletBalance: number;
  autoPullCard: boolean;
  savedCard: {
    cardId: string | null;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  } | null;
  transactions: WalletTransaction[];
}

/**
 * Retrieves the workspace wallet balance, auto-pull preference, saved card, and recent transactions.
 */
export async function getTenantWallet(tenantId: number): Promise<TenantWalletData> {
  const [tenantRows, subRows, transactions] = await Promise.all([
    sql`SELECT wallet_balance, auto_pull_card, owner_email FROM tenants WHERE id = ${tenantId} LIMIT 1`,
    sql`
      SELECT saved_card_id, card_brand, card_last4, card_exp_month, card_exp_year 
      FROM subscriptions 
      WHERE tenant_id = ${tenantId} AND saved_card_id IS NOT NULL 
      ORDER BY id DESC 
      LIMIT 1
    `,
    sql`
      SELECT * FROM workspace_wallet_transactions 
      WHERE tenant_id = ${tenantId} 
      ORDER BY created_at DESC 
      LIMIT 15
    `,
  ]);

  const tenant = tenantRows[0] || { wallet_balance: 0, auto_pull_card: true, owner_email: null };
  let sub = subRows[0] || null;

  // Auto-sync saved card from Payments.lk if missing in local DB
  if (!sub?.saved_card_id && tenant.owner_email) {
    try {
      const { syncCustomerSavedCard } = await import("./payments-lk");
      const syncResult = await syncCustomerSavedCard(tenantId, tenant.owner_email);
      if (syncResult.card) {
        sub = {
          saved_card_id: syncResult.card.id,
          card_brand: syncResult.card.scheme || "card",
          card_last4: syncResult.card.last4,
          card_exp_month: syncResult.card.expiry?.month || null,
          card_exp_year: syncResult.card.expiry?.year || null,
        };
      }
    } catch (e) {
      console.error("[getTenantWallet] Error auto-syncing saved card:", e);
    }
  }

  return {
    walletBalance: Number(tenant.wallet_balance || 0),
    autoPullCard: tenant.auto_pull_card ?? true,
    savedCard: sub?.saved_card_id
      ? {
          cardId: sub.saved_card_id,
          brand: sub.card_brand,
          last4: sub.card_last4,
          expMonth: sub.card_exp_month,
          expYear: sub.card_exp_year,
        }
      : null,
    transactions: transactions.map((t: any) => ({
      ...t,
      amount: Number(t.amount),
      balance_after: Number(t.balance_after),
    })),
  };
}

/**
 * Credits funds into a workspace wallet (from manual recharge or online gateway topup).
 */
export async function creditWallet({
  tenantId,
  amount,
  type = "topup",
  description,
  provider = "payments_lk",
  providerReference,
}: {
  tenantId: number;
  amount: number;
  type?: "topup" | "refund" | "auto_card_pull";
  description: string;
  provider?: string;
  providerReference?: string;
}): Promise<{ success: boolean; newBalance: number; error?: string }> {
  if (amount <= 0) return { success: false, newBalance: 0, error: "Invalid credit amount." };

  try {
    return await sql.begin(async (sqlTx) => {
      const tenantRows = await sqlTx`
        SELECT wallet_balance FROM tenants WHERE id = ${tenantId} FOR UPDATE
      `;
      if (tenantRows.length === 0) throw new Error("Tenant not found");

      const currentBalance = Number(tenantRows[0].wallet_balance || 0);

      // Check if this provider reference was already credited to prevent duplicate credits on refresh
      if (providerReference) {
        const existingTx = await sqlTx`
          SELECT id, balance_after FROM workspace_wallet_transactions 
          WHERE tenant_id = ${tenantId} AND provider_reference = ${providerReference}
          LIMIT 1
        `;
        if (existingTx.length > 0) {
          return { success: true, newBalance: Number(existingTx[0].balance_after) };
        }
      }

      const newBalance = Math.round((currentBalance + amount) * 100) / 100;

      await sqlTx`
        UPDATE tenants SET wallet_balance = ${newBalance} WHERE id = ${tenantId}
      `;

      await sqlTx`
        INSERT INTO workspace_wallet_transactions (
          tenant_id,
          amount,
          type,
          description,
          provider,
          provider_reference,
          balance_after
        ) VALUES (
          ${tenantId},
          ${amount},
          ${type},
          ${description},
          ${provider},
          ${providerReference || `TOPUP-${Date.now()}`},
          ${newBalance}
        )
      `;

      return { success: true, newBalance };
    });
  } catch (err: any) {
    console.error("[Credit Wallet Error]", err);
    return { success: false, newBalance: 0, error: err.message };
  }
}

/**
 * Charges or renews a subscription by checking the workspace wallet first.
 * If wallet balance is insufficient, automatically pulls the remaining balance from the saved card.
 */
export async function chargeOrDeductWithAutoPull({
  tenantId,
  userId,
  amount,
  planName,
  billingInterval,
  description,
  reference,
}: {
  tenantId: number;
  userId?: number | null;
  amount: number;
  planName: string;
  billingInterval: "monthly" | "yearly";
  description?: string;
  reference?: string;
}): Promise<{
  success: boolean;
  paidVia: "wallet" | "card" | "wallet_and_card";
  amountDeductedFromWallet: number;
  amountPulledFromCard: number;
  paymentId?: number;
  error?: string;
}> {
  const baseRef = reference || `FB_RENEW_${tenantId}_${Date.now().toString().slice(-6)}`;
  const auditDesc = description || `Framebooks ${planName} Plan Renewal (${billingInterval})`;

  try {
    // 1. Fetch current wallet balance and saved card
    const [tenantRows, subRows] = await Promise.all([
      sql`SELECT wallet_balance, auto_pull_card FROM tenants WHERE id = ${tenantId}`,
      sql`
        SELECT id, saved_card_id, card_brand, card_last4 
        FROM subscriptions 
        WHERE tenant_id = ${tenantId} AND saved_card_id IS NOT NULL 
        ORDER BY id DESC 
        LIMIT 1
      `,
    ]);

    if (tenantRows.length === 0) {
      return {
        success: false,
        paidVia: "wallet",
        amountDeductedFromWallet: 0,
        amountPulledFromCard: 0,
        error: "Tenant not found",
      };
    }

    const currentWallet = Number(tenantRows[0].wallet_balance || 0);
    const autoPullAllowed = tenantRows[0].auto_pull_card ?? true;
    const savedCardId = subRows[0]?.saved_card_id;

    // CASE A: Wallet has full balance
    if (currentWallet >= amount) {
      return await sql.begin(async (sqlTx) => {
        const newBalance = Math.round((currentWallet - amount) * 100) / 100;
        await sqlTx`UPDATE tenants SET wallet_balance = ${newBalance} WHERE id = ${tenantId}`;

        await sqlTx`
          INSERT INTO workspace_wallet_transactions (
            tenant_id,
            amount,
            type,
            description,
            provider,
            provider_reference,
            balance_after
          ) VALUES (
            ${tenantId},
            ${-amount},
            'subscription_fee',
            ${auditDesc},
            'wallet',
            ${baseRef},
            ${newBalance}
          )
        `;

        const act = await activateSubscriptionFromGateway({
          tenantId,
          userId,
          planName,
          billingInterval,
          amount,
          currency: "LKR",
          provider: "workspace_wallet",
          providerReference: baseRef,
          notes: `Paid in full from workspace wallet (${billingInterval})`,
        });

        return {
          success: true,
          paidVia: "wallet",
          amountDeductedFromWallet: amount,
          amountPulledFromCard: 0,
          paymentId: act.paymentId,
        };
      });
    }

    // CASE B: Wallet has insufficient funds -> Check auto-pull from saved card
    if (!savedCardId) {
      return {
        success: false,
        paidVia: "wallet",
        amountDeductedFromWallet: 0,
        amountPulledFromCard: 0,
        error: `Insufficient wallet balance (LKR ${currentWallet.toLocaleString()}). No saved card available to auto-pull the remaining LKR ${(amount - currentWallet).toLocaleString()}.`,
      };
    }

    if (!autoPullAllowed) {
      return {
        success: false,
        paidVia: "wallet",
        amountDeductedFromWallet: 0,
        amountPulledFromCard: 0,
        error: "Auto-pull from saved card is disabled for this workspace.",
      };
    }

    // Calculate shortfall
    const shortfall = Math.round((amount - currentWallet) * 100) / 100;
    const shortfallCents = Math.round(shortfall * 100);
    const cardChargeRef = `AUTOPULL_${tenantId}_${Date.now().toString().slice(-6)}`;

    // Pull remaining balance from saved card via Payments.lk
    const chargeRes = await chargePaymentsLkSavedCard({
      cardId: savedCardId,
      amountCents: shortfallCents,
      description: `Auto-pull for ${planName} subscription (Balance: LKR ${currentWallet})`,
      reference: cardChargeRef,
    });

    if (!chargeRes.success) {
      return {
        success: false,
        paidVia: "wallet_and_card",
        amountDeductedFromWallet: 0,
        amountPulledFromCard: 0,
        error: `Insufficient wallet balance and auto-pull from card failed: ${chargeRes.error || "Card declined"}`,
      };
    }

    // Card pull succeeded -> Deduct remaining wallet and record transactions
    return await sql.begin(async (sqlTx) => {
      // 1. Record card pull into wallet transactions
      const tempBalanceWithPull = Math.round((currentWallet + shortfall) * 100) / 100;
      await sqlTx`
        INSERT INTO workspace_wallet_transactions (
          tenant_id,
          amount,
          type,
          description,
          provider,
          provider_reference,
          balance_after
        ) VALUES (
          ${tenantId},
          ${shortfall},
          'auto_card_pull',
          ${`Auto-pulled from saved card (${subRows[0].card_brand || "card"} •••• ${subRows[0].card_last4 || ""})`},
          'payments_lk',
          ${chargeRes.paymentId || cardChargeRef},
          ${tempBalanceWithPull}
        )
      `;

      // 2. Deduct full subscription fee from wallet
      const finalBalance = 0; // Since currentWallet + shortfall == amount
      await sqlTx`UPDATE tenants SET wallet_balance = ${finalBalance} WHERE id = ${tenantId}`;

      await sqlTx`
        INSERT INTO workspace_wallet_transactions (
          tenant_id,
          amount,
          type,
          description,
          provider,
          provider_reference,
          balance_after
        ) VALUES (
          ${tenantId},
          ${-amount},
          'subscription_fee',
          ${auditDesc},
          'wallet_and_card',
          ${baseRef},
          ${finalBalance}
        )
      `;

      // 3. Activate subscription
      const act = await activateSubscriptionFromGateway({
        tenantId,
        userId,
        planName,
        billingInterval,
        amount,
        currency: "LKR",
        provider: "payments_lk",
        providerReference: chargeRes.paymentId || cardChargeRef,
        receiptUrl: `https://payments.lk/receipt/${chargeRes.paymentId || cardChargeRef}`,
        notes: `Subscription paid (LKR ${currentWallet} wallet + LKR ${shortfall} auto-pulled from card)`,
        savedCardId,
        autoRenew: true,
      });

      return {
        success: true,
        paidVia: currentWallet > 0 ? "wallet_and_card" : "card",
        amountDeductedFromWallet: currentWallet,
        amountPulledFromCard: shortfall,
        paymentId: act.paymentId,
      };
    });
  } catch (err: any) {
    console.error("[chargeOrDeductWithAutoPull Error]", err);
    return {
      success: false,
      paidVia: "wallet",
      amountDeductedFromWallet: 0,
      amountPulledFromCard: 0,
      error: err.message || "Failed to process payment deduction.",
    };
  }
}

