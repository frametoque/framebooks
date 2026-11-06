import test from "node:test";
import assert from "node:assert/strict";
import { 
  addPackageGatewayFee, 
  PAYMENTS_LK_GATEWAY_FEE_RATE,
  PACKAGE_ANNUAL_DISCOUNT_PERCENT,
  PACKAGE_ANNUAL_FREE_MONTHS
} from "./fee.ts";

test("Payments.lk fee calculation with clean rounded values and 2 months free", async (t) => {
  await t.test("Gateway fee rate is exactly 2.29%", () => {
    assert.equal(PAYMENTS_LK_GATEWAY_FEE_RATE, 0.0229);
  });

  await t.test("Annual discount constants are accurate", () => {
    assert.equal(PACKAGE_ANNUAL_FREE_MONTHS, 2);
    assert.equal(PACKAGE_ANNUAL_DISCOUNT_PERCENT, 17);
  });

  await t.test("Free plans remain 0 LKR", () => {
    assert.equal(addPackageGatewayFee(0), 0);
    assert.equal(addPackageGatewayFee(null), 0);
  });

  await t.test("Pro monthly base price 2,500 rounds cleanly to 2,600", () => {
    // 2500 * 1.0229 = 2557.25 -> rounds up to clean standard 2,600
    assert.equal(addPackageGatewayFee(2500, "monthly"), 2600);
  });

  await t.test("Pro yearly price is exactly monthly * 10 (26,000) giving 2 months free", () => {
    // Monthly is 2,600 -> Yearly is 2,600 * 10 = 26,000
    assert.equal(addPackageGatewayFee(25000, "yearly"), 26000);
    assert.equal(addPackageGatewayFee(25000), 26000);
  });

  await t.test("Pro Plus monthly base price 5,000 rounds cleanly to 5,200", () => {
    // 5000 * 1.0229 = 5114.5 -> rounds up to clean standard 5,200
    assert.equal(addPackageGatewayFee(5000, "monthly"), 5200);
  });

  await t.test("Pro Plus yearly price is exactly monthly * 10 (52,000) giving 2 months free", () => {
    // Monthly is 5,200 -> Yearly is 5,200 * 10 = 52,000
    assert.equal(addPackageGatewayFee(50000, "yearly"), 52000);
    assert.equal(addPackageGatewayFee(50000), 52000);
  });
});
