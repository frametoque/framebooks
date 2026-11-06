/**
 * Fee configuration for Payments.lk.
 * Payments.lk charges 2.29% of each payment from the merchant.
 * Per policy, this fee is built directly into package fees as our fee and rounded up to standard,
 * clean SaaS price points (e.g., LKR 2,600 / 26,000) so clients never perceive a fractional surcharge.
 * 
 * Yearly packages give 2 months free (Yearly = Monthly fee * 10), providing an exact ~17% discount.
 * 
 * IMPORTANT: Wallet recharges must NEVER include this fee. Wallet top-up charges the direct amount chosen by the user.
 */
export const PAYMENTS_LK_GATEWAY_FEE_RATE = 0.0229; // 2.29%
export const PACKAGE_ANNUAL_DISCOUNT_PERCENT = 17; // 2 months free out of 12 = 16.67% -> ~17%
export const PACKAGE_ANNUAL_FREE_MONTHS = 2;

/**
 * Adds the 2.29% gateway fee and rounds UP to clean, standard rounded prices.
 * - Monthly plans are rounded up to the nearest 100 LKR (e.g. 2,500 + fee -> 2,600; 5,000 + fee -> 5,200).
 * - Yearly plans equal Monthly fee * 10 (giving 2 months free / ~17% discount, e.g. 26,000 / 52,000).
 */
export function addPackageGatewayFee(
  baseAmount: number | null | undefined,
  interval?: "monthly" | "yearly"
): number {
  const num = Number(baseAmount) || 0;
  if (num <= 0) return 0;

  // Determine if yearly calculation should be used
  const isYearly = interval === "yearly" || num >= 10000;
  if (isYearly) {
    // Derive monthly base (e.g. 25,000 -> 2,500; 50,000 -> 5,000)
    const monthlyBase = num >= 10000 ? num / 10 : num;
    const monthlyWithFee = Math.ceil(((monthlyBase * 10229) / 10000) / 100) * 100;
    // Yearly is exactly 10x monthly fee (2 months free)
    return monthlyWithFee * 10;
  }

  // Monthly: round up to nearest 100 LKR
  const withFee = (num * 10229) / 10000;
  return Math.ceil(withFee / 100) * 100;
}

export interface PlanPricingBreakdown {
  baseMonthly: number;
  baseYearly: number;
  feeMonthly: number;
  feeYearly: number;
  coveringMonthly: number;
  coveringYearly: number;
  feeRatePercent: number;
}

/**
 * Calculates a full pricing breakdown comparing our net price, the Payments.lk gateway fee (2.29%),
 * and the final rounded client covering price.
 */
export function calculatePlanPricingBreakdown(
  baseMonthly: number | null | undefined,
  baseYearly?: number | null | undefined
): PlanPricingBreakdown {
  const m = Number(baseMonthly) || 0;
  const y = baseYearly != null && Number(baseYearly) > 0 ? Number(baseYearly) : m * 10;

  if (m <= 0) {
    return {
      baseMonthly: 0,
      baseYearly: 0,
      feeMonthly: 0,
      feeYearly: 0,
      coveringMonthly: 0,
      coveringYearly: 0,
      feeRatePercent: 2.29,
    };
  }

  const coveringMonthly = addPackageGatewayFee(m, "monthly");
  const feeMonthly = Math.round(m * PAYMENTS_LK_GATEWAY_FEE_RATE * 100) / 100;

  const coveringYearly = addPackageGatewayFee(y, "yearly");
  const feeYearly = Math.round(y * PAYMENTS_LK_GATEWAY_FEE_RATE * 100) / 100;

  return {
    baseMonthly: m,
    baseYearly: y,
    feeMonthly,
    feeYearly,
    coveringMonthly,
    coveringYearly,
    feeRatePercent: 2.29,
  };
}
