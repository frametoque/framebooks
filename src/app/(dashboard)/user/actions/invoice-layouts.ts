// src/app/(dashboard)/user/actions/invoice-layouts.ts
"use server";

import sql from "@/lib/db";
import { getTenantId } from "./actions";
import { getTenantPlan } from "./plan";
import { auth } from "@/lib/auth";
import { requirePermission, getUserContext, hasPermission } from "./rbac";
import { uploadToR2 } from "@/lib/r2";
import { InvoiceLayoutDefinition, CustomFieldDefinition, InvoiceLayoutRecord } from "@/lib/invoice-layout/types";
import { validateLayoutDefinition } from "@/lib/invoice-layout/schema";
import { validateCompulsoryBlocks } from "@/lib/invoice-layout/compulsory-validator";
import { STANDARD_LAYOUT_DEFINITION } from "@/lib/invoice-layout/templates";

const MAX_LAYOUTS_PER_TENANT = 10;

/**
 * Helper to upload a base64 Data URL to Cloudflare R2 under invoice-layouts/{tenantId}/{fileName}
 */
export async function uploadBase64ToR2(
  dataUrl: string,
  tenantId: string | number,
  prefix = "asset"
): Promise<string> {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9/.-]+);base64,(.+)$/);
  if (!matches) return dataUrl; // Not a base64 data URL

  const contentType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, "base64");

  let ext = "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("gif")) ext = "gif";
  else if (contentType.includes("svg")) ext = "svg";

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const fileName = `${prefix}-${timestamp}-${randomSuffix}.${ext}`;
  const customKey = `invoice-layouts/${tenantId}/${fileName}`;

  const result = await uploadToR2({
    file: buffer,
    customKey,
    contentType,
    folder: `invoice-layouts/${tenantId}`,
  });

  return result.url;
}

/**
 * Upload an invoice layout asset (background blank format, signature, or custom block image)
 * to Cloudflare R2 CDN under invoice-layouts/{tenantId}/{fileName}.
 */
export async function uploadInvoiceLayoutAsset(
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const { error: rbacError, context } = await requirePermission("invoices", "customize");
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const { tenantId } = context;

  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "No file provided." };
  }

  // Validate file type (raster images only to prevent Stored XSS via SVG scripts)
  const validTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  if (!validTypes.includes(file.type)) {
    return {
      success: false,
      error: "Invalid file type. Please upload a JPG, PNG, WebP, or GIF image.",
    };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File size must be under 5MB." };
  }

  try {
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const timestamp = Date.now();
    const sanitizedBase = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 32);
    const fileName = `${sanitizedBase}-${timestamp}.${ext}`;
    const customKey = `invoice-layouts/${tenantId}/${fileName}`;

    const result = await uploadToR2({
      file,
      customKey,
      folder: `invoice-layouts/${tenantId}`,
    });

    return { success: true, url: result.url };
  } catch (err: any) {
    console.error("Failed to upload invoice layout asset to R2:", err);
    return { success: false, error: err.message || "Failed to upload file to CDN." };
  }
}

/**
 * Check if the current user has permission to customize invoice layouts.
 */
