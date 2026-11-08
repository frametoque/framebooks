import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getGatewayConfig } from "@/lib/payment-gateway/config";
import { verifyPaymentsLkWebhook } from "@/lib/payment-gateway/payments-lk";
import { verifyStripeSignature } from "@/lib/payment-gateway/stripe";
import { verifyPayHereNotification } from "@/lib/payment-gateway/payhere";
import { activateSubscriptionFromGateway } from "@/lib/payment-gateway/activation";

export async function POST(req: NextRequest) {
  const config = getGatewayConfig();
  const searchParams = req.nextUrl.searchParams;
  const providerParam = searchParams.get("provider");

  const paymentsSignature = req.headers.get("payments-signature") || req.headers.get("Payments-Signature");
  const isPaymentsLk = providerParam === "payments_lk" || Boolean(paymentsSignature);
  const isStripe = providerParam === "stripe" || req.headers.has("stripe-signature");
  const isPayHere = providerParam === "payhere" || req.headers.get("content-type")?.includes("application/x-www-form-urlencoded");

  // ==========================================
  // 1. PAYMENTS.LK WEBHOOK HANDLER (PRIMARY)
  // Docs: https://payments.lk/developers
  // ==========================================
  if (isPaymentsLk) {
    try {
      const rawBody = await req.text();

      // Enforce strict webhook signature verification (SEC-02)
      if (!paymentsSignature) {
        console.error("[Payments.lk Webhook] Missing payments-signature header");
        return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
      }

      if (!config.paymentsLk.webhookSecret) {
        console.error("[Payments.lk Webhook] Server misconfiguration: PAYMENTS_LK_WEBHOOK_SECRET is not configured");
        return NextResponse.json({ error: "Webhook secret misconfigured" }, { status: 500 });
      }

      const verification = verifyPaymentsLkWebhook(
        rawBody,
        paymentsSignature,
        config.paymentsLk.webhookSecret
      );
      if (!verification.valid) {
        console.error("[Payments.lk Webhook] Invalid signature:", verification.error);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
      const event = verification.event;

      // 1. Handle card.saved event
      if (event.type === "card.saved" && event.data) {
        const cardData = event.data;
        const cardId = cardData.id;
        const cardBrand = cardData.scheme || cardData.brand || "card";
        const cardLast4 = cardData.last4 || "";
        const cardExpMonth = cardData.expiry?.month || null;
        const cardExpYear = cardData.expiry?.year || null;
        const paymentId = cardData.paymentId;
        const customerEmail = (cardData.customerEmail || "").toLowerCase().trim();

        if (paymentId) {
          // Look up matching payment to find tenant
          const payRows = await sql`
            SELECT tenant_id, subscription_id FROM payments 
            WHERE provider_reference = ${paymentId} OR id = ${Number(paymentId) || 0}
            LIMIT 1
          `;
          if (payRows.length > 0) {
            const tenantId = payRows[0].tenant_id;
            const t = await sql`SELECT owner_email FROM tenants WHERE id = ${tenantId} LIMIT 1`;
            const email = customerEmail || t[0]?.owner_email;
            if (email) {
              const { syncCustomerSavedCard } = await import("@/lib/payment-gateway/payments-lk");
              await syncCustomerSavedCard(tenantId, email);
            }
          }
        } else if (customerEmail) {
          const tRows = await sql`SELECT id FROM tenants WHERE LOWER(owner_email) = ${customerEmail} LIMIT 1`;
          if (tRows.length > 0) {
            const { syncCustomerSavedCard } = await import("@/lib/payment-gateway/payments-lk");
            await syncCustomerSavedCard(tRows[0].id, customerEmail);
          }
        }
      }

      // 1. Handle native subscription events from Payments.lk
      if (
        (event.type === "customer.subscription.created" ||
          event.type === "customer.subscription.updated") &&
        event.data
      ) {
        const sub = event.data;
        const metadata = sub.metadata || {};
        let tenantId = Number(metadata.tenantId) || 0;
        const customerEmail = (sub.customerEmail || sub.customer?.email || "").toLowerCase().trim();

        if (!tenantId && customerEmail) {
          const tRows = await sql`SELECT id FROM tenants WHERE LOWER(owner_email) = ${customerEmail} LIMIT 1`;
          if (tRows.length > 0) tenantId = tRows[0].id;
        }

        if (tenantId) {
          const subStatus = sub.status === "past_due" ? "past_due" : sub.status === "canceled" ? "canceled" : "active";
          const periodEnd = sub.currentPeriodEnd
            ? new Date(Number(sub.currentPeriodEnd) * 1000)
            : sub.current_period_end
            ? new Date(sub.current_period_end)
            : null;

          await sql`
            UPDATE subscriptions SET
              status = ${subStatus},
              provider_subscription_id = ${sub.id},
              auto_renew = ${subStatus !== "canceled"},
              current_period_end = COALESCE(${periodEnd}, current_period_end),
              updated_at = NOW()
            WHERE tenant_id = ${tenantId}
          `;
        }
        return NextResponse.json({ received: true });
      }

      // 2. Handle subscription deletion / cancellation from Payments.lk
      if (event.type === "customer.subscription.deleted" && event.data) {
        const sub = event.data;
        await sql`
          UPDATE subscriptions SET
            status = 'canceled',
            auto_renew = false,
            updated_at = NOW()
          WHERE provider_subscription_id = ${sub.id}
        `;
        return NextResponse.json({ received: true });
      }

      // 3. Handle recurring invoice.paid event
      if (event.type === "invoice.paid" && event.data) {
        const inv = event.data;
        const subId = inv.subscriptionId || inv.subscription?.id || "";
        let tenantId = Number(inv.metadata?.tenantId) || 0;
        const customerEmail = (inv.customerEmail || inv.customer?.email || "").toLowerCase().trim();

        if (!tenantId && subId) {
          const sRows = await sql`SELECT tenant_id FROM subscriptions WHERE provider_subscription_id = ${subId} LIMIT 1`;
          if (sRows.length > 0) tenantId = sRows[0].tenant_id;
        }

        if (!tenantId && customerEmail) {
          const tRows = await sql`SELECT id FROM tenants WHERE LOWER(owner_email) = ${customerEmail} LIMIT 1`;
          if (tRows.length > 0) tenantId = tRows[0].id;
        }

        if (tenantId) {
          const amount = inv.amountCents ? Number(inv.amountCents) / 100 : Number(inv.amount || 0);
          const planName = inv.metadata?.planName || "Pro";
          const billingInterval = (inv.metadata?.billingInterval || "monthly") as "monthly" | "yearly";

          // Coupon lifecycle check: month-based auto-expire vs manual off
          try {
            const currentSubs = await sql`SELECT id, coupon_code, current_period_start FROM subscriptions WHERE tenant_id = ${tenantId} LIMIT 1`;
            if (currentSubs.length > 0 && currentSubs[0].coupon_code) {
              const coupRows = await sql`SELECT expiry_type, duration_months, is_active FROM coupons WHERE UPPER(code) = UPPER(${currentSubs[0].coupon_code}) LIMIT 1`;
              if (coupRows.length > 0) {
                const c = coupRows[0];
                if (!c.is_active) {
                  // Admin manually paused/disabled coupon
                  await sql`UPDATE subscriptions SET coupon_code = NULL WHERE id = ${currentSubs[0].id}`.catch(() => {});
                } else if (c.expiry_type === "months") {
                  const appliedTime = currentSubs[0].current_period_start ? new Date(currentSubs[0].current_period_start) : new Date();
                  const expiryTime = new Date(appliedTime);
                  expiryTime.setMonth(expiryTime.getMonth() + Number(c.duration_months || 1));
                  if (new Date() >= expiryTime) {
                    // Month-based coupon auto-expired
                    await sql`UPDATE subscriptions SET coupon_code = NULL WHERE id = ${currentSubs[0].id}`.catch(() => {});
                  }
                }
              }
            }
          } catch (couponLifecycleErr) {
            console.warn("Coupon lifecycle check warning in webhook:", couponLifecycleErr);
          }

          await activateSubscriptionFromGateway({
            tenantId,
            planName,
            billingInterval,
            amount,
            currency: (inv.currency || "LKR").toUpperCase(),
            provider: "payments_lk",
            providerReference: inv.id || inv.paymentId || `INV_${Date.now()}`,
            providerSubscriptionId: subId || undefined,
            receiptUrl: inv.hostedInvoiceUrl || inv.receiptUrl || undefined,
            notes: `Payments.lk subscription invoice paid (${inv.id || subId})`,
            autoRenew: true,
          });
        }
        return NextResponse.json({ received: true });
      }

      // 4. Handle invoice.payment_failed (Payments.lk retries on days 1, 3, 7, 14)
      if (event.type === "invoice.payment_failed" && event.data) {
        const inv = event.data;
        const subId = inv.subscriptionId || inv.subscription?.id || "";
        if (subId) {
          await sql`
            UPDATE subscriptions SET
              status = 'past_due',
              updated_at = NOW()
            WHERE provider_subscription_id = ${subId}
          `;
        }
        return NextResponse.json({ received: true });
      }

      // 5. Handle payment.succeeded event
      if (event.type === "payment.succeeded" && event.data) {
        const data = event.data;
        const metadata = data.metadata || {};
        
        let tenantId = Number(metadata.tenantId) || 0;
        let planName = metadata.planName || "Pro";
        let billingInterval = (metadata.billingInterval || "monthly") as "monthly" | "yearly";

        // Extract details from reference: FB_{tenantId}_{plan}_{interval}_{timestamp}
        const ref = data.reference || data.payment?.reference || "";
        let parts: string[] = [];
        if (ref) {
          const delimiter = ref.includes("_") ? "_" : "-";
          parts = ref.split(delimiter);
          if (parts[0] === "FB") {
            if (parts[1] && !tenantId) tenantId = Number(parts[1]);
            if (parts[2]) planName = parts[2];
            if (parts[3]) billingInterval = parts[3] === "yearly" ? "yearly" : "monthly";
          }
        }

        const userId = metadata.userId ? Number(metadata.userId) : null;
        let amount = data.amountCents ? Number(data.amountCents) / 100 : 0;
        if (amount <= 0 && parts[2] === "WALLET" && !isNaN(Number(parts[3]))) {
          amount = Number(parts[3]);
        }
        const currency = (data.currency || "LKR").toUpperCase();
        const paymentReference = data.id || ref;

        // Extract saved card if returned on payment
        const savedCardId = data.savedCardId || data.payment?.savedCardId || null;
        const cardInfo = data.card || data.payment?.card || null;
        const cardBrand = cardInfo?.scheme || cardInfo?.brand || null;
        const cardLast4 = cardInfo?.last4 || null;
        const cardExpMonth = cardInfo?.expiry?.month || null;
        const cardExpYear = cardInfo?.expiry?.year || null;

        const isWalletTopup = parts[2] === "WALLET" || parts[2] === "WalletRecharge";

        if (isWalletTopup && tenantId) {
          const { creditWallet } = await import("@/lib/payment-gateway/wallet");
          await creditWallet({
            tenantId,
            amount,
            type: "topup",
            description: `Workspace wallet recharge (LKR ${amount.toLocaleString()})`,
            provider: "payments_lk",
            providerReference: paymentReference,
          });

          await sql`
            INSERT INTO payments (
              tenant_id, user_id, amount, currency, method, provider, provider_reference, status, notes, paid_at, created_at
            ) VALUES (
              ${tenantId}, ${userId || null}, ${amount}, ${currency}, 'card', 'payments_lk', ${paymentReference}, 'paid', 'Workspace wallet recharge', NOW(), NOW()
            )
          `;

          if (savedCardId) {
            await sql`
              UPDATE subscriptions SET
                saved_card_id = ${savedCardId},
                card_brand = COALESCE(${cardBrand}, card_brand),
                card_last4 = COALESCE(${cardLast4}, card_last4),
                card_exp_month = COALESCE(${cardExpMonth}, card_exp_month),
                card_exp_year = COALESCE(${cardExpYear}, card_exp_year),
                auto_renew = true,
                updated_at = NOW()
              WHERE tenant_id = ${tenantId}
            `;
          }
          return NextResponse.json({ received: true });
        }

        if (tenantId) {
          await activateSubscriptionFromGateway({
            tenantId,
            userId,
            planName,
            billingInterval,
            amount,
            currency,
            provider: "payments_lk",
            providerReference: paymentReference,
            receiptUrl: data.receiptUrl || data.url || undefined,
            notes: `Payments.lk subscription payment confirmed: ${paymentReference} (${billingInterval})`,
            savedCardId: savedCardId || undefined,
            cardBrand: cardBrand || undefined,
            cardLast4: cardLast4 || undefined,
            cardExpMonth: cardExpMonth || undefined,
            cardExpYear: cardExpYear || undefined,
            autoRenew: true,
          });
        }
      }

      return NextResponse.json({ received: true });
    } catch (err: any) {
      console.error("[Payments.lk Webhook Error]", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ==========================================
  // 2. STRIPE WEBHOOK HANDLER (OPTIONAL)
  // ==========================================
  if (isStripe) {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        console.error("[Stripe Webhook] Missing stripe-signature header");
        return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
      }

      if (!config.stripe.webhookSecret) {
        console.error("[Stripe Webhook] Server misconfiguration: STRIPE_WEBHOOK_SECRET is not configured");
        return NextResponse.json({ error: "Webhook secret misconfigured" }, { status: 500 });
      }

      const verification = verifyStripeSignature(rawBody, signature, config.stripe.webhookSecret);
      if (!verification.valid) {
        console.error("[Stripe Webhook] Invalid signature:", verification.error);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
      const event = verification.event;

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const tenantId = Number(session.client_reference_id || session.metadata?.tenantId);
        const planName = session.metadata?.planName || "Pro";
        const billingInterval = (session.metadata?.billingInterval || "monthly") as "monthly" | "yearly";
        const userId = session.metadata?.userId ? Number(session.metadata.userId) : null;
        const amount = session.amount_total ? session.amount_total / 100 : 0;
        const currency = (session.currency || "lkr").toUpperCase();

        if (tenantId) {
          await activateSubscriptionFromGateway({
            tenantId,
            userId,
            planName,
            billingInterval,
            amount,
            currency,
            provider: "stripe",
            providerReference: session.id,
            notes: `Stripe Checkout completed for ${planName} (${billingInterval})`,
          });
        }
      }

      return NextResponse.json({ received: true });
    } catch (err: any) {
      console.error("[Stripe Webhook Error]", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // ==========================================
  // 3. PAYHERE IPN HANDLER (OPTIONAL)
  // ==========================================
  if (isPayHere) {
    try {
      let body: Record<string, any> = {};
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("application/x-www-form-urlencoded")) {
        const text = await req.text();
        const params = new URLSearchParams(text);
        params.forEach((val, key) => {
          body[key] = val;
        });
      } else {
        body = await req.json();
      }

      if (!config.payhere.merchantSecret) {
        console.error("[PayHere Webhook] Server misconfiguration: PAYHERE_SECRET is not configured");
        return NextResponse.json({ error: "Webhook secret misconfigured" }, { status: 500 });
      }

      const verification = verifyPayHereNotification(body, config.payhere.merchantSecret);
      if (!verification.valid) {
        console.error("[PayHere Webhook] Invalid signature:", verification.error);
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }

      if (String(body.status_code) === "2") {
        const tenantId = Number(body.custom_1);
        const planName = body.custom_2 || "Pro";
        const amount = parseFloat(body.payhere_amount) || 0;
        const currency = (body.payhere_currency || "LKR").toUpperCase();
        const orderId = body.order_id;
        const paymentId = body.payment_id;

        if (tenantId) {
          await activateSubscriptionFromGateway({
            tenantId,
            planName,
            billingInterval: "monthly",
            amount,
            currency,
            provider: "payhere",
            providerReference: paymentId || orderId,
            notes: `PayHere payment captured: ${paymentId || orderId}`,
          });
        }
      }

      return NextResponse.json({ received: true });
    } catch (err: any) {
      console.error("[PayHere Webhook Error]", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
}
