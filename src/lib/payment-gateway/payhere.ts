import crypto from "crypto";
import { CreateCheckoutParams, CheckoutResult } from "./types";
import { getGatewayConfig } from "./config";

function md5(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").toUpperCase();
}

/**
 * Generates PayHere checkout payload & security hash.
 */
export async function createPayHereCheckoutSession(
  params: CreateCheckoutParams
): Promise<CheckoutResult> {
  const config = getGatewayConfig();
  const merchantId = config.payhere.merchantId;
  const merchantSecret = config.payhere.merchantSecret;

  if (!merchantId || !merchantSecret) {
    return {
      success: false,
      provider: "payhere",
      error: "PayHere credentials are not configured in environment variables.",
    };
  }

  const orderId = `FB-${params.tenantId}-${Date.now().toString().slice(-6)}`;
  const amountFormatted = Number(params.amount).toFixed(2);
  const currency = (params.currency || "LKR").toUpperCase();

  // PayHere MD5 hash formula: strtoupper(md5(merchant_id + order_id + amount + currency + strtoupper(md5(merchant_secret))))
  const hashedSecret = md5(merchantSecret);
  const hash = md5(`${merchantId}${orderId}${amountFormatted}${currency}${hashedSecret}`);

  const returnUrl =
    params.successUrl ||
    `${config.appUrl}/billing/success?order_id=${orderId}&provider=payhere`;
  const cancelUrl =
    params.cancelUrl ||
    `${config.appUrl}/user/settings?billing_status=cancelled`;
  const notifyUrl = `${config.appUrl}/api/payments/webhook?provider=payhere`;

  const checkoutUrl = config.payhere.isSandbox
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";

  const formData: Record<string, string> = {
    merchant_id: merchantId,
    return_url: returnUrl,
    cancel_url: cancelUrl,
    notify_url: notifyUrl,
    order_id: orderId,
    items: `Framebooks ${params.planName} (${params.billingInterval})`,
    currency,
    amount: amountFormatted,
    first_name: "Customer",
    last_name: `#${params.tenantId}`,
    email: params.userEmail || "billing@framebooks.com",
    phone: "0770000000",
    address: "Colombo",
    city: "Colombo",
    country: "Sri Lanka",
    hash,
    custom_1: String(params.tenantId),
    custom_2: params.planName,
  };

  return {
    success: true,
    provider: "payhere",
    sessionId: orderId,
    checkoutUrl,
    requiresRedirect: false,
    formData,
  };
}

/**
 * Validates a PayHere IPN notification callback using MD5 signature.
 */
export function verifyPayHereNotification(
  body: Record<string, any>,
  merchantSecret: string
): { valid: boolean; orderId?: string; statusCode?: string; error?: string } {
  try {
    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = body;

    if (!merchant_id || !order_id || !payhere_amount || !payhere_currency || !status_code || !md5sig) {
      return { valid: false, error: "Missing required notification fields" };
    }

    const hashedSecret = md5(merchantSecret);
    const expectedSig = md5(
      `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${hashedSecret}`
    );

    if (expectedSig.toUpperCase() === String(md5sig).toUpperCase()) {
      return { valid: true, orderId: order_id, statusCode: String(status_code) };
    }

    return { valid: false, error: "Signature hash mismatch" };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

