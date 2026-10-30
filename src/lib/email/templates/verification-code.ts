import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderCodeBlock, renderMuted } from "../components";

export interface VerificationCodeEmailData {
  code: string;
  firstName?: string;
  purpose?: string; // Optional custom purpose, defaults to account unlock / App Lock
}

export function buildVerificationCodeEmail({ code, firstName, purpose }: VerificationCodeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const cleanCode = String(code).trim();
  const subject = `${cleanCode} is your Framebooks code`;
  const preheader = "It works for 10 minutes.";

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";
  const reasonText = purpose
    ? `Someone asked to ${purpose}. If that was you, enter this code:`
    : "Someone asked to unlock your Framebooks account or turn off App Lock. If that was you, enter this code:";

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph(reasonText)}
    ${renderCodeBlock(cleanCode)}
    ${renderParagraph("It works once and expires in 10 minutes.")}
    ${renderMuted("If this wasn't you, you can ignore this email. Your account stays locked. If you think someone else knows your password, change it from Settings.")}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const text = `Framebooks

${greeting}

${reasonText}

${cleanCode}

It works once and expires in 10 minutes.

If this wasn't you, you can ignore this email. Your account stays locked. If you think someone else knows your password, change it from Settings.

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? info@frametoque.com`;

  return { subject, html, text };
}
