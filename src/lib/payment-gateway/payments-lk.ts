import crypto from "crypto";
import { CreateCheckoutParams, CheckoutResult } from "./types";
import { getGatewayConfig } from "./config";

/**
 * Creates a recurring subscription session using Payments.lk POST /v1/subscriptions API.
 * Docs: https://payments.lk/developers
 * Dashboard: https://app.payments.lk/admin/subscriptions
 */
export async function createPaymentsLkCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;

  if (!secretKey) {
    return {
      success: false,
      provider: "payments_lk",
      error: "PAYMENTS_LK_SECRET_KEY is not configured in .env.local",
    };
  }

  if (config.paymentsLk.cardPaymentsDisabled || (secretKey.startsWith("sk_test_") && config.isLive)) {
    return {
      success: false,
      provider: "payments_lk",
      error: "Card payments are disabled in the live environment because a Payments.lk test key (sk_test_*) is configured.",
    };
  }

  const sanitizedPlan = params.planName.replace(/\s+/g, "");
  const amountNum = Math.round(Number(params.amount));
  const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const orderReference = `FB_${params.tenantId}_${sanitizedPlan}_${params.billingInterval}_${uniqueSuffix}`;
  const amountCents = amountNum * 100;

  let successUrl = params.successUrl || `${config.appUrl}/billing/success`;
  if (!successUrl.includes("reference=")) {
    successUrl += `${successUrl.includes("?") ? "&" : "?"}reference=${orderReference}&provider=payments_lk&amount=${amountNum}`;
  }

  const cancelUrl =
    params.cancelUrl ||
    `${config.appUrl}/settings?tab=billing&status=cancelled`;

  const resolvedName = params.userName?.trim() || params.userEmail?.split("@")[0] || "Customer";
  const userEmail = params.userEmail?.trim().toLowerCase() || "";
  const userPhone = params.userPhone?.trim() || "";

  const customerObj: Record<string, string> = {
    name: resolvedName,
  };
  if (userEmail && userEmail.includes("@")) {
    customerObj.email = userEmail;
  }

  const orderDescription = `Framebooks ${params.planName} Plan (${params.billingInterval})`;

  const payload: Record<string, any> = {
    amountCents,
    description: orderDescription,
    reference: orderReference,
    saveCard: true,
    successUrl,
    cancelUrl,
    customer: customerObj,
  };

  try {
    let res = await fetch("https://api.payments.lk/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Idempotency-Key": `chk_${orderReference}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    let data = await res.json().catch(() => ({}));

    // If saveCard is not enabled or causes validation failure, retry without saveCard
    if (!res.ok && payload.saveCard) {
      console.warn("[Payments.lk] Retrying checkout request without saveCard");
      const retryPayload = { ...payload };
      delete retryPayload.saveCard;
      const retryRes = await fetch("https://api.payments.lk/v1/checkouts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Idempotency-Key": `chk_${orderReference}_nosave`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(retryPayload),
      });
      const retryData = await retryRes.json().catch(() => ({}));
      if (retryRes.ok && (retryData.url || retryData.checkoutUrl)) {
        res = retryRes;
        data = retryData;
      }
    }

    if (!res.ok || data.error) {
      console.error("[Payments.lk API Error]", data);
      const fieldErrors = Array.isArray(data.fields) && data.fields.length > 0
        ? data.fields.map((f: any) => f.message || f.path).filter(Boolean).join("; ")
        : "";
      const errorMsg = fieldErrors
        ? `${data.message || "Validation failed"}: ${fieldErrors}`
        : data.error?.message || data.message || "Failed to create Payments.lk checkout session.";

      return {
        success: false,
        provider: "payments_lk",
        error: errorMsg,
      };
    }

    return {
      success: true,
      provider: "payments_lk",
      sessionId: data.id || orderReference,
      checkoutUrl: data.url || data.checkoutUrl,
      requiresRedirect: true,
    };
  } catch (err: any) {
    console.error("[Payments.lk Fetch Error]", err);
    return {
      success: false,
      provider: "payments_lk",
      error: err.message || "Could not connect to Payments.lk API.",
    };
  }
}

/**
 * Creates a recurring subscription session using Payments.lk.
 */
export async function createPaymentsLkSubscription(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  return await createPaymentsLkCheckoutSession(params);
}

/**
 * Cancels a recurring subscription on Payments.lk.
 * Endpoint: DELETE /v1/subscriptions/:id
 */
export async function cancelPaymentsLkSubscription(
  subscriptionId: string
): Promise<{ success: boolean; error?: string }> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;
  if (!secretKey || !subscriptionId) {
    return { success: false, error: "Missing subscription ID or API key" };
  }

  try {
    const res = await fetch(`https://api.payments.lk/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data.error?.message || data.message || "Failed to cancel subscription on Payments.lk",
      };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Retrieves a subscription's current state from Payments.lk.
 * Endpoint: GET /v1/subscriptions/:id
 */
export async function getPaymentsLkSubscription(
  subscriptionId: string
): Promise<{ success: boolean; subscription?: any; error?: string }> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;
  if (!secretKey || !subscriptionId) {
    return { success: false, error: "Missing subscription ID or API key" };
  }

  try {
    const res = await fetch(`https://api.payments.lk/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        success: false,
        error: data.error?.message || data.message || "Failed to retrieve subscription.",
      };
    }

    const data = await res.json();
    return { success: true, subscription: data };
  } catch (err: any) {
    return { success: false, error: err.message || "Network error" };
  }
}

/**
 * Charges a saved card on file for recurring subscription renewal.
 * Endpoint: POST /v1/cards/:id/charge
 */
export async function chargePaymentsLkSavedCard({
  cardId,
  amountCents,
  description,
  reference,
}: {
  cardId: string;
  amountCents: number;
  description: string;
  reference: string;
}): Promise<{
  success: boolean;
  paymentId?: string;
  reference?: string;
  error?: string;
}> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;

  if (!secretKey) {
    return { success: false, error: "PAYMENTS_LK_SECRET_KEY not configured" };
  }

  if (config.paymentsLk.cardPaymentsDisabled || (secretKey.startsWith("sk_test_") && config.isLive)) {
    return {
      success: false,
      error: "Card payments are disabled in the live environment because a Payments.lk test key (sk_test_*) is configured.",
    };
  }

  try {
    const res = await fetch(`https://api.payments.lk/v1/cards/${encodeURIComponent(cardId)}/charge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Idempotency-Key": reference,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountCents,
        description,
        reference,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data.error) {
      console.error("[Payments.lk Charge Card Error]", data);
      return {
        success: false,
        error: data.error?.message || data.message || "Failed to charge saved card.",
      };
    }

    return {
      success: true,
      paymentId: data.id || data.payment?.id,
      reference: data.reference || reference,
    };
  } catch (err: any) {
    console.error("[Payments.lk Charge Exception]", err);
    return { success: false, error: err.message || "Card charge failed." };
  }
}

