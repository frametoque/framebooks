import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderButton, renderMuted } from "../components";

export interface PasswordResetEmailData {
  resetUrl: string;
  firstName?: string;
}

export function buildPasswordResetEmail({ resetUrl, firstName }: PasswordResetEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Reset your Framebooks password";
  const preheader = "The link works for 1 hour.";

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph("Use the button below to choose a new password. The link works for 1 hour. If you didn't ask for this, no action is needed.")}
    ${renderButton("Reset password", resetUrl)}
    ${renderMuted("If the button doesn't work, copy and paste this link into your browser: " + resetUrl)}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const text = `Framebooks

${greeting}

Use the link below to choose a new password. The link works for 1 hour. If you didn't ask for this, no action is needed.

${resetUrl}

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? info@frametoque.com`;

  return { subject, html, text };
}
