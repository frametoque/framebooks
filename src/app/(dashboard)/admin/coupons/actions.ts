// src/app/(dashboard)/admin/coupons/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getCouponsList() {
  await requireAdmin("view_coupons");

  const coupons = await sql`
    SELECT c.*,
      COALESCE(c.expiry_type, 'manual') AS expiry_type,
      COALESCE(c.duration_months, 1) AS duration_months,
      COALESCE((
        SELECT COUNT(*) FROM coupon_redemptions cr WHERE cr.coupon_id = c.id
      ), 0) AS actual_redemptions
    FROM coupons c
    ORDER BY c.created_at DESC
  `;

  return coupons;
}

export async function createCoupon({
  code,
  type,
  value,
  validFrom,
  validTo,
  maxRedemptions,
  applicablePlans,
  expiryType = "manual",
  durationMonths = 1,
}: {
  code: string;
  type: "percent" | "fixed";
  value: number;
  validFrom?: string;
  validTo?: string;
  maxRedemptions?: number;
  applicablePlans?: string[];
  expiryType?: "manual" | "months";
  durationMonths?: number;
}) {
  const actor = await requireAdmin("manage_coupons");

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Coupon code is required");
  if (value <= 0) throw new Error("Coupon discount value must be greater than zero");

  const rows = await sql`
    INSERT INTO coupons (
      code, type, value, valid_from, valid_to, max_redemptions, is_active, applicable_plans,
      expiry_type, duration_months
    )
    VALUES (
      ${cleanCode},
      ${type},
      ${value},
      ${validFrom ? new Date(validFrom) : null},
      ${validTo ? new Date(validTo) : null},
      ${maxRedemptions || null},
      true,
      ${sql.json(applicablePlans || ["pro", "pro_plus"])},
      ${expiryType},
      ${Number(durationMonths) || 1}
    )
    RETURNING id
  `;

  await logAdminAction({
    actor,
    action: "CREATE_COUPON",
    targetType: "coupon",
    targetId: rows[0].id,
    after: { code: cleanCode, type, value, expiryType, durationMonths }
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function toggleCouponActive(id: number, isActive: boolean) {
  const actor = await requireAdmin("manage_coupons");

  await sql`UPDATE coupons SET is_active = ${isActive} WHERE id = ${id}`;

  await logAdminAction({
    actor,
    action: isActive ? "ACTIVATE_COUPON" : "DEACTIVATE_COUPON",
    targetType: "coupon",
    targetId: id,
    after: { is_active: isActive }
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function updateCoupon({
  id,
  code,
  type,
  value,
  validFrom,
  validTo,
  maxRedemptions,
  isActive,
  applicablePlans,
  expiryType,
  durationMonths,
}: {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  validFrom?: string;
  validTo?: string;
  maxRedemptions?: number | null;
  isActive?: boolean;
  applicablePlans?: string[];
  expiryType?: "manual" | "months";
  durationMonths?: number;
}) {
  const actor = await requireAdmin("manage_coupons");

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Coupon code is required");
  if (value <= 0) throw new Error("Coupon discount value must be greater than zero");

  const existingRows = await sql`SELECT * FROM coupons WHERE id = ${id} LIMIT 1`;
  if (existingRows.length === 0) throw new Error("Coupon not found");
  const before = existingRows[0];

  await sql`
    UPDATE coupons SET
      code = ${cleanCode},
      type = ${type},
      value = ${value},
      valid_from = ${validFrom ? new Date(validFrom) : null},
      valid_to = ${validTo ? new Date(validTo) : null},
      max_redemptions = ${maxRedemptions !== undefined ? maxRedemptions : before.max_redemptions},
      is_active = ${isActive !== undefined ? isActive : before.is_active},
      applicable_plans = ${applicablePlans && applicablePlans.length > 0 ? sql.json(applicablePlans) : sql.json(["pro", "pro_plus"])},
      expiry_type = ${expiryType !== undefined ? expiryType : (before.expiry_type || "manual")},
      duration_months = ${durationMonths !== undefined ? Number(durationMonths) : (before.duration_months || 1)}
    WHERE id = ${id}
  `;

  await logAdminAction({
    actor,
    action: "UPDATE_COUPON",
    targetType: "coupon",
    targetId: id,
    before: { code: before.code, type: before.type, value: before.value, is_active: before.is_active },
    after: { code: cleanCode, type, value, is_active: isActive }
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}
