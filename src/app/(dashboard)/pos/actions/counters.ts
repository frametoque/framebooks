"use server";

import sql from "@/lib/db";
import { requirePosPermission } from "@/app/(dashboard)/user/actions/rbac";
import { ensurePosSchema } from "@/lib/pos/db-init";

export interface PosCounter {
  id: number;
  tenant_id: number;
  name: string;
  code: string | null;
  is_active: boolean;
  created_at: string;
  active_shift?: {
    id: number;
    shift_number: number;
    user_id: number;
    user_name: string;
    opened_at: string;
    opening_cash: number;
  } | null;
}

/**
 * Fetch all Cashier Counters for the current tenant.
 * Also returns any active open shift associated with each counter.
 */
export async function getCountersAction(): Promise<{ success: boolean; counters: PosCounter[]; error?: string }> {
  await ensurePosSchema();
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, counters: [], error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);

  try {
    // Ensure default counter exists if none created yet
    const existing = await sql`SELECT id FROM pos_counters WHERE tenant_id = ${tenantId} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO pos_counters (tenant_id, name, code, is_active)
        VALUES (${tenantId}, 'Counter 1', 'C1', true)
        ON CONFLICT (tenant_id, name) DO NOTHING
      `;
    }

    const rows = await sql`
      SELECT 
        c.id,
        c.tenant_id,
        c.name,
        c.code,
        c.is_active,
        c.created_at,
        s.id as shift_id,
        s.shift_number,
        s.user_id as shift_user_id,
        s.user_name as shift_user_name,
        s.opened_at as shift_opened_at,
        s.opening_cash as shift_opening_cash
      FROM pos_counters c
      LEFT JOIN pos_shifts s ON s.counter_id = c.id AND s.tenant_id = c.tenant_id AND s.status = 'open'
      WHERE c.tenant_id = ${tenantId}
      ORDER BY c.id ASC
    `;

    const counters: PosCounter[] = rows.map((r: any) => ({
      id: Number(r.id),
      tenant_id: Number(r.tenant_id),
      name: r.name,
      code: r.code || null,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      active_shift: r.shift_id
        ? {
            id: Number(r.shift_id),
            shift_number: Number(r.shift_number || r.shift_id),
            user_id: Number(r.shift_user_id),
            user_name: r.shift_user_name || "Cashier",
            opened_at: r.shift_opened_at,
            opening_cash: parseFloat(r.shift_opening_cash || 0),
          }
        : null,
    }));

    return { success: true, counters };
  } catch (err: any) {
    console.error("[POS Counters] Error loading counters:", err);
    return { success: false, counters: [], error: err.message };
  }
}

/**
 * Create a new Cashier Counter in POS settings.
 */
export async function createCounterAction(data: {
  name: string;
  code?: string;
}): Promise<{ success: boolean; counter?: PosCounter; error?: string }> {
  await ensurePosSchema();
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error || "Permission denied to manage POS settings." };
  }

  const tenantId = Number(perm.context.tenantId);
  const name = (data.name || "").trim();
  const code = (data.code || "").trim().toUpperCase() || null;

  if (!name) {
    return { success: false, error: "Counter name is required." };
  }

  try {
    const existing = await sql`
      SELECT id FROM pos_counters 
      WHERE tenant_id = ${tenantId} AND LOWER(name) = LOWER(${name})
      LIMIT 1
    `;
    if (existing.length > 0) {
      return { success: false, error: `A counter named "${name}" already exists.` };
    }

    const inserted = await sql`
      INSERT INTO pos_counters (tenant_id, name, code, is_active)
      VALUES (${tenantId}, ${name}, ${code}, true)
      RETURNING id, tenant_id, name, code, is_active, created_at
    `;

    return {
      success: true,
      counter: {
        id: Number(inserted[0].id),
        tenant_id: Number(inserted[0].tenant_id),
        name: inserted[0].name,
        code: inserted[0].code,
        is_active: Boolean(inserted[0].is_active),
        created_at: inserted[0].created_at,
        active_shift: null,
      },
    };
  } catch (err: any) {
    console.error("[POS Counters] Error creating counter:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing Cashier Counter (name, code, active status).
 */
export async function updateCounterAction(
  id: number,
  data: { name?: string; code?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  await ensurePosSchema();
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error || "Permission denied to manage POS settings." };
  }

  const tenantId = Number(perm.context.tenantId);

  try {
    const counter = await sql`SELECT id FROM pos_counters WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1`;
    if (counter.length === 0) {
      return { success: false, error: "Counter not found." };
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) return { success: false, error: "Counter name cannot be empty." };

      const duplicate = await sql`
        SELECT id FROM pos_counters 
        WHERE tenant_id = ${tenantId} AND LOWER(name) = LOWER(${name}) AND id != ${id}
        LIMIT 1
      `;
      if (duplicate.length > 0) {
        return { success: false, error: `Another counter with the name "${name}" already exists.` };
      }
    }

    await sql`
      UPDATE pos_counters SET
        name = COALESCE(${data.name?.trim() || null}, name),
        code = COALESCE(${data.code?.trim().toUpperCase() || null}, code),
        is_active = COALESCE(${data.is_active !== undefined ? data.is_active : null}, is_active),
        updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("[POS Counters] Error updating counter:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a Cashier Counter if no active shift is running on it.
 */
export async function deleteCounterAction(id: number): Promise<{ success: boolean; error?: string }> {
  await ensurePosSchema();
  const perm = await requirePosPermission('stock.manage');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error || "Permission denied to manage POS settings." };
  }

  const tenantId = Number(perm.context.tenantId);

  try {
    // Check if total counters <= 1 (must keep at least 1 counter)
    const totalCounters = await sql`SELECT COUNT(*) as count FROM pos_counters WHERE tenant_id = ${tenantId}`;
    if (Number(totalCounters[0]?.count || 0) <= 1) {
      return { success: false, error: "You must keep at least one counter in POS." };
    }

    // Check if an active shift is open on this counter
    const activeShift = await sql`
      SELECT id, user_name, shift_number FROM pos_shifts 
      WHERE tenant_id = ${tenantId} AND counter_id = ${id} AND status = 'open'
      LIMIT 1
    `;
    if (activeShift.length > 0) {
      return {
        success: false,
        error: `Cannot delete counter: Shift #${activeShift[0].shift_number || activeShift[0].id} is currently open by ${activeShift[0].user_name}. Please close the shift first.`,
      };
    }

    await sql`DELETE FROM pos_counters WHERE id = ${id} AND tenant_id = ${tenantId}`;
    return { success: true };
  } catch (err: any) {
    console.error("[POS Counters] Error deleting counter:", err);
    return { success: false, error: err.message };
  }
}
