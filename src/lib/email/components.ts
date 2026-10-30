import { escapeHtml, sanitizeUrl } from "./utils";

/**
 * Renders standard 16px body paragraph with 1.5 line height.
 */
export function renderParagraph(text: string, isLast = false): string {
  const margin = isLast ? "margin: 0;" : "margin: 0 0 18px 0;";
  return `<p class="text-body" style="${margin} font-size: 16px; line-height: 24px; color: #1e293b;">${escapeHtml(text)}</p>`;
}

/**
 * Renders clean, un-gimmicky monospace code block.
 * Large 32px digits, letter-spaced, solid 1px border, 8px radius.
 */
export function renderCodeBlock(code: string): string {
  const cleanCode = String(code).trim();
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
  <tr>
    <td>
      <div class="code-box" style="background-color: #f4f5f7; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; text-align: left;">
        <span class="code-text" style="font-family: 'SF Mono', Menlo, Consolas, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; line-height: 38px; display: inline-block;">${escapeHtml(cleanCode)}</span>
      </div>
    </td>
  </tr>
</table>`;
}

/**
 * Bulletproof table-based action button.
 * Minimum 44px height for mobile tappability, brand green background, dark text, 8px radius.
 */
export function renderButton(label: string, url: string): string {
  const safeUrl = sanitizeUrl(url);
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
  <tr>
    <td align="left">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" bgcolor="#00E35B" style="border-radius: 8px; background-color: #00E35B;">
            <a href="${safeUrl}" target="_blank" class="btn" style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 700; color: #041418; text-decoration: none; border-radius: 8px; line-height: 20px; min-height: 20px;">
              ${escapeHtml(label)}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Calm, small neutral text (warnings, secondary notices, tips).
 */
export function renderMuted(text: string, isLast = false): string {
  const margin = isLast ? "margin: 0;" : "margin: 0 0 20px 0;";
  return `<p class="text-muted" style="${margin} font-size: 14px; line-height: 22px; color: #64748b;">${escapeHtml(text)}</p>`;
}

/**
 * Subtle divider line.
 */
export function renderDivider(): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
  <tr>
    <td class="divider" style="border-top: 1px solid #e2e8f0; height: 1px; font-size: 1px; line-height: 1px;">&nbsp;</td>
  </tr>
</table>`;
}

/**
 * Two-column clean detail rows (for receipts, invoices, subscription changes).
 */
export function renderDetailRows(rows: { label: string; value: string; isBold?: boolean }[]): string {
  const rowsHtml = rows
    .map(
      (r, idx) => `<tr class="detail-row" style="border-bottom: 1px solid #f1f5f9;">
    <td class="detail-label" style="padding: ${idx === 0 ? "8px" : "12px"} 0; font-size: 14px; color: #64748b; line-height: 20px;">
      ${escapeHtml(r.label)}
    </td>
    <td class="detail-value" align="right" style="padding: ${idx === 0 ? "8px" : "12px"} 0; font-size: 14px; color: ${r.isBold ? "#0f172a" : "#334155"}; font-weight: ${r.isBold ? "700" : "500"}; line-height: 20px;">
      ${escapeHtml(r.value)}
    </td>
  </tr>`
    )
    .join("");

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0 24px 0;">
  ${rowsHtml}
</table>`;
}
