"use server";

import sql from "@/lib/db";
import { requirePosPermission } from "@/app/(dashboard)/user/actions/rbac";
import { logSystemAction } from "@/lib/logger";

export interface PosClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company?: string | null;
}

/**
 * Search existing clients for the tenant by name or phone.
 */
export async function searchPosClientsAction(query: string): Promise<{ success: boolean; clients: PosClient[]; error?: string }> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, clients: [] };
  }

  const tenantId = Number(perm.context.tenantId);
  const q = (query || "").trim();
  const digitsOnly = q.replace(/\D/g, "");

  try {
    const searchFilter = q
      ? sql`AND (
          LOWER(full_name) ILIKE ${`%${q.toLowerCase()}%`} 
          OR LOWER(COALESCE(phone, '')) ILIKE ${`%${q.toLowerCase()}%`}
          ${digitsOnly.length >= 4 ? sql`OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${'%' + digitsOnly + '%'}` : sql``}
        )`
      : sql``;

    const rows = await sql`
      SELECT id, full_name, phone, email, company
      FROM admin_clients
      WHERE tenant_id = ${tenantId}
        AND (active = true OR active IS NULL)
        ${searchFilter}
      ORDER BY full_name ASC
      LIMIT 15
    `;

    return {
      success: true,
      clients: rows.map((r: any) => ({
        id: r.id,
        name: r.full_name || "Unknown",
        phone: r.phone || null,
        email: r.email || null,
        company: r.company || null,
      })),
    };
  } catch (err: any) {
    console.error("searchPosClientsAction error:", err);
    return { success: false, error: err.message, clients: [] };
  }
}

/**
 * Direct lookup for a client by phone number (handles digits, formatting, spaces).
 */
export async function findPosClientByPhoneAction(phone: string): Promise<{ success: boolean; client?: PosClient | null; error?: string }> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error, client: null };
  }

  const tenantId = Number(perm.context.tenantId);
  const rawPhone = (phone || "").trim();
  const digitsOnly = rawPhone.replace(/\D/g, "");

  if (!rawPhone) {
    return { success: true, client: null };
  }

  try {
    const rows = await sql`
      SELECT id, full_name, phone, email, company
      FROM admin_clients
      WHERE tenant_id = ${tenantId}
        AND (active = true OR active IS NULL)
        AND (
          phone = ${rawPhone}
          ${digitsOnly.length >= 7 ? sql`OR REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${'%' + digitsOnly}` : sql``}
        )
      ORDER BY id DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { success: true, client: null };
    }

    const r = rows[0];
    return {
      success: true,
      client: {
        id: r.id,
        name: r.full_name || "Unknown",
        phone: r.phone || rawPhone,
        email: r.email || null,
        company: r.company || null,
      },
    };
  } catch (err: any) {
    console.error("findPosClientByPhoneAction error:", err);
    return { success: false, error: err.message, client: null };
  }
}

/**
 * Save or resolve a client in admin_clients before starting a POS sale.
 */
export async function savePosClientAction(data: {
  name: string;
  phone?: string | null;
  email?: string | null;
}): Promise<{ success: boolean; client?: PosClient; error?: string }> {
  const perm = await requirePosPermission('pos.use');
  if (perm.error || !perm.context) {
    return { success: false, error: perm.error };
  }

  const tenantId = Number(perm.context.tenantId);
  const name = (data.name || "").trim();
  const phone = data.phone?.trim() || null;
  const email = data.email?.trim() || null;

  if (!name && !phone) {
    return { success: false, error: "Please enter customer name or phone number." };
  }

  const finalName = name || (phone ? `Customer ${phone}` : "Walk-in Customer");

  // Skip inserting generic walk-in customers
  if (finalName.toLowerCase() === "walk-in customer" && !phone) {
    return {
      success: true,
      client: {
        id: "walk-in",
        name: "Walk-in Customer",
        phone: null,
        email: null,
      },
    };
  }

  try {
    // 1. Look for existing match
    const existing = await sql`
      SELECT id, full_name, phone, email, company
      FROM admin_clients
      WHERE tenant_id = ${tenantId}
        AND (
          LOWER(full_name) = LOWER(${finalName})
          OR (${phone || null}::text IS NOT NULL AND phone = ${phone})
        )
      LIMIT 1
    `;

    if (existing.length > 0) {
      const match = existing[0];
      // Update phone if newly provided
      if (phone && !match.phone) {
        await sql`
          UPDATE admin_clients
          SET phone = ${phone}, updated_at = NOW()
          WHERE id = ${match.id} AND tenant_id = ${tenantId}
        `;
      }
      return {
        success: true,
        client: {
          id: match.id,
          name: match.full_name,
          phone: phone || match.phone || null,
          email: match.email || null,
          company: match.company || null,
        },
      };
    }

    // 2. Insert new client
    const clientId = 'C-POS-' + Date.now();
    await sql`
      INSERT INTO admin_clients (
        id, full_name, phone, email, active, tenant_id, created_at, updated_at
      ) VALUES (
        ${clientId}, ${finalName}, ${phone}, ${email}, true, ${tenantId}, NOW(), NOW()
      )
    `;

    await logSystemAction(`Registered POS client "${finalName}" (${phone || 'No phone'})`);

    return {
      success: true,
      client: {
        id: clientId,
        name: finalName,
        phone,
        email,
      },
    };
  } catch (err: any) {
    console.error("savePosClientAction error:", err);
    return { success: false, error: err.message };
  }
}