/**
 * Deletes a saved card on Payments.lk.
 * Endpoint: DELETE /v1/cards/:id
 */
export async function deletePaymentsLkSavedCard(cardId: string): Promise<boolean> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;
  if (!secretKey) return false;

  try {
    const res = await fetch(`https://api.payments.lk/v1/cards/${encodeURIComponent(cardId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PaymentsLkCard {
  id: string;
  scheme: string;
  last4: string;
  expiry?: {
    month: number;
    year: number;
  };
  customerEmail?: string;
  active?: boolean;
  createdAt?: string;
}

/**
 * Lists saved cards for a customer email from Payments.lk.
 * Endpoint: GET /v1/cards?customerEmail=...
 */
export async function listPaymentsLkSavedCards(customerEmail: string): Promise<PaymentsLkCard[]> {
  const config = getGatewayConfig();
  const secretKey = config.paymentsLk.secretKey;
  if (!secretKey || !customerEmail) return [];
  if (config.paymentsLk.cardPaymentsDisabled || (secretKey.startsWith("sk_test_") && config.isLive)) return [];

  try {
    const res = await fetch(`https://api.payments.lk/v1/cards?customerEmail=${encodeURIComponent(customerEmail.trim())}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) return [];
    const json = await res.json().catch(() => ({}));
    if (Array.isArray(json.data)) {
      return json.data.filter((c: any) => c.active !== false);
    }
    return [];
  } catch (err) {
    console.error("[Payments.lk List Cards Error]", err);
    return [];
  }
}

