import crypto from "crypto";
import { CreateCheckoutParams, CheckoutResult } from "./types";
import { getGatewayConfig } from "./config";

/**
 * Creates a Stripe Checkout Session using Stripe's standard REST API.
 * Uses native fetch so no external npm packages are needed.
 */
export async function createStripeCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const config = getGatewayConfig();
  const secretKey = config.stripe.secretKey;

  if (!secretKey) {
    return {
      success: false,
      provider: "stripe",
      error: "Stripe secret key is not configured in environment variables.",
    };
  }

  const successUrl =
    params.successUrl ||
    `${config.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}&provider=stripe`;
  const cancelUrl =
    params.cancelUrl ||
    `${config.appUrl}/user/settings?billing_status=cancelled`;

  // Build urlencoded body for Stripe Checkout Session
  const bodyParams = new URLSearchParams();
  bodyParams.append("mode", "payment");
  bodyParams.append("success_url", successUrl);
  bodyParams.append("cancel_url", cancelUrl);
  bodyParams.append("client_reference_id", String(params.tenantId));

  if (params.userEmail) {
    bodyParams.append("customer_email", params.userEmail);
  }

  // Line item details
  // Note: amount in Stripe is in the smallest currency unit (e.g., cents for USD, LKR is zero-decimal or 100-decimal depending on Stripe, usually 100)
  const unitAmount = Math.round(params.amount * 100);
  bodyParams.append("line_items[0][price_data][currency]", (params.currency || "lkr").toLowerCase());
  bodyParams.append("line_items[0][price_data][unit_amount]", String(unitAmount));
  bodyParams.append(
    "line_items[0][price_data][product_data][name]",
    `Framebooks ${params.planName} Plan (${params.billingInterval})`
  );
  bodyParams.append(
    "line_items[0][price_data][product_data][description]",
    `Subscription access for workspace #${params.tenantId}`
  );
  bodyParams.append("line_items[0][quantity]", "1");

  // Metadata
  bodyParams.append("metadata[tenantId]", String(params.tenantId));
  bodyParams.append("metadata[planName]", params.planName);
  bodyParams.append("metadata[billingInterval]", params.billingInterval);
  if (params.userId) {
    bodyParams.append("metadata[userId]", String(params.userId));
  }
  if (params.couponCode) {
    bodyParams.append("metadata[couponCode]", params.couponCode);
  }

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: bodyParams.toString(),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error("[Stripe API Error]", data.error);
      return {
        success: false,
        provider: "stripe",
        error: data.error?.message || "Failed to create Stripe checkout session.",
      };
    }

    return {
      success: true,
      provider: "stripe",
      sessionId: data.id,
      checkoutUrl: data.url,
      requiresRedirect: true,
    };
  } catch (err: any) {
    console.error("[Stripe Fetch Error]", err);
    return {
      success: false,
      provider: "stripe",
      error: err.message || "Failed to connect to Stripe.",
    };
  }
}

/**
 * Retrieves a Stripe Checkout Session by ID.
 */
export async function getStripeCheckoutSession(sessionId: string) {
  const config = getGatewayConfig();
  const secretKey = config.stripe.secretKey;
  if (!secretKey) return null;

  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Verifies a Stripe Webhook signature using Node's standard crypto.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds: number = 300
): { valid: boolean; event?: any; error?: string } {
  try {
    const parts = signatureHeader.split(",");
    let timestamp = "";
    let signature = "";

    for (const part of parts) {
      const [key, val] = part.trim().split("=");
      if (key === "t") timestamp = val;
      if (key === "v1") signature = val;
    }

    if (!timestamp || !signature) {
      return { valid: false, error: "Missing timestamp or v1 signature" };
    }

    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (Math.abs(age) > toleranceSeconds) {
      return { valid: false, error: "Webhook timestamp outside tolerance" };
    }

    const payload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      const parsedEvent = JSON.parse(rawBody);
      return { valid: true, event: parsedEvent };
    }

    return { valid: false, error: "Signature mismatch" };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

