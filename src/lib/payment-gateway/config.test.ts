import test from "node:test";
import assert from "node:assert/strict";
import { 
  getGatewayConfig, 
  getGatewayStatus, 
  isLiveEnvironment, 
  isCardPaymentsDisabledOnLive 
} from "./config.ts";

test("Payments.lk live test-key safety guard", async (t) => {
  const originalEnv = { ...process.env };

  t.afterEach(() => {
    process.env = { ...originalEnv };
  });

  await t.test("Disables card payments when secret starts with sk_test_ on live environment", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.PAYMENTS_LK_SECRET_KEY = "sk_test_1234567890abcdef";
    process.env.PAYMENTS_LK_PUBLIC_KEY = "pk_test_1234567890abcdef";
    delete process.env.PAYMENTS_LK_ENV;
    delete process.env.VERCEL_ENV;

    assert.equal(isLiveEnvironment(), true);
    assert.equal(isCardPaymentsDisabledOnLive(), true);

    const config = getGatewayConfig();
    assert.equal(config.paymentsLk.cardPaymentsDisabled, true);
    assert.equal(config.paymentsLk.isAvailable, false);
    assert.equal(config.isConfigured, false);
    assert.equal(config.activeProvider, "sandbox");

    const status = getGatewayStatus();
    assert.equal(status.cardPaymentsDisabled, true);
    assert.equal(status.availableProviders.payments_lk, false);
    assert.equal(status.availableProviders.sandbox, false); // in production, sandbox is false
  });

  await t.test("Allows card payments when live key (sk_live_) is configured on live environment", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.PAYMENTS_LK_SECRET_KEY = "sk_live_9876543210fedcba";
    process.env.PAYMENTS_LK_PUBLIC_KEY = "pk_live_9876543210fedcba";
    delete process.env.PAYMENTS_LK_ENV;
    delete process.env.VERCEL_ENV;

    assert.equal(isLiveEnvironment(), true);
    assert.equal(isCardPaymentsDisabledOnLive(), false);

    const config = getGatewayConfig();
    assert.equal(config.paymentsLk.cardPaymentsDisabled, false);
    assert.equal(config.paymentsLk.isAvailable, true);
    assert.equal(config.activeProvider, "payments_lk");

    const status = getGatewayStatus();
    assert.equal(status.cardPaymentsDisabled, false);
    assert.equal(status.availableProviders.payments_lk, true);
  });

  await t.test("Allows card payments with sk_test_ in development environment", () => {
    (process.env as any).NODE_ENV = "development";
    process.env.PAYMENTS_LK_SECRET_KEY = "sk_test_1234567890abcdef";
    process.env.PAYMENTS_LK_PUBLIC_KEY = "pk_test_1234567890abcdef";
    delete process.env.PAYMENTS_LK_ENV;
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    assert.equal(isLiveEnvironment(), false);
    assert.equal(isCardPaymentsDisabledOnLive(), false);

    const config = getGatewayConfig();
    assert.equal(config.paymentsLk.cardPaymentsDisabled, false);
    assert.equal(config.paymentsLk.isAvailable, true);
    assert.equal(config.activeProvider, "payments_lk");

    const status = getGatewayStatus();
    assert.equal(status.cardPaymentsDisabled, false);
    assert.equal(status.availableProviders.payments_lk, true);
    assert.equal(status.availableProviders.sandbox, true);
  });
});
