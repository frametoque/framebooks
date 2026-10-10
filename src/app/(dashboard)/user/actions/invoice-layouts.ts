// src/app/(dashboard)/user/actions/invoice-layouts.ts
"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { getTenantPlan } from "./plan";
import { auth } from "@/lib/auth";
import { InvoiceLayoutDefinition, CustomFieldDefinition, InvoiceLayoutRecord } from "@/lib/invoice-layout/types";
import { validateLayoutDefinition } from "@/lib/invoice-layout/schema";
import { validateCompulsoryBlocks } from "@/lib/invoice-layout/compulsory-validator";
import { STANDARD_LAYOUT_DEFINITION } from "@/lib/invoice-layout/templates";

const MAX_LAYOUTS_PER_TENANT = 10;

/**
 * Fetch all invoice layouts for the active workspace.
 */
export async function getInvoiceLayouts(): Promise<InvoiceLayoutRecord[]> {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  try {
    const rows = await sql`
      SELECT 
        l.id,
        l.tenant_id,
        l.name,
        l.document_type,
        l.page_size,
        l.orientation,
        l.definition,
        l.is_default,
        l.is_active,
        l.thumbnail_url,
        l.version,
        l.created_by,
        l.created_at,
        l.updated_at,
        ((SELECT COUNT(*)::int FROM invoices inv WHERE inv.layout_id = l.id) + (SELECT COUNT(*)::int FROM admin_quotations q WHERE q.layout_id = l.id)) as usage_count
      FROM invoice_layouts l
      WHERE l.tenant_id = ${tenantId} AND l.is_active = true
      ORDER BY l.is_default DESC, l.created_at DESC
    `;
    return rows as unknown as InvoiceLayoutRecord[];
  } catch (err) {
    console.error("Failed to fetch invoice layouts:", err);
    return [];
  }
}

/**
 * Fetch a single invoice layout by ID (tenant-scoped).
 */
export async function getInvoiceLayout(id: string): Promise<InvoiceLayoutRecord | null> {
  const tenantId = await getTenantId();
  if (!tenantId || !id) return null;

  try {
    const rows = await sql`
      SELECT 
        l.*,
        (SELECT COUNT(*)::int FROM invoices inv WHERE inv.layout_id = l.id) as usage_count
      FROM invoice_layouts l
      WHERE l.id = ${id} AND l.tenant_id = ${tenantId} AND l.is_active = true
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return rows[0] as unknown as InvoiceLayoutRecord;
  } catch (err) {
    console.error("Failed to fetch invoice layout:", err);
    return null;
  }
}

/**
 * Save or update an invoice layout.
 * Enforces Pro Plus plan requirement server-side.
 */
export async function saveInvoiceLayout(data: {
  id?: string;
  name: string;
  documentType?: 'invoice' | 'quotation' | 'both';
  pageSize?: 'A4' | 'Letter';
  definition: InvoiceLayoutDefinition;
  isDefault?: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { success: false, error: "Unauthorized" };

  const { userId } = await auth();

  // 1. Plan check: Pro Plus required for custom invoice layouts
  const plan = await getTenantPlan();
  if (plan !== 'Pro Plus') {
    return {
      success: false,
      error: "Custom invoice layouts are an exclusive Pro Plus feature. Upgrade to Pro Plus to create and use custom templates.",
    };
  }

  // 2. Validate input schema
  const schemaValidation = validateLayoutDefinition(data.definition);
  if (!schemaValidation.valid) {
    return { success: false, error: schemaValidation.errors.join(" ") };
  }

  // 3. Validate compulsory blocks
  const compulsoryValidation = validateCompulsoryBlocks(data.definition);
  if (!compulsoryValidation.valid) {
    return {
      success: false,
      error: `Missing required blocks: ${compulsoryValidation.missingBlocks.join(", ")}. Invoices must include these fields to remain legally compliant.`,
    };
  }

  const name = data.name.trim();
  if (!name) return { success: false, error: "Layout name is required." };
  const docType = data.documentType || 'both';

  try {
    // 4. Enforce max limit for new layouts
    if (!data.id) {
      const countRes = await sql`
        SELECT COUNT(*)::int as count FROM invoice_layouts 
        WHERE tenant_id = ${tenantId} AND is_active = true
      `;
      const currentCount = countRes[0]?.count || 0;
      if (currentCount >= MAX_LAYOUTS_PER_TENANT) {
        return {
          success: false,
          error: `Workspace layout limit reached (${MAX_LAYOUTS_PER_TENANT} layouts). Delete an unused layout before creating a new one.`,
        };
      }
    }

    // 5. If setting as default, clear previous default
    if (data.isDefault) {
      await sql`
        UPDATE invoice_layouts 
        SET is_default = false 
        WHERE tenant_id = ${tenantId}
      `;
    }

    if (data.id) {
      // Update existing layout
      const updated = await sql`
        UPDATE invoice_layouts
        SET 
          name = ${name},
          document_type = ${docType},
          page_size = ${data.pageSize || 'A4'},
          definition = ${sql.json(data.definition as any)},
          is_default = ${Boolean(data.isDefault)},
          version = version + 1,
          updated_at = NOW()
        WHERE id = ${data.id} AND tenant_id = ${tenantId}
        RETURNING id
      `;
      if (updated.length === 0) return { success: false, error: "Layout not found or access denied." };
      return { success: true, id: updated[0].id };
    } else {
      // Create new layout
      const inserted = await sql`
        INSERT INTO invoice_layouts (
          tenant_id,
          name,
          document_type,
          page_size,
          definition,
          is_default,
          created_by
        ) VALUES (
          ${tenantId},
          ${name},
          ${docType},
          ${data.pageSize || 'A4'},
          ${sql.json(data.definition as any)},
          ${Boolean(data.isDefault)},
          ${userId ? Number(userId) : null}
        )
        RETURNING id
      `;
      return { success: true, id: inserted[0].id };
    }
  } catch (err: any) {
    console.error("Save invoice layout failed:", err);
    return { success: false, error: err.message || "Failed to save invoice layout." };
  }
}

/**
 * Update the document type target for a layout (invoice only, quotation only, or both).
 */
export async function updateLayoutDocumentType(
  id: string,
  documentType: 'invoice' | 'quotation' | 'both'
): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { success: false, error: "Unauthorized" };

  const plan = await getTenantPlan();
  if (plan !== 'Pro Plus') {
    return { success: false, error: "Custom layouts are an exclusive Pro Plus feature." };
  }

  try {
    const updated = await sql`
      UPDATE invoice_layouts
      SET document_type = ${documentType}, updated_at = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING id
    `;
    if (updated.length === 0) return { success: false, error: "Layout not found." };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update layout document type." };
  }
}

/**
 * Set a layout as default for the workspace.
 */
export async function setDefaultInvoiceLayout(id: string | null): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { success: false, error: "Unauthorized" };

  try {
    // Clear existing defaults
    await sql`UPDATE invoice_layouts SET is_default = false WHERE tenant_id = ${tenantId}`;

    if (id) {
      await sql`
        UPDATE invoice_layouts 
        SET is_default = true 
        WHERE id = ${id} AND tenant_id = ${tenantId}
      `;
    }

    return { success: true };
  } catch (err: any) {
    console.error("Set default layout failed:", err);
    return { success: false, error: "Failed to set default layout." };
  }
}

/**
 * Delete a layout. Blocked if active invoices reference it.
 */
export async function deleteInvoiceLayout(id: string): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId || !id) return { success: false, error: "Unauthorized" };

  try {
    // Check if any invoices reference this layout
    const refRes = await sql`
      SELECT COUNT(*)::int as count FROM invoices 
      WHERE layout_id = ${id} AND tenant_id = ${tenantId}
    `;
    const count = refRes[0]?.count || 0;

    if (count > 0) {
      return {
        success: false,
        error: `Cannot delete this layout because it is assigned to ${count} active invoice${count === 1 ? '' : 's'}. Please reassign those invoices first.`,
      };
    }

    await sql`
      DELETE FROM invoice_layouts 
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    return { success: true };
  } catch (err: any) {
    console.error("Delete invoice layout failed:", err);
    return { success: false, error: "Failed to delete layout." };
  }
}

