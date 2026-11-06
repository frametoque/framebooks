import { CreateCheckoutParams, CheckoutResult } from "./types";
import { getGatewayConfig } from "./config";
import { createPaymentsLkCheckoutSession } from "./payments-lk";
import { createStripeCheckoutSession } from "./stripe";
import { createPayHereCheckoutSession } from "./payhere";
import { activateSubscriptionFromGateway } from "./activation";

export * from "./types";
export * from "./config";
export * from "./activation";
export * from "./payments-lk";
export * from "./recurring";
export * from "./wallet";
export * from "./fee";

/**
 * Unified checkout session creator.
 * Prioritizes Payments.lk (https://payments.lk/developers)
 * and falls back gracefully to sandbox mode if keys have not yet been placed in .env.local.
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const config = getGatewayConfig();

  // 1. Payments.lk Hosted Checkout (Primary)
  if (config.activeProvider === "payments_lk" && config.paymentsLk.isAvailable) {
    return await createPaymentsLkCheckoutSession(params);
  }

  // 2. Stripe Checkout (Alternative)
  if (config.activeProvider === "stripe" && config.stripe.isAvailable) {
    return await createStripeCheckoutSession(params);
  }

  // 3. PayHere Checkout (Alternative)
  if (config.activeProvider === "payhere" && config.payhere.isAvailable) {
    return await createPayHereCheckoutSession(params);
  }

  // 4. Sandbox Mode (Ready for keys in .env.local)
  const sandboxSessionId = `SANDBOX-${params.tenantId}-${Date.now().toString().slice(-6)}`;
  const returnUrl = `${config.appUrl}/billing/success?sandbox_session=${sandboxSessionId}&tenant_id=${params.tenantId}&plan=${encodeURIComponent(params.planName)}&cycle=${params.billingInterval}&amount=${params.amount}`;

  return {
    success: true,
    provider: "sandbox",
    sessionId: sandboxSessionId,
    checkoutUrl: returnUrl,
    requiresRedirect: true,
    isSandbox: true,
    message: "Payments.lk keys are not configured yet in .env.local. Running in sandbox mode.",
  };
}

/**
 * Completes sandbox checkout payment and activates workspace immediately.
 */
export async function completeSandboxCheckout(params: {
  tenantId: number;
  userId?: number | null;
  planName: string;
  billingInterval: "monthly" | "yearly";
  amount: number;
  sessionId: string;
}) {
  return await activateSubscriptionFromGateway({
    tenantId: params.tenantId,
    userId: params.userId,
    planName: params.planName,
    billingInterval: params.billingInterval,
    amount: params.amount,
    currency: "LKR",
    provider: "sandbox_gateway",
    providerReference: params.sessionId,
    notes: `Sandbox Payment Gateway Activation (${params.billingInterval})`,
  });
}
