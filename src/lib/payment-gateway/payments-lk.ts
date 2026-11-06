import crypto from "crypto";
import { CreateCheckoutParams, CheckoutResult } from "./types";
import { getGatewayConfig } from "./config";

/**
 * Creates a hosted checkout session using the official Payments.lk REST API.
 * Docs: https://payments.lk/developers
 * Dashboard: https://app.payments.lk/admin/developers
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

  const isWallet = params.planName.toLowerCase().includes("wallet");
  const sanitizedPlan = isWallet ? "WALLET" : params.planName.replace(/\s+/g, "");
  const amountNum = Math.round(Number(params.amount));
  const orderReference = isWallet
    ? `FB_${params.tenantId}_WALLET_${amountNum}_${Date.now().toString().slice(-6)}`
    : `FB_${params.tenantId}_${sanitizedPlan}_${params.billingInterval}_${Date.now().toString().slice(-6)}`;
  const amountCents = amountNum * 100;

  let successUrl = params.successUrl || `${config.appUrl}/billing/success`;
  if (!successUrl.includes("reference=")) {
    successUrl += `${successUrl.includes("?") ? "&" : "?"}reference=${orderReference}&provider=payments_lk&amount=${amountNum}${isWallet ? "&type=wallet_topup" : ""}`;
  }

  const cancelUrl =
    params.cancelUrl ||
    `${config.appUrl}/user/settings/billing?billing_status=cancelled`;

  const resolvedName = params.userName?.trim() || params.userEmail?.split("@")[0] || "Customer";

  const customerObj: Record<string, string> = {
    name: resolvedName,
  };
  if (params.userEmail && params.userEmail.includes("@")) {
    customerObj.email = params.userEmail.trim();
  }

  const orderDescription = isWallet
    ? "Framebooks Wallet Recharge"
    : `Framebooks ${params.planName} Plan (${params.billingInterval})`;

  const payload: Record<string, any> = {
    amountCents,
    currency: (params.currency || "LKR").toUpperCase(),
    description: orderDescription,
    reference: orderReference,
    saveCard: true,
    successUrl,
    cancelUrl,
    customer: customerObj,
  };

  try {
    const res = await fetch("https://api.payments.lk/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Idempotency-Key": orderReference,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

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
      checkoutUrl: data.url,
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