/**
 * Synchronizes the newest saved card from Payments.lk for a customer email to the database.
 */
export async function syncCustomerSavedCard(tenantId: number, customerEmail: string): Promise<{
  success: boolean;
  card?: PaymentsLkCard | null;
  error?: string;
}> {
  if (!tenantId || !customerEmail) return { success: false, error: "Missing tenant or email" };

  try {
    const cards = await listPaymentsLkSavedCards(customerEmail);
    if (!cards || cards.length === 0) {
      return { success: true, card: null };
    }

    // Newest card first
    const newestCard = cards[0];
    const sql = (await import("@/lib/db")).default;

    const existing = await sql`
      SELECT id FROM subscriptions WHERE tenant_id = ${tenantId} ORDER BY id DESC LIMIT 1
    `;

    if (existing.length > 0) {
      await sql`
        UPDATE subscriptions SET
          saved_card_id = ${newestCard.id},
          card_brand = ${newestCard.scheme || "card"},
          card_last4 = ${newestCard.last4 || ""},
          card_exp_month = ${newestCard.expiry?.month || null},
          card_exp_year = ${newestCard.expiry?.year || null},
          auto_renew = true,
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;
    } else {
      await sql`
        INSERT INTO subscriptions (
          tenant_id,
          plan_id,
          status,
          billing_interval,
          current_period_start,
          source,
          saved_card_id,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          auto_renew,
          created_at,
          updated_at
        ) VALUES (
          ${tenantId},
          1,
          'active',
          'monthly',
          NOW(),
          'payments_lk',
          ${newestCard.id},
          ${newestCard.scheme || "card"},
          ${newestCard.last4 || ""},
          ${newestCard.expiry?.month || null},
          ${newestCard.expiry?.year || null},
          true,
          NOW(),
          NOW()
        )
      `;
    }

    return { success: true, card: newestCard };
  } catch (err: any) {
    console.error("[Payments.lk Sync Card Error]", err);
    return { success: false, error: err.message };
  }
}

/**
 * Verifies a Payments.lk webhook HMAC-SHA256 signature.
 * Header format: Payments-Signature: t=1726400000,v1=abcdef...
 * Signed Payload: {t}.{raw_request_body}
 */
export function verifyPaymentsLkWebhook(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds: number = 300
): { valid: boolean; event?: any; error?: string } {
  try {
    let timestamp: number | undefined;
    const signatures: string[] = [];

    // Parse header parts
    for (const part of String(signatureHeader || "").split(",")) {
      const [key, value] = part.trim().split("=", 2);
      if (key === "t" && /^[0-9]{1,12}$/.test(value || "")) {
        timestamp = Number(value);
      }
      if (key === "v1" && /^[0-9a-f]{64}$/i.test(value || "")) {
        signatures.push(value.toLowerCase());
      }
    }

    if (timestamp === undefined || signatures.length === 0) {
      return { valid: false, error: "Missing timestamp or v1 signature in Payments-Signature header" };
    }

    // Check drift tolerance
    const age = Math.abs(Date.now() / 1000 - timestamp);
    if (age > toleranceSeconds) {
      return { valid: false, error: "Payments.lk webhook timestamp outside tolerance" };
    }

    // Recompute expected HMAC-SHA256 signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedBuffer = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest();

    // Constant-time compare
    const isValid = signatures.some((sig) => {
      try {
        const providedBuffer = Buffer.from(sig, "hex");
        return (
          expectedBuffer.length === providedBuffer.length &&
          crypto.timingSafeEqual(expectedBuffer, providedBuffer)
        );
      } catch {
        return false;
      }
    });

    if (isValid) {
      const event = JSON.parse(rawBody);
      return { valid: true, event };
    }

    return { valid: false, error: "Signature hash mismatch" };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

