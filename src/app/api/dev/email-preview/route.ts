import { NextResponse } from "next/server";
import {
  buildVerificationCodeEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildTeamInviteEmail,
  buildPaymentReceiptEmail,
  buildPlanChangeEmail,
  buildSubscriptionAlertEmail,
  buildClientInvoiceEmail,
  sendEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const SAMPLE_TEMPLATES: Record<string, () => { subject: string; html: string; text: string }> = {
  "verification-code": () =>
    buildVerificationCodeEmail({
      code: "824915",
      firstName: "Nelitha",
    }),
  "welcome": () =>
    buildWelcomeEmail({
      firstName: "Nelitha",
      loginUrl: "https://framebooks.lk/login",
    }),
  "password-reset": () =>
    buildPasswordResetEmail({
      firstName: "Nelitha",
      resetUrl: "https://framebooks.lk/reset-password?token=sample_test_token_12345",
    }),
  "team-invite": () =>
    buildTeamInviteEmail({
      inviterName: "Nelitha Kulasiri",
      businessName: "Acme Studio",
      role: "Editor",
      acceptUrl: "https://framebooks.lk/accept-invite?token=sample_invite_token_123",
    }),
  "payment-receipt": () =>
    buildPaymentReceiptEmail({
      amount: 2500,
      planName: "Pro",
      activeUntilDate: "30 Nov 2026",
      referenceId: "PAY-882194",
      receiptUrl: "https://framebooks.lk/api/receipt/PAY-882194",
      firstName: "Nelitha",
    }),
  "plan-change": () =>
    buildPlanChangeEmail({
      planName: "Pro Plus",
      workspaceName: "Acme Studio",
      effectiveDate: "30 Oct 2026",
      firstName: "Nelitha",
    }),
  "subscription-alert": () =>
    buildSubscriptionAlertEmail({
      type: "payment_failed",
      planName: "Pro",
      amount: 2500,
      date: "30 Oct 2026",
      updateUrl: "https://framebooks.lk/user/settings/billing",
      firstName: "Nelitha",
    }),
  "client-invoice": () =>
    buildClientInvoiceEmail({
      invoiceNumber: "INV-0042",
      businessName: "Acme Studio",
      clientName: "Jane Silva",
      amount: 180000,
      dueDate: "15 Nov 2026",
      viewInvoiceUrl: "https://framebooks.lk/api/invoice/sample-inv-0042",
      notes: "Payment due within 14 business days.",
      isFreePlan: false,
    }),
};

export async function GET(req: Request) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const templateKey = url.searchParams.get("template") || "verification-code";
  const viewMode = url.searchParams.get("view") || "html"; // "html" | "text" | "raw"
  const themeMode = url.searchParams.get("theme") || "light"; // "light" | "dark"
  const widthMode = url.searchParams.get("width") || "560"; // "560" | "320"

  const templateBuilder = SAMPLE_TEMPLATES[templateKey] || SAMPLE_TEMPLATES["verification-code"];
  const rendered = templateBuilder();

  // If requesting raw HTML directly (for iframe srcdoc)
  if (viewMode === "raw") {
    return new NextResponse(rendered.html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  // Interactive development preview dashboard
  const templateOptions = Object.keys(SAMPLE_TEMPLATES)
    .map(
      (key) =>
        `<a href="?template=${key}&theme=${themeMode}&width=${widthMode}&view=${viewMode}" style="padding: 8px 14px; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; ${
          key === templateKey
            ? "background-color: #00E35B; color: #041418;"
            : "background-color: #1E293B; color: #94A3B8;"
        }">${key}</a>`
    )
    .join(" ");

  const previewHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Framebooks Email Preview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0F1D; color: #E2E8F0; }
    .toolbar { background: #0F172A; border-bottom: 1px solid #1E293B; padding: 14px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .templates { display: flex; flex-wrap: wrap; gap: 6px; }
    .controls { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #334155; background: #1E293B; color: #F1F5F9; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; }
    .btn.active { background: #00E35B; color: #041418; border-color: #00E35B; }
    .stage { display: flex; justify-content: center; padding: 32px 16px; background: ${themeMode === "dark" ? "#070B0E" : "#E2E8F0"}; min-height: calc(100vh - 120px); }
    .frame-wrapper { width: ${widthMode}px; transition: width 0.2s ease; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.25); background: ${themeMode === "dark" ? "#0B0F14" : "#FFFFFF"}; }
    iframe { width: 100%; height: 740px; border: none; display: block; }
    pre { margin: 0; padding: 24px; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: ${themeMode === "dark" ? "#E2E8F0" : "#1E293B"}; }
    .test-box { display: flex; gap: 6px; }
    input[type="email"] { background: #1E293B; border: 1px solid #334155; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="templates">
      ${templateOptions}
    </div>
    <div class="controls">
      <span>Width:</span>
      <a href="?template=${templateKey}&theme=${themeMode}&width=560&view=${viewMode}" class="btn ${widthMode === "560" ? "active" : ""}">560px</a>
      <a href="?template=${templateKey}&theme=${themeMode}&width=320&view=${viewMode}" class="btn ${widthMode === "320" ? "active" : ""}">320px</a>
      
      <span>Theme:</span>
      <a href="?template=${templateKey}&theme=light&width=${widthMode}&view=${viewMode}" class="btn ${themeMode === "light" ? "active" : ""}">Light</a>
      <a href="?template=${templateKey}&theme=dark&width=${widthMode}&view=${viewMode}" class="btn ${themeMode === "dark" ? "active" : ""}">Dark</a>

      <span>View:</span>
      <a href="?template=${templateKey}&theme=${themeMode}&width=${widthMode}&view=html" class="btn ${viewMode === "html" ? "active" : ""}">HTML</a>
      <a href="?template=${templateKey}&theme=${themeMode}&width=${widthMode}&view=text" class="btn ${viewMode === "text" ? "active" : ""}">Plain Text</a>

      <form method="POST" style="margin: 0; display: inline-flex; gap: 6px;">
        <input type="hidden" name="template" value="${templateKey}" />
        <input type="email" name="to" placeholder="your@email.com" required style="width: 160px;" />
        <button type="submit" class="btn" style="background: #00E35B; color: #041418; border-color: #00E35B;">Send Test</button>
      </form>
    </div>
  </div>

  <div style="background: #0B1120; padding: 8px 24px; font-size: 13px; color: #94A3B8; border-bottom: 1px solid #1E293B;">
    <strong>Subject:</strong> ${rendered.subject}
  </div>

  <div class="stage">
    <div class="frame-wrapper">
      ${
        viewMode === "text"
          ? `<pre>${rendered.text}</pre>`
          : `<iframe src="?template=${templateKey}&theme=${themeMode}&width=${widthMode}&view=raw"></iframe>`
      }
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(previewHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const formData = await req.formData();
  const templateKey = (formData.get("template") as string) || "verification-code";
  const toEmail = (formData.get("to") as string)?.trim();

  if (!toEmail) {
    return new NextResponse("Missing email", { status: 400 });
  }

  const templateBuilder = SAMPLE_TEMPLATES[templateKey] || SAMPLE_TEMPLATES["verification-code"];
  const rendered = templateBuilder();

  await sendEmail({
    to: toEmail,
    subject: `[TEST PREVIEW] ${rendered.subject}`,
    text: rendered.text,
    html: rendered.html,
    category: `test-${templateKey}`,
  });

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family: sans-serif; background: #0A0F1D; color: #fff; padding: 40px; text-align: center;">
      <h2 style="color: #00E35B;">Test Email Sent!</h2>
      <p>Sent <strong>${templateKey}</strong> to <strong>${toEmail}</strong>.</p>
      <a href="/api/dev/email-preview?template=${templateKey}" style="color: #00E35B; text-decoration: underline;">Back to Preview</a>
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