/**
 * Fetch workspace custom fields for invoices.
 */
export async function getCustomFields(): Promise<CustomFieldDefinition[]> {
  const tenantId = await getTenantId();
  if (!tenantId) return [];

  try {
    const rows = await sql`
      SELECT * FROM invoice_custom_fields
      WHERE tenant_id = ${tenantId} AND is_active = true
      ORDER BY sort_order ASC, created_at ASC
    `;
    return rows as unknown as CustomFieldDefinition[];
  } catch (err) {
    console.error("Failed to fetch custom fields:", err);
    return [];
  }
}

/**
 * Save or update an invoice custom field.
 */
export async function saveCustomField(field: {
  id?: string;
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'dropdown' | 'boolean';
  options?: string[];
  defaultValue?: string;
  isRequired?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { success: false, error: "Unauthorized" };

  const key = field.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const label = field.label.trim();
  if (!key || !label) return { success: false, error: "Field key and label are required." };

  try {
    if (field.id) {
      await sql`
        UPDATE invoice_custom_fields
        SET 
          label = ${label},
          type = ${field.type || 'text'},
          options = ${sql.json(field.options || [])},
          default_value = ${field.defaultValue || null},
          is_required = ${Boolean(field.isRequired)},
          updated_at = NOW()
        WHERE id = ${field.id} AND tenant_id = ${tenantId}
      `;
    } else {
      await sql`
        INSERT INTO invoice_custom_fields (
          tenant_id,
          key,
          label,
          type,
          options,
          default_value,
          is_required
        ) VALUES (
          ${tenantId},
          ${key},
          ${label},
          ${field.type || 'text'},
          ${sql.json(field.options || [])},
          ${field.defaultValue || null},
          ${Boolean(field.isRequired)}
        )
      `;
    }
    return { success: true };
  } catch (err: any) {
    console.error("Save custom field failed:", err);
    return { success: false, error: err.message || "Failed to save custom field." };
  }
}

/**
 * Delete a custom field.
 */
export async function deleteCustomField(id: string): Promise<{ success: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId || !id) return { success: false, error: "Unauthorized" };

  try {
    await sql`
      DELETE FROM invoice_custom_fields 
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return { success: true };
  } catch (err: any) {
    console.error("Delete custom field failed:", err);
    return { success: false, error: "Failed to delete custom field." };
  }
}
