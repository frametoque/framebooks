"use server";

import sql from "@/lib/db";
import { requirePosPermission, hasGranularPermission, getUserContext } from "@/app/(dashboard)/user/actions/rbac";
import { ensurePosSchema } from "@/lib/pos/db-init";
import { logSystemAction } from "@/lib/logger";
import { encryptField, decryptField, blindIndex } from "@/lib/security/crypto";

export interface PosPromotion {
  id: number;
  tenant_id: number;
  name: string;
  type: 'brand' | 'bundle' | 'item' | 'cart';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  brand?: string | null;
  trigger_item_id?: number | null;
  target_item_id?: number | null;
  trigger_item_name?: string | null;
  target_item_name?: string | null;
  min_quantity: number;
  min_cart_total: number;
  requires_manager_approval: boolean;
  active: boolean;
  created_at: string;
}

/**
 * Load all active/configured promotions for the tenant.
 */
export async function loadPosPromotionsAction(): Promise<{
  success: boolean;
  promotions: PosPromotion[];
  error?: string;
}> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, promotions: [] };
  }

  const tenantId = Number(perm.context.tenantId);
  await ensurePosSchema();

  try {
    const rows = await sql`
      SELECT 
        p.*,
        t_trig.item_name as trigger_item_name,
        t_targ.item_name as target_item_name
      FROM pos_promotions p
      LEFT JOIN admin_inventory t_trig ON p.trigger_item_id = t_trig.id
      LEFT JOIN admin_inventory t_targ ON p.target_item_id = t_targ.id
      WHERE p.tenant_id = ${tenantId}
      ORDER BY p.active DESC, p.created_at DESC
    `;

    return {
      success: true,
      promotions: rows.map((r: any) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        name: r.name,
        type: r.type,
        discount_type: r.discount_type,
        discount_value: parseFloat(r.discount_value || 0),
        brand: r.brand || null,
        trigger_item_id: r.trigger_item_id ? Number(r.trigger_item_id) : null,
        target_item_id: r.target_item_id ? Number(r.target_item_id) : null,
        trigger_item_name: r.trigger_item_name || null,
        target_item_name: r.target_item_name || null,
        min_quantity: parseInt(r.min_quantity || '1'),
        min_cart_total: parseFloat(r.min_cart_total || 0),
        requires_manager_approval: Boolean(r.requires_manager_approval),
        active: Boolean(r.active),
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  } catch (err: any) {
    console.error("loadPosPromotionsAction error:", err);
    return { success: false, error: err.message, promotions: [] };
  }
}

/**
 * Create or update a promotion / special offer rule.
 */
export async function savePosPromotionAction(data: {
  id?: number | null;
  name: string;
  type: 'brand' | 'bundle' | 'item' | 'cart';
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  brand?: string | null;
  trigger_item_id?: number | null;
  target_item_id?: number | null;
  min_quantity?: number;
  min_cart_total?: number;
  requires_manager_approval?: boolean;
  active?: boolean;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: "Only managers and administrators are authorized to create or modify promotional offers." };
  }

  const tenantId = Number(perm.context.tenantId);
  await ensurePosSchema();

  const name = (data.name || "").trim();
  if (!name) return { success: false, error: "Promotion name is required." };
  if (data.discount_value <= 0) return { success: false, error: "Discount value must be greater than zero." };

  try {
    if (data.id) {
      await sql`
        UPDATE pos_promotions
        SET
          name = ${name},
          type = ${data.type},
          discount_type = ${data.discount_type},
          discount_value = ${data.discount_value},
          brand = ${data.brand || null},
          trigger_item_id = ${data.trigger_item_id || null},
          target_item_id = ${data.target_item_id || null},
          min_quantity = ${data.min_quantity ?? 1},
          min_cart_total = ${data.min_cart_total ?? 0},
          requires_manager_approval = ${Boolean(data.requires_manager_approval)},
          active = ${data.active !== undefined ? data.active : true},
          updated_at = NOW()
        WHERE id = ${data.id} AND tenant_id = ${tenantId}
      `;
      await logSystemAction(`Updated POS promotion: "${name}"`);
      return { success: true, id: data.id };
    } else {
      const inserted = await sql`
        INSERT INTO pos_promotions (
          tenant_id, name, type, discount_type, discount_value, brand,
          trigger_item_id, target_item_id, min_quantity, min_cart_total,
          requires_manager_approval, active, created_at, updated_at
        ) VALUES (
          ${tenantId}, ${name}, ${data.type}, ${data.discount_type}, ${data.discount_value}, ${data.brand || null},
          ${data.trigger_item_id || null}, ${data.target_item_id || null}, ${data.min_quantity ?? 1}, ${data.min_cart_total ?? 0},
          ${Boolean(data.requires_manager_approval)}, ${data.active !== undefined ? data.active : true}, NOW(), NOW()
        )
        RETURNING id
      `;
      await logSystemAction(`Created POS promotion: "${name}" (${data.discount_value}${data.discount_type === 'percent' ? '%' : ' LKR'} off)`);
      return { success: true, id: inserted[0]?.id };
    }
  } catch (err: any) {
    console.error("savePosPromotionAction error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Toggle promotion active status.
 */
export async function togglePosPromotionAction(id: number, active: boolean) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: "Only managers and administrators are authorized to toggle promotional offers." };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    await sql`
      UPDATE pos_promotions
      SET active = ${active}, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a promotion.
 */
export async function deletePosPromotionAction(id: number) {
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: "Only managers and administrators are authorized to delete promotional offers." };
  }

  const tenantId = Number(perm.context.tenantId);
  try {
    await sql`
      DELETE FROM pos_promotions
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Verify a manager access code or scanned manager QR badge to authorize a special offer.
 */
export async function verifyManagerPosCodeAction(
  code: string,
  offerName?: string
): Promise<{
  success: boolean;
  managerName?: string;
  managerRole?: string;
  error?: string;
}> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: "Unauthorized session." };
  }

  const tenantId = Number(perm.context.tenantId);
  await ensurePosSchema();

  let cleanCode = (code || '').trim();
  if (cleanCode.toUpperCase().startsWith("POS_MGR:")) {
    cleanCode = cleanCode.substring(8).trim();
  }

  if (!cleanCode) {
    return { success: false, error: "Please enter or scan a valid manager access code." };
  }

  try {
    const bidxCode = blindIndex(cleanCode.toLowerCase(), tenantId);
    const rows = await sql`
      SELECT id, full_name, email, role, pos_manager_code, pos_manager_code_enc
      FROM admin_users
      WHERE tenant_id = ${tenantId}
        AND (
          pos_manager_code_bidx = ${bidxCode}
          OR (pos_manager_code IS NOT NULL AND LOWER(TRIM(pos_manager_code)) = LOWER(${cleanCode}))
        )
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { success: false, error: "Invalid access code. No manager found with this code." };
    }

    const mgr = rows[0];
    const roleLower = (mgr.role || '').toLowerCase();
    const isOwnerOrAdmin = roleLower === 'owner' || roleLower === 'super admin' || roleLower === 'admin' || roleLower === 'manager';
    const canManageStock = await hasGranularPermission(mgr.role, 'stock.manage', tenantId);

    if (!isOwnerOrAdmin && !canManageStock) {
      return {
        success: false,
        error: `User "${mgr.full_name || mgr.email}" does not have manager authorization privileges.`
      };
    }

    const managerName = mgr.full_name || mgr.email.split('@')[0];
    await logSystemAction(
      `Manager "${managerName}" (${mgr.role}) authorized promotional offer${offerName ? ` "${offerName}"` : ''} at POS terminal.`
    );

    return {
      success: true,
      managerName,
      managerRole: mgr.role,
    };
  } catch (err: any) {
    console.error("verifyManagerPosCodeAction error:", err);
    return { success: false, error: err.message || "Failed to verify access code." };
  }
}

/**
 * Get a team member's POS Access Code for Team settings.
 */
export async function getUserPosCodeAction(userId: number): Promise<{
  success: boolean;
  posCode?: string | null;
  error?: string;
}> {
  const context = await getUserContext();
  if (!context.tenantId || !context.userId) {
    return { success: false, error: "Unauthorized session." };
  }

  const tenantId = Number(context.tenantId);
  await ensurePosSchema();

  try {
    const rows = await sql`
      SELECT id, full_name, email, role, pos_manager_code, pos_manager_code_enc
      FROM admin_users
      WHERE id = ${userId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { success: false, error: "User not found." };
    }

    let posCode = rows[0].pos_manager_code || null;
    if (rows[0].pos_manager_code_enc) {
      try {
        posCode = decryptField(rows[0].pos_manager_code_enc, {
          tenantId,
          table: "admin_users",
          column: "pos_manager_code",
          recordId: userId,
        });
      } catch {
        // Fallback to pos_manager_code
      }
    }

    return { success: true, posCode };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update or generate a team member's POS Access Code from Team settings.
 */
export async function updateUserPosCodeAction(
  userId: number,
  code: string
): Promise<{
  success: boolean;
  posCode?: string;
  error?: string;
}> {
  const context = await getUserContext();
  if (!context.tenantId || !context.userId) {
    return { success: false, error: "Unauthorized session." };
  }

  const tenantId = Number(context.tenantId);
  const currentRole = (context.role || '').toLowerCase();
  const isAuthorized =
    currentRole === 'owner' ||
    currentRole === 'super admin' ||
    currentRole === 'admin' ||
    String(context.userId) === String(userId);

  if (!isAuthorized) {
    return { success: false, error: "Only administrators or the account holder can update POS access codes." };
  }

  const cleanCode = (code || '').trim();
  if (!cleanCode || cleanCode.length < 4) {
    return { success: false, error: "POS access code must be at least 4 characters long." };
  }

  await ensurePosSchema();

  try {
    const bidxCode = blindIndex(cleanCode.toLowerCase(), tenantId);
    const encCode = encryptField(cleanCode, {
      tenantId,
      table: "admin_users",
      column: "pos_manager_code",
      recordId: userId,
    });

    // Check if code is already taken by another user in this tenant
    const existing = await sql`
      SELECT id, full_name FROM admin_users
      WHERE tenant_id = ${tenantId}
        AND id != ${userId}
        AND (
          pos_manager_code_bidx = ${bidxCode}
          OR (pos_manager_code IS NOT NULL AND LOWER(TRIM(pos_manager_code)) = LOWER(${cleanCode}))
        )
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (existing.length > 0) {
      return { success: false, error: `This access code is already assigned to "${existing[0].full_name || 'another team member'}". Please choose a different code.` };
    }

    await sql`
      UPDATE admin_users
      SET pos_manager_code = ${cleanCode},
          pos_manager_code_enc = ${encCode},
          pos_manager_code_bidx = ${bidxCode}
      WHERE id = ${userId} AND tenant_id = ${tenantId}
    `;

    await logSystemAction(`Updated POS manager access code for user #${userId}`);
    return { success: true, posCode: cleanCode };
  } catch (err: any) {
    console.error("updateUserPosCodeAction error:", err);
    return { success: false, error: err.message };
  }
}
