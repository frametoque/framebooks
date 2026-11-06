import { GatewayStatus, PaymentProvider } from "./types";

export function getGatewayConfig() {
  // Payments.lk credentials (https://app.payments.lk/admin/developers)
  const paymentsLkSecretKey = process.env.PAYMENTS_LK_SECRET_KEY || "";
  const paymentsLkPublicKey = process.env.PAYMENTS_LK_PUBLIC_KEY || "";
  const paymentsLkWebhookSecret = process.env.PAYMENTS_LK_WEBHOOK_SECRET || "";

  // Stripe credentials (optional fallback)
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  // PayHere credentials (optional fallback)
  const payhereMerchantId = process.env.PAYHERE_MERCHANT_ID || "";
  const payhereMerchantSecret = process.env.PAYHERE_MERCHANT_SECRET || "";
  const payhereEnv = (process.env.PAYHERE_ENV || "sandbox").toLowerCase();

  const explicitProvider = (process.env.PAYMENT_GATEWAY_PROVIDER || "").toLowerCase() as PaymentProvider;

  const hasPaymentsLk = Boolean(paymentsLkSecretKey && paymentsLkSecretKey.length > 5);
  const hasStripe = Boolean(stripeSecretKey && stripeSecretKey.length > 5);
  const hasPayhere = Boolean(payhereMerchantId && payhereMerchantSecret);

  let activeProvider: PaymentProvider = "sandbox";

  // Prioritize Payments.lk
  if (explicitProvider === "payments_lk" && hasPaymentsLk) {
    activeProvider = "payments_lk";
  } else if (explicitProvider === "stripe" && hasStripe) {
    activeProvider = "stripe";
  } else if (explicitProvider === "payhere" && hasPayhere) {
    activeProvider = "payhere";
  } else if (hasPaymentsLk) {
    activeProvider = "payments_lk";
  } else if (hasStripe) {
    activeProvider = "stripe";
  } else if (hasPayhere) {
    activeProvider = "payhere";
  }

  const isConfigured = hasPaymentsLk || hasStripe || hasPayhere;

  return {
    isConfigured,
    activeProvider,
    paymentsLk: {
      isAvailable: hasPaymentsLk,
      secretKey: paymentsLkSecretKey,
      publicKey: paymentsLkPublicKey,
      webhookSecret: paymentsLkWebhookSecret,
    },
    stripe: {
      isAvailable: hasStripe,
      secretKey: stripeSecretKey,
      publishableKey: stripePublishableKey,
      webhookSecret: stripeWebhookSecret,
    },
    payhere: {
      isAvailable: hasPayhere,
      merchantId: payhereMerchantId,
      merchantSecret: payhereMerchantSecret,
      isSandbox: payhereEnv !== "live",
    },
    appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://books.frametoque.com",
  };
}

export function getGatewayStatus(): GatewayStatus {
  const config = getGatewayConfig();
  return {
    isConfigured: config.isConfigured,
    activeProvider: config.activeProvider,
    availableProviders: {
      payments_lk: config.paymentsLk.isAvailable,
      stripe: config.stripe.isAvailable,
      payhere: config.payhere.isAvailable,
      sandbox: true,
    },
  };
}
