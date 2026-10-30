import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderDetailRows, renderButton } from "../components";

export interface PlanChangeEmailData {
  planName: string;
  workspaceName?: string;
  effectiveDate: string;
  firstName?: string;
  dashboardUrl?: string;
}

export function buildPlanChangeEmail({
  planName,
  workspaceName,
  effectiveDate,
  firstName,
  dashboardUrl = "https://books.frametoque.com/user/dashboard",
}: PlanChangeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your plan has been updated to ${planName}`;
  const preheader = "Your new limits and features are active.";

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";

  const rows = [
    { label: "New plan", value: planName, isBold: true },
    { label: "Effective date", value: effectiveDate },
  ];

  if (workspaceName) {
    rows.unshift({ label: "Workspace", value: workspaceName, isBold: false });
  }

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph(`Your Framebooks workspace has been updated to ${planName}. All included features and updated limits are ready to use.`)}
    ${renderDetailRows(rows)}
    ${renderButton("Open dashboard", dashboardUrl)}
    ${renderParagraph("If you have questions about your plan or billing, feel free to reply to this email.")}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const text = `Framebooks

${greeting}

Your Framebooks workspace has been updated to ${planName}. All included features and updated limits are ready to use.

${workspaceName ? `Workspace: ${workspaceName}\n` : ""}New plan: ${planName}
Effective date: ${effectiveDate}

Open dashboard: ${dashboardUrl}

If you have questions about your plan or billing, feel free to reply to this email.

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? framebooks@frametoque.com`;

  return { subject, html, text };
}