export async function canCustomizeInvoices(): Promise<boolean> {
  const { role, tenantId } = await getUserContext();
  if (!role) return false;
  if (role.toLowerCase() === 'viewer') return false;
  return await hasPermission(role, 'invoices', 'customize', tenantId);
}

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
  documentType?: 'invoice' | 'quotation' | 'both' | 'off';
  pageSize?: 'A4' | 'Letter';
  definition: InvoiceLayoutDefinition;
  isDefault?: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;
  const userId = context.userId;

  // 1. Plan check: Pro Plus required for custom invoice layouts
  const plan = await getTenantPlan();
  if (plan !== 'Pro Plus') {
    return {
      success: false,
      error: "Custom invoice layouts are an exclusive Pro Plus feature. Upgrade to Pro Plus to create and use custom templates.",
    };
  }

  // 1.5. Migrate any Base64 images in definition to Cloudflare R2 CDN under invoice-layouts/{tenantId}/...
  let processedDefinition = data.definition;
  try {
    const def = JSON.parse(JSON.stringify(data.definition)) as InvoiceLayoutDefinition;
    if (def.theme?.backgroundImage?.startsWith("data:image/")) {
      def.theme.backgroundImage = await uploadBase64ToR2(def.theme.backgroundImage, tenantId, "bg");
    }

    if (Array.isArray(def.sections)) {
      for (const section of def.sections) {
        if (Array.isArray(section.columns)) {
          for (const col of section.columns) {
            if (Array.isArray(col.blocks)) {
              for (const block of col.blocks) {
                if (typeof block.props?.url === "string" && block.props.url.startsWith("data:image/")) {
                  block.props.url = await uploadBase64ToR2(block.props.url, tenantId, "block-img");
                }
                if (typeof block.props?.signatureImageUrl === "string" && block.props.signatureImageUrl.startsWith("data:image/")) {
                  block.props.signatureImageUrl = await uploadBase64ToR2(block.props.signatureImageUrl, tenantId, "sig");
                }
              }
            }
          }
        }
      }
    }
    processedDefinition = def;
  } catch (migErr) {
    console.warn("Base64 to R2 asset migration warning:", migErr);
  }

  // 2. Validate input schema
  const schemaValidation = validateLayoutDefinition(processedDefinition);
  if (!schemaValidation.valid) {
    return { success: false, error: schemaValidation.errors.join(" ") };
  }

  // 3. Validate compulsory blocks
  const compulsoryValidation = validateCompulsoryBlocks(processedDefinition);
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
          definition = ${sql.json(processedDefinition as any)},
          is_default = ${Boolean(data.isDefault)},
          version = version + 1,
          updated_at = NOW()
        WHERE id = ${data.id} AND tenant_id = ${tenantId}
        RETURNING id
      `;
      if (updated.length === 0) return { success: false, error: "Layout not found or access denied." };
      if (docType) {
        await syncLayoutFormatAssignments(tenantId, data.id, docType);
      }
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
          ${sql.json(processedDefinition as any)},
          ${Boolean(data.isDefault)},
          ${userId ? Number(userId) : null}
        )
        RETURNING id
      `;
      const savedId = inserted[0].id;
      if (docType) {
        await syncLayoutFormatAssignments(tenantId, savedId, docType);
      }
      return { success: true, id: savedId };
    }
  } catch (err: any) {
    console.error("Save invoice layout failed:", err);
    return { success: false, error: err.message || "Failed to save invoice layout." };
  }
}

/**
 * Helper to sync format assignments so only one format can exist for invoice,
 * and only one format can exist for quotation.
 */
export async function syncLayoutFormatAssignments(
  tenantId: string,
  targetLayoutId: string | null,
  targetType: 'invoice' | 'quotation' | 'both' | 'off'
) {
  if (!targetLayoutId || targetLayoutId === "standard") {
    if (targetType === 'both') {
      await sql`
        UPDATE invoice_layouts
        SET document_type = 'off', is_default = false, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND is_active = true
      `;
    } else if (targetType === 'invoice') {
      await sql`
        UPDATE invoice_layouts
        SET document_type = 'quotation', is_default = true, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND is_active = true AND document_type = 'both'
      `;
      await sql`
        UPDATE invoice_layouts
        SET document_type = 'off', is_default = false, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND is_active = true AND document_type = 'invoice'
      `;
    } else if (targetType === 'quotation') {
      await sql`
        UPDATE invoice_layouts
        SET document_type = 'invoice', is_default = true, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND is_active = true AND document_type = 'both'
      `;
      await sql`
        UPDATE invoice_layouts
        SET document_type = 'off', is_default = false, updated_at = NOW()
        WHERE tenant_id = ${tenantId} AND is_active = true AND document_type = 'quotation'
      `;
    }
    return;
  }

  if (targetType === 'both') {
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'both', is_default = true, updated_at = NOW()
      WHERE id = ${targetLayoutId} AND tenant_id = ${tenantId}
    `;
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'off', is_default = false, updated_at = NOW()
      WHERE id != ${targetLayoutId} AND tenant_id = ${tenantId} AND is_active = true
    `;
  } else if (targetType === 'invoice') {
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'invoice', is_default = true, updated_at = NOW()
      WHERE id = ${targetLayoutId} AND tenant_id = ${tenantId}
    `;
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'quotation', is_default = true, updated_at = NOW()
      WHERE id != ${targetLayoutId} AND tenant_id = ${tenantId} AND is_active = true AND document_type = 'both'
    `;
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'off', is_default = false, updated_at = NOW()
      WHERE id != ${targetLayoutId} AND tenant_id = ${tenantId} AND is_active = true AND document_type = 'invoice'
    `;
  } else if (targetType === 'quotation') {
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'quotation', is_default = true, updated_at = NOW()
      WHERE id = ${targetLayoutId} AND tenant_id = ${tenantId}
    `;
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'invoice', is_default = true, updated_at = NOW()
      WHERE id != ${targetLayoutId} AND tenant_id = ${tenantId} AND is_active = true AND document_type = 'both'
    `;
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'off', is_default = false, updated_at = NOW()
      WHERE id != ${targetLayoutId} AND tenant_id = ${tenantId} AND is_active = true AND document_type = 'quotation'
    `;
  } else if (targetType === 'off') {
    await sql`
      UPDATE invoice_layouts
      SET document_type = 'off', is_default = false, updated_at = NOW()
      WHERE id = ${targetLayoutId} AND tenant_id = ${tenantId}
    `;
  }
}

