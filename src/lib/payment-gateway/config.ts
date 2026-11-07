import type { GatewayStatus, PaymentProvider } from "./types.ts";

/**
 * Checks whether the application is currently running in a live / production environment.
 */
export function isLiveEnvironment(): boolean {
  if (process.env.PAYMENTS_LK_ENV === "test") return false;
  if (process.env.PAYMENTS_LK_ENV === "live") return true;
  if (process.env.VERCEL_ENV === "production") return true;
  if (process.env.NODE_ENV === "production") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  if (
    appUrl &&
    !appUrl.includes("localhost") &&
    !appUrl.includes("127.0.0.1") &&
    process.env.NODE_ENV !== "development"
  ) {
    return true;
  }

  return false;
}

/**
 * Returns true if card payments must be disabled because a test key (sk_test_*) is present in live environment.
 */
export function isCardPaymentsDisabledOnLive(): boolean {
  const paymentsLkSecretKey = process.env.PAYMENTS_LK_SECRET_KEY || "";
  return paymentsLkSecretKey.startsWith("sk_test_") && isLiveEnvironment();
}

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

  const isLive = isLiveEnvironment();
  const isPaymentsLkTestKey = paymentsLkSecretKey.startsWith("sk_test_");
  const cardPaymentsDisabled = isLive && isPaymentsLkTestKey;
  const cardPaymentsDisabledReason = cardPaymentsDisabled
    ? "Card payments are disabled on live because a Payments.lk test key (sk_test_*) is configured."
    : undefined;

  const explicitProvider = (process.env.PAYMENT_GATEWAY_PROVIDER || "").toLowerCase() as PaymentProvider;

  // Payments.lk is available for card payments ONLY if keys exist AND card payments are not disabled on live
  const hasPaymentsLk = Boolean(
    paymentsLkSecretKey && 
    paymentsLkSecretKey.length > 5 && 
    !cardPaymentsDisabled
  );
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
    isLive,
    paymentsLk: {
      isAvailable: hasPaymentsLk,
      secretKey: paymentsLkSecretKey,
      publicKey: paymentsLkPublicKey,
      webhookSecret: paymentsLkWebhookSecret,
      isTestKey: isPaymentsLkTestKey,
      cardPaymentsDisabled,
      cardPaymentsDisabledReason,
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
      sandbox: !config.isLive,
    },
    cardPaymentsDisabled: config.paymentsLk.cardPaymentsDisabled,
    cardPaymentsDisabledReason: config.paymentsLk.cardPaymentsDisabledReason,
    isLive: config.isLive,
    isTestKey: config.paymentsLk.isTestKey,
  };
}
