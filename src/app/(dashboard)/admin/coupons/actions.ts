// src/app/(dashboard)/admin/coupons/actions.ts
"use server";

import sql from "@/lib/db";
import { requireAdmin, logAdminAction } from "@/app/(dashboard)/admin/_lib/auth";
import { revalidatePath } from "next/cache";

export async function getCouponsList() {
  await requireAdmin("view_coupons");

  const coupons = await sql`
    SELECT c.*,
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
}: {
  code: string;
  type: "percent" | "fixed";
  value: number;
  validFrom?: string;
  validTo?: string;
  maxRedemptions?: number;
  applicablePlans?: string[];
}) {
  const actor = await requireAdmin("manage_coupons");

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) throw new Error("Coupon code is required");
  if (value <= 0) throw new Error("Coupon discount value must be greater than zero");

  const rows = await sql`
    INSERT INTO coupons (
      code, type, value, valid_from, valid_to, max_redemptions, is_active, applicable_plans
    )
    VALUES (
      ${cleanCode},
      ${type},
      ${value},
      ${validFrom ? new Date(validFrom) : null},
      ${validTo ? new Date(validTo) : null},
      ${maxRedemptions || null},
      true,
      ${sql.json(applicablePlans || ["pro", "pro_plus"])}
    )
    RETURNING id
  `;

  await logAdminAction({
    actor,
    action: "CREATE_COUPON",
    targetType: "coupon",
    targetId: rows[0].id,
    after: { code: cleanCode, type, value }
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
