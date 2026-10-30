import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderDetailRows, renderButton, renderMuted } from "../components";
import { formatLkr } from "../utils";

export interface SubscriptionAlertEmailData {
  type: "renewal_reminder" | "payment_failed";
  planName: string;
  amount: number | string;
  date: string;
  updateUrl: string;
  firstName?: string;
}

export function buildSubscriptionAlertEmail({
  type,
  planName,
  amount,
  date,
  updateUrl,
  firstName,
}: SubscriptionAlertEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatLkr(amount);
  const isFailed = type === "payment_failed";

  const subject = isFailed
    ? `Payment failed for your ${planName} subscription`
    : `Upcoming renewal for your ${planName} plan`;

  const preheader = isFailed
    ? "Please update your payment method to keep your plan active."
    : `Your plan renews on ${date} for ${formattedAmount}.`;

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";

  const description = isFailed
    ? `We were unable to charge ${formattedAmount} for your ${planName} subscription renewal on ${date}. Please update your payment method so your account stays active without interruption.`
    : `Your ${planName} plan is scheduled to renew on ${date} for ${formattedAmount}. If your payment details are up to date, no action is needed.`;

  const rows = [
    { label: "Plan", value: planName },
    { label: isFailed ? "Amount due" : "Renewal amount", value: formattedAmount, isBold: true },
    { label: isFailed ? "Attempted on" : "Renewal date", value: date },
  ];

  const buttonText = isFailed ? "Update payment method" : "Review billing settings";

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph(description)}
    ${renderDetailRows(rows)}
    ${renderButton(buttonText, updateUrl)}
    ${isFailed ? renderMuted("If you already updated your payment details or made a transfer, you can ignore this email.") : ""}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const text = `Framebooks

${greeting}

${description}

Plan: ${planName}
${isFailed ? "Amount due" : "Renewal amount"}: ${formattedAmount}
${isFailed ? "Attempted on" : "Renewal date"}: ${date}

${buttonText}: ${updateUrl}

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? info@frametoque.com`;

  return { subject, html, text };
}
