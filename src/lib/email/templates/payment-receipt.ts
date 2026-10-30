import { wrapInEmailLayout } from "../layout";
import { renderParagraph, renderDetailRows, renderButton } from "../components";
import { formatLkr } from "../utils";

export interface PaymentReceiptEmailData {
  amount: number | string;
  planName: string;
  activeUntilDate: string;
  referenceId?: string;
  receiptUrl?: string;
  firstName?: string;
}

export function buildPaymentReceiptEmail({
  amount,
  planName,
  activeUntilDate,
  referenceId,
  receiptUrl,
  firstName,
}: PaymentReceiptEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const formattedAmount = formatLkr(amount);
  const subject = `Payment received: ${formattedAmount}`;
  const preheader = `Your ${planName} plan is active until ${activeUntilDate}.`;

  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : "Hi,";

  const rows = [
    { label: "Plan", value: planName },
    { label: "Amount", value: formattedAmount, isBold: true },
    { label: "Valid until", value: activeUntilDate },
  ];

  if (referenceId) {
    rows.push({ label: "Reference", value: referenceId });
  }

  const receiptButton = receiptUrl ? renderButton("Download receipt", receiptUrl) : "";

  const contentHtml = `
    ${renderParagraph(greeting)}
    ${renderParagraph(`Thanks for your payment. Your ${planName} plan is active until ${activeUntilDate}.`)}
    ${renderDetailRows(rows)}
    ${receiptButton}
    ${renderParagraph("You can also view all billing history anytime from Settings.")}
    ${renderParagraph("Framebooks", true)}
  `;

  const html = wrapInEmailLayout({
    preheader,
    contentHtml,
  });

  const receiptLine = receiptUrl ? `\nView your receipt: ${receiptUrl}\n` : "";

  const text = `Framebooks

${greeting}

Thanks for your payment. Your ${planName} plan is active until ${activeUntilDate}.

Plan: ${planName}
Amount: ${formattedAmount}
Valid until: ${activeUntilDate}
${referenceId ? `Reference: ${referenceId}\n` : ""}${receiptLine}
You can also view all billing history anytime from Settings.

Framebooks
--
Sent by Framebooks, a product of FrameToque Digital.
Need help? framebooks@frametoque.com`;

  return { subject, html, text };
}
