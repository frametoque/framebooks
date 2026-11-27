import sql from "@/lib/db";
import { ensurePosSchema } from "./db-init";

export interface PosAddonStatus {
  hasAddon: boolean;
  status: 'active' | 'suspended' | 'cancelled' | 'requested' | 'none';
  purchasedAt?: string | null;
  expiresAt?: string | null;
  price?: number;
  billingInterval?: string;
  canPurchase: boolean; // Only Pro or Pro Plus can purchase
  currentPlan: string;
}

export interface PosAddonPricing {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  isActive: boolean;
  compatiblePlans: string[];
}

/**
 * Single source of truth for POS Add-on pricing.
 * Reads dynamically from system_addons table with robust defaults.
 */
export async function getPosAddonPricing(): Promise<PosAddonPricing> {
  try {
    await ensurePosSchema();
    const rows = await sql`
      SELECT key, name, description, price_monthly, price_yearly, is_active, compatible_plans
      FROM system_addons
      WHERE key = 'pos'
      LIMIT 1
    `;
    if (rows.length > 0) {
      const row = rows[0];
      const monthly = Number(row.price_monthly) || 3000;
      const yearly = Number(row.price_yearly) || (monthly * 10);
      return {
        key: row.key || 'pos',
        name: row.name || 'Point of Sale (POS)',
        description: row.description || 'Complete Cloud Point of Sale add-on for retail counters, fast barcode scanning, receipt printing, and live stock tracking.',
        priceMonthly: monthly,
        priceYearly: yearly,
        isActive: row.is_active !== false,
        compatiblePlans: Array.isArray(row.compatible_plans) ? row.compatible_plans : ['pro', 'pro_plus'],
      };
    }
  } catch (err) {
    console.warn("[getPosAddonPricing] Notice:", err);
  }

  return {
    key: 'pos',
    name: 'Point of Sale (POS)',
    description: 'Complete Cloud Point of Sale add-on for retail counters, fast barcode scanning, receipt printing, and live stock tracking.',
    priceMonthly: 3000,
    priceYearly: 30000,
    isActive: true,
    compatiblePlans: ['pro', 'pro_plus'],
  };
}

/**
 * Checks whether a tenant is entitled to use the POS add-on.
 * Rule: POS is NOT included in Free, Pro, or Pro Plus. Only Pro and Pro Plus tenants can purchase it.
 */
export async function getPosAddonStatus(tenantId: number | string | null): Promise<PosAddonStatus> {
  if (!tenantId) {
    return {
      hasAddon: false,
      status: 'none',
      canPurchase: false,
      currentPlan: 'Free',
    };
  }

  await ensurePosSchema();

  const numTenantId = Number(tenantId);

  // 1. Check tenant plan
  const tenantRows = await sql`SELECT plan FROM tenants WHERE id = ${numTenantId} LIMIT 1`;
  const currentPlan = tenantRows[0]?.plan || 'Free';
  const isEligiblePlan = currentPlan.toLowerCase() === 'pro' || currentPlan.toLowerCase() === 'pro plus';

  if (!isEligiblePlan) {
    return {
      hasAddon: false,
      status: 'none',
      canPurchase: false,
      currentPlan,
    };
  }

  // 2. Check tenant_addons table
  const addonRows = await sql`
    SELECT status, purchased_at, expires_at, price, billing_interval
    FROM tenant_addons
    WHERE tenant_id = ${numTenantId} AND addon_key = 'pos'
    LIMIT 1
  `;

  if (addonRows.length === 0) {
    return {
      hasAddon: false,
      status: 'none',
      canPurchase: true,
      currentPlan,
    };
  }

  const addon = addonRows[0];
  const isExpired = addon.expires_at ? new Date(addon.expires_at) < new Date() : false;
  const isActive = addon.status === 'active' && !isExpired;

  return {
    hasAddon: isActive,
    status: isExpired ? 'suspended' : addon.status,
    purchasedAt: addon.purchased_at ? new Date(addon.purchased_at).toISOString() : null,
    expiresAt: addon.expires_at ? new Date(addon.expires_at).toISOString() : null,
    price: Number(addon.price || 0),
    billingInterval: addon.billing_interval || 'monthly',
    canPurchase: !isActive,
    currentPlan,
  };
}

/**
 * Server-side guard to strictly enforce POS entitlement.
 */
export async function requirePosAddon(tenantId: number | string | null): Promise<{ error: string | null }> {
  if (!tenantId) {
    return { error: "Authentication and tenant context required." };
  }

  const status = await getPosAddonStatus(tenantId);

  if (!status.canPurchase && status.currentPlan.toLowerCase() === 'free') {
    return { error: "POS is a paid add-on available only on Pro and Pro Plus plans. Please upgrade your plan first." };
  }

  if (!status.hasAddon) {
    return { error: "Tenant is not entitled to the POS add-on. Please activate or purchase the POS add-on." };
  }

  return { error: null };
}

/**
 * Grant or activate POS add-on for a tenant (Admin or checkout completion).
 */
export async function grantPosAddon(
  tenantId: number | string,
  options?: {
    price?: number;
    billingInterval?: 'monthly' | 'yearly';
    expiresAt?: Date | null;
  }
) {
  await ensurePosSchema();
  const tid = Number(tenantId);
  const pricing = await getPosAddonPricing();
  const billingInterval = options?.billingInterval ?? 'monthly';
  const defaultPrice = billingInterval === 'yearly' ? pricing.priceYearly : pricing.priceMonthly;
  const price = options?.price ?? defaultPrice;
  const expiresAt = options?.expiresAt ?? null;

  await sql`
    INSERT INTO tenant_addons (
      tenant_id, addon_key, status, purchased_at, expires_at, price, billing_interval, updated_at
    ) VALUES (
      ${tid}, 'pos', 'active', NOW(), ${expiresAt}, ${price}, ${billingInterval}, NOW()
    )
    ON CONFLICT (tenant_id, addon_key) DO UPDATE SET
      status = 'active',
      purchased_at = NOW(),
      expires_at = EXCLUDED.expires_at,
      price = EXCLUDED.price,
      billing_interval = EXCLUDED.billing_interval,
      updated_at = NOW()
  `;

  return { success: true };
}

/**
 * Revoke or suspend POS add-on for a tenant.
 */
export async function revokePosAddon(tenantId: number | string) {
  await ensurePosSchema();
  const tid = Number(tenantId);

  await sql`
    UPDATE tenant_addons
    SET status = 'cancelled', updated_at = NOW()
    WHERE tenant_id = ${tid} AND addon_key = 'pos'
  `;

  return { success: true };
}

/**
 * Tenant request to enable/purchase POS add-on.
 */
export async function requestPosAddon(tenantId: number | string) {
  await ensurePosSchema();
  const tid = Number(tenantId);
  const pricing = await getPosAddonPricing();

  await sql`
    INSERT INTO tenant_addons (
      tenant_id, addon_key, status, purchased_at, price, billing_interval, updated_at
    ) VALUES (
      ${tid}, 'pos', 'requested', NOW(), ${pricing.priceMonthly}, 'monthly', NOW()
    )
    ON CONFLICT (tenant_id, addon_key) DO UPDATE SET
      status = 'requested',
      price = EXCLUDED.price,
      updated_at = NOW()
  `;

  return { success: true };
}
