import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderButton } from "../components";

export interface TeamInviteEmailData {
  inviterName: string;
  businessName: string;
  role: string;
  acceptUrl: string;
}

export function buildTeamInviteEmail({
  inviterName,
  businessName,
  role,
  acceptUrl,
}: TeamInviteEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const cleanInviter = inviterName?.trim() || "A team member";
  const cleanBusiness = businessName?.trim() || "their workspace";
  const subject = `${cleanInviter} invited you to ${cleanBusiness} on Framebooks`;
  const preheader = `Join as a ${role} on Framebooks.`;

  const contentHtml = `
    ${renderParagraph(`Hi,`)}
    ${renderParagraph(`${cleanInviter} invited you to join ${cleanBusiness} as a ${role} on Framebooks.`)}
    ${renderButton("Accept invitation", acceptUrl)}
    ${renderParagraph("If you don't recognize this business, you can safely ignore this email.")}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const text = `Framebooks

Hi,

${cleanInviter} invited you to join ${cleanBusiness} as a ${role} on Framebooks.

Accept your invitation here:
${acceptUrl}

If you don't recognize this business, you can safely ignore this email.

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? info@frametoque.com`;

  return { subject, html, text };
}