/**
 * Set the format assignment for a layout (invoice, quotation, or both).
 * Only one layout can exist for invoice, and only one layout can exist for quotation.
 * If target matches the currently active format on a custom layout, it toggles it off.
 */
export async function setLayoutFormat(
  id: string | "standard",
  target: 'invoice' | 'quotation' | 'both'
): Promise<{ success: boolean; error?: string }> {
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;

  const plan = await getTenantPlan();
  if (id !== "standard" && plan !== "Pro Plus") {
    return {
      success: false,
      error: "Custom invoice layouts are an exclusive Pro Plus feature. Upgrade to Pro Plus to activate custom formats.",
    };
  }

  try {
    if (id === "standard") {
      await syncLayoutFormatAssignments(tenantId, "standard", target);
      return { success: true };
    }

    const currentRows = await sql`
      SELECT document_type FROM invoice_layouts
      WHERE id = ${id} AND tenant_id = ${tenantId} AND is_active = true
      LIMIT 1
    `;
    if (currentRows.length === 0) {
      return { success: false, error: "Layout not found." };
    }

    const currentDocType = currentRows[0].document_type;
    const nextTarget = currentDocType === target ? 'off' : target;
    await syncLayoutFormatAssignments(tenantId, id, nextTarget);
    return { success: true };
  } catch (err: any) {
    console.error("Set layout format failed:", err);
    return { success: false, error: err.message || "Failed to update layout format." };
  }
}

/**
 * Update layout document type (backwards compatibility).
 */
export async function updateLayoutDocumentType(
  id: string,
  documentType: 'invoice' | 'quotation' | 'both' | 'off'
): Promise<{ success: boolean; error?: string }> {
  return setLayoutFormat(id, documentType === 'off' ? 'both' : documentType);
}

/**
 * Set a layout as default for the workspace (backwards compatibility).
 */
export async function setDefaultInvoiceLayout(id: string | null): Promise<{ success: boolean; error?: string }> {
  return setLayoutFormat(id || "standard", "both");
}

/**
 * Delete a layout. Blocked if active invoices reference it.
 */
export async function deleteInvoiceLayout(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: "Invalid layout ID" };
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;

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
 * Duplicate an existing layout (custom layout by ID, or standard template).
 */
export async function duplicateInvoiceLayout(id: string): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!id) return { success: false, error: "Invalid layout ID" };
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;
  const userId = context.userId;

  // 1. Pro Plus check
  const plan = await getTenantPlan();
  if (plan !== 'Pro Plus') {
    return {
      success: false,
      error: "Custom invoice layouts are an exclusive Pro Plus feature. Upgrade to Pro Plus to duplicate and customize templates.",
    };
  }

  // 2. Enforce layout limit
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

  let baseName = "Standard Classic";
  let docType: 'invoice' | 'quotation' | 'both' = 'both';
  let pageSize: 'A4' | 'Letter' = 'A4';
  let definition: InvoiceLayoutDefinition = STANDARD_LAYOUT_DEFINITION;

  if (id === "standard" || id === "default") {
    baseName = "Standard Classic";
    docType = 'both';
    pageSize = 'A4';
    definition = STANDARD_LAYOUT_DEFINITION;
  } else {
    const rows = await sql`
      SELECT * FROM invoice_layouts
      WHERE id = ${id} AND tenant_id = ${tenantId} AND is_active = true
      LIMIT 1
    `;
    if (rows.length === 0) {
      return { success: false, error: "Layout not found." };
    }
    const original = rows[0];
    baseName = original.name;
    docType = original.document_type || 'both';
    pageSize = original.page_size || 'A4';
    definition = original.definition;
  }

  let newName = `${baseName.trim()} (Copy)`;
  if (newName.length > 80) {
    newName = newName.slice(0, 80);
  }

  try {
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
        ${newName},
        ${docType},
        ${pageSize},
        ${sql.json(definition as any)},
        false,
        ${userId ? Number(userId) : null}
      )
      RETURNING id
    `;

    return { success: true, id: inserted[0].id };
  } catch (err: any) {
    console.error("Duplicate invoice layout failed:", err);
    return { success: false, error: err.message || "Failed to duplicate layout." };
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
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;

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
  if (!id) return { success: false, error: "Invalid field ID" };
  const { error: rbacError, context } = await requirePermission('invoices', 'customize');
  if (rbacError || !context) return { success: false, error: rbacError || "Unauthorized" };

  const tenantId = context.tenantId;

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
