import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderButton } from "../components";

export interface WelcomeEmailData {
  firstName?: string;
  loginUrl?: string;
  verificationUrl?: string;
}

export function buildWelcomeEmail({
  firstName,
  loginUrl = "https://books.frametoque.com/login",
  verificationUrl,
}: WelcomeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Welcome to Framebooks";
  const preheader = "Your accounting workspace is ready.";

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";

  const actionButton = verificationUrl
    ? renderButton("Verify your email", verificationUrl)
    : renderButton("Open your dashboard", loginUrl);

  const actionText = verificationUrl
    ? "Please verify your email address to complete your setup:"
    : "Your workspace is ready. You can start creating invoices, tracking expenses, and managing clients right away:";

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph(actionText)}
    ${actionButton}
    ${renderParagraph("If you need anything or have feedback, just reply to this email.")}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const primaryUrl = verificationUrl || loginUrl;

  const text = `Framebooks

${greeting}

${actionText}
${primaryUrl}

If you need anything or have feedback, just reply to this email.

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? framebooks@frametoque.com`;

  return { subject, html, text };
}
