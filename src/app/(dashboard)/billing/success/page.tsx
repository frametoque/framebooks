import React from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Wallet } from "lucide-react";
import { auth } from "@/lib/auth";
import sql from "@/lib/db";
import { activateSubscriptionFromGateway, completeSandboxCheckout } from "@/lib/payment-gateway";
import { getAccounts } from "@/app/(dashboard)/user/actions/accounts";
import { WalletExpensePrompt } from "./WalletExpensePrompt";

export const dynamic = "force-dynamic";

export default async function BillingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    sandbox_session?: string;
    reference?: string;
    tenant_id?: string;
    plan?: string;
    cycle?: string;
    amount?: string;
    provider?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const { session, userId } = await auth();

  let activatedPlan = params.plan || "Pro";
  let isActivated = false;
  let isWalletTopup =
    params.type === "wallet_topup" ||
    (Boolean(params.reference) && (params.reference!.includes("WALLET") || params.reference!.includes("WalletRecharge"))) ||
    (Boolean(params.plan) && params.plan!.toLowerCase().includes("wallet"));

  let rechargeAmount = Number(params.amount) || 0;
  let resolvedTenantId: number | null = params.tenant_id ? Number(params.tenant_id) : null;

  // 1. Payments.lk immediate return handler
  if (params.reference && params.provider === "payments_lk") {
    const delimiter = params.reference.includes("_") ? "_" : "-";
    const parts = params.reference.split(delimiter);
    const tenantId = Number(parts[1]);
    if (tenantId) resolvedTenantId = tenantId;

    const planName = parts[2] || "Pro";
    const billingInterval = (parts[3] === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";

    if (parts[2] === "WALLET" || parts[2] === "WalletRecharge" || params.type === "wallet_topup") {
      isWalletTopup = true;
      if (!rechargeAmount) {
        if (!isNaN(Number(parts[3]))) {
          rechargeAmount = Number(parts[3]);
        } else if (parts.length > 4 && !isNaN(Number(parts[4]))) {
          rechargeAmount = Number(parts[4]);
        } else if (Number(params.amount) > 0) {
          rechargeAmount = Number(params.amount);
        }
      }

      if (tenantId && rechargeAmount > 0) {
        const { creditWallet } = await import("@/lib/payment-gateway/wallet");
        await creditWallet({
          tenantId,
          amount: rechargeAmount,
          type: "topup",
          description: `Workspace wallet recharge (LKR ${rechargeAmount.toLocaleString()})`,
          provider: "payments_lk",
          providerReference: params.reference,
        });

        // Record in payments table for admin payments audit and reporting
        try {
          const existingPay = await sql`
            SELECT id FROM payments 
            WHERE provider_reference = ${params.reference}
            LIMIT 1
          `;
          if (existingPay.length === 0) {
            await sql`
              INSERT INTO payments (
                tenant_id,
                user_id,
                amount,
                currency,
                method,
                provider,
                provider_reference,
                status,
                notes,
                paid_at,
                created_at
              ) VALUES (
                ${tenantId},
                ${userId ? Number(userId) : null},
                ${rechargeAmount},
                'LKR',
                'card',
                'payments_lk',
                ${params.reference},
                'paid',
                ${`Workspace wallet recharge (LKR ${rechargeAmount.toLocaleString()})`},
                NOW(),
                NOW()
              )
            `;
          }
        } catch (payErr) {
          console.error("[BillingSuccessPage] Error inserting payment record:", payErr);
        }

        isActivated = true;
      }
    } else if (tenantId) {
      await activateSubscriptionFromGateway({
        tenantId,
        userId: userId ? Number(userId) : null,
        planName,
        billingInterval,
        amount: billingInterval === "yearly" ? 25000 : 2500,
        currency: "LKR",
        provider: "payments_lk",
        providerReference: params.reference,
        notes: `Payments.lk return confirmation: ${params.reference}`,
      });
      isActivated = true;
      activatedPlan = planName;
    }

    // Immediately sync any saved card from Payments.lk upon successful return
    if (resolvedTenantId) {
      try {
        const ownerEmail = session?.user?.email || (await sql`SELECT owner_email FROM tenants WHERE id = ${resolvedTenantId} LIMIT 1`)[0]?.owner_email;
        if (ownerEmail) {
          const { syncCustomerSavedCard } = await import("@/lib/payment-gateway/payments-lk");
          await syncCustomerSavedCard(resolvedTenantId, ownerEmail);
        }
      } catch (err) {
        console.error("[BillingSuccessPage] Error syncing card from Payments.lk:", err);
      }
    }
  }
  // 2. Handle sandbox completion fallback
  else if (params.sandbox_session && params.tenant_id) {
    const tenantId = Number(params.tenant_id);
    resolvedTenantId = tenantId;
    const billingInterval = (params.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly";
    const amount = Number(params.amount) || 2500;

    if (isWalletTopup) {
      rechargeAmount = amount;
      const { creditWallet } = await import("@/lib/payment-gateway/wallet");
      await creditWallet({
        tenantId,
        amount,
        type: "topup",
        description: `Workspace wallet recharge (LKR ${amount.toLocaleString()})`,
        provider: "sandbox",
        providerReference: params.sandbox_session,
      });
      isActivated = true;
    } else {
      const res = await completeSandboxCheckout({
        tenantId,
        userId: userId ? Number(userId) : null,
        planName: activatedPlan,
        billingInterval,
        amount,
        sessionId: params.sandbox_session,
      });
      isActivated = res.success;
    }
  } else if (params.session_id) {
    isActivated = true;
  }

  // Resolve current tenant info & wallet balance
  let tenantName = "Workspace";
  let currentWalletBalance = 0;

  try {
    const email = session?.user?.email?.toLowerCase();
    if (resolvedTenantId) {
      const rows = await sql`
        SELECT name, plan, wallet_balance FROM tenants WHERE id = ${resolvedTenantId} LIMIT 1
      `;
      if (rows.length > 0) {
        tenantName = rows[0].name;
        if (rows[0].plan) activatedPlan = rows[0].plan;
        currentWalletBalance = Number(rows[0].wallet_balance || 0);
      }
    } else if (email) {
      const rows = await sql`
        SELECT id, name, plan, wallet_balance FROM tenants WHERE LOWER(owner_email) = ${email} ORDER BY id DESC LIMIT 1
      `;
      if (rows.length > 0) {
        resolvedTenantId = rows[0].id;
        tenantName = rows[0].name;
        if (rows[0].plan) activatedPlan = rows[0].plan;
        currentWalletBalance = Number(rows[0].wallet_balance || 0);
      }
    }
  } catch {}

  // Fetch business accounts so user can record expense
  const accounts = await getAccounts().catch(() => []);

  // Fetch real transaction amount from recent wallet transaction if rechargeAmount is not set
  if (isWalletTopup && rechargeAmount <= 0 && resolvedTenantId) {
    try {
      const lastTx = await sql`
        SELECT amount FROM workspace_wallet_transactions
        WHERE tenant_id = ${resolvedTenantId} AND type = 'topup'
        ORDER BY id DESC LIMIT 1
      `;
      if (lastTx.length > 0) {
        rechargeAmount = Math.abs(Number(lastTx[0].amount));
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card border border-border rounded-3xl p-7 sm:p-9 shadow-2xl text-center space-y-6">
        
        {/* ICON */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto shadow-xs">
          {isWalletTopup ? (
            <Wallet className="w-8 h-8" />
          ) : (
            <CheckCircle2 className="w-8 h-8" />
          )}
        </div>

        {/* HEADER TEXT */}
        {isWalletTopup ? (
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Wallet Recharged Successfully!
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Your payment was received. <strong className="text-foreground">LKR {rechargeAmount.toLocaleString()}</strong> has been credited directly to your workspace prepaid wallet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Subscription Activated!
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
              Your payment was processed successfully. <strong>{tenantName}</strong> is now upgraded to the{" "}
              <span className="font-bold text-foreground">{activatedPlan}</span> plan.
            </p>
          </div>
        )}

        {/* SUMMARY DETAILS CARD */}
        <div className="p-4 rounded-2xl bg-muted/30 border border-border text-left text-xs space-y-2.5">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Workspace:</span>
            <span className="font-semibold text-foreground">{tenantName}</span>
          </div>

          {isWalletTopup ? (
            <>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Amount Recharged:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  + LKR {rechargeAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Updated Wallet Balance:</span>
                <span className="font-bold text-foreground">
                  LKR {currentWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Active Plan:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{activatedPlan}</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Access Status:</span>
                <span className="font-semibold text-foreground">
                  Full Access
                </span>
              </div>
            </>
          )}
        </div>

        {/* WALLET EXPENSE PROMPT (Only for wallet recharges) */}
        {isWalletTopup && (
          <WalletExpensePrompt
            amount={rechargeAmount}
            accounts={accounts}
            returnUrl="/user/settings/billing"
          />
        )}

        {/* NAVIGATION ACTIONS */}
        <div className="space-y-2 pt-1">
          <Link
            href="/user/settings/billing"
            className="w-full py-3.5 bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold rounded-2xl transition-all flex items-center justify-center shadow-sm cursor-pointer text-xs sm:text-sm"
          >
            <span>Return to Billing Settings</span>
          </Link>

          {!isWalletTopup && (
            <Link
              href="/user/dashboard"
              className="w-full py-2.5 text-muted-foreground hover:text-foreground font-semibold rounded-2xl transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer"
            >
              <span>Open Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
