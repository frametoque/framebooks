import nodemailer from "nodemailer";
import { buildVerificationCodeEmail, VerificationCodeEmailData } from "./templates/verification-code";
import { buildWelcomeEmail, WelcomeEmailData } from "./templates/welcome";
import { buildPasswordResetEmail, PasswordResetEmailData } from "./templates/password-reset";
import { buildTeamInviteEmail, TeamInviteEmailData } from "./templates/team-invite";
import { buildPaymentReceiptEmail, PaymentReceiptEmailData } from "./templates/payment-receipt";
import { buildPlanChangeEmail, PlanChangeEmailData } from "./templates/plan-change";
import { buildSubscriptionAlertEmail, SubscriptionAlertEmailData } from "./templates/subscription-alert";
import { buildClientInvoiceEmail, ClientInvoiceEmailData } from "./templates/client-invoice";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  category?: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (host && user && pass) {
    if (host.toLowerCase().includes("gmail")) {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user,
          pass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    }
  }

  return transporter;
}

function getFromAndEnvelope(to: string): { from: string; envelope?: { from: string; to: string } } {
  const user = process.env.SMTP_USER || "framebooks@frametoque.com";
  const rawFrom = process.env.SMTP_FROM || "";

  // Strip extraneous backslashes and surrounding quotes
  const cleanFrom = rawFrom.replace(/\\"/g, '"').replace(/^"|"$/g, "").trim();

  let displayName = "Framebooks";
  let displayEmail = user;

  const match = cleanFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    displayName = match[1].replace(/^"|"$/g, "").trim() || "Framebooks";
    displayEmail = match[2].trim() || user;
  } else if (cleanFrom) {
    displayEmail = cleanFrom;
  }

  const host = (process.env.SMTP_HOST || "").toLowerCase();
  const isGmail = host.includes("gmail");

  return {
    from: `"${displayName}" <${displayEmail}>`,
    envelope: isGmail
      ? {
          from: user,
          to: to,
        }
      : undefined,
  };
}

/**
 * Send an email using the configured SMTP transport.
 * Outputs to server console in non-production environments if SMTP is unavailable.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  category = "transactional",
}: SendEmailOptions): Promise<{ success: boolean; simulated?: boolean }> {
  const mailer = getTransporter();

  if (!mailer) {
    console.log(
      `\n=======================================================\n` +
      `[EMAIL SERVICE - DEV FALLBACK (${category})]\n` +
      `To: ${to}\n` +
      `Subject: ${subject}\n` +
      `Content:\n${text}\n` +
      `=======================================================\n`
    );
    return { success: true, simulated: true };
  }

  try {
    const { from, envelope } = getFromAndEnvelope(to);
    await mailer.sendMail({
      from,
      envelope,
      to,
      subject,
      text,
      html,
      replyTo:
        replyTo ||
        process.env.SMTP_REPLY_TO ||
        "framebooks@frametoque.com",
      headers: {
        "X-Entity-Ref-ID": `${category}-${Date.now()}`,
      },
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[SMTP Error Fallback] Content: ${text}`);
      return { success: true, simulated: true };
    }
    throw error;
  }
}

// -------------------------------------------------------------
// Typed sender helpers for each transactional event
// -------------------------------------------------------------

export async function sendAppLockOtpEmail(
  toEmail: string,
  otpCode: string,
  firstName?: string
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildVerificationCodeEmail({ code: otpCode, firstName });
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "security-verification",
  });
}

export async function sendWelcomeEmail(
  toEmail: string,
  data: WelcomeEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildWelcomeEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "welcome",
  });
}

export async function sendPasswordResetEmail(
  toEmail: string,
  data: PasswordResetEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildPasswordResetEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "password-reset",
  });
}

export async function sendTeamInviteEmail(
  toEmail: string,
  data: TeamInviteEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildTeamInviteEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "team-invite",
  });
}

export async function sendPaymentReceiptEmail(
  toEmail: string,
  data: PaymentReceiptEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildPaymentReceiptEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "payment-receipt",
  });
}

export async function sendPlanChangeEmail(
  toEmail: string,
  data: PlanChangeEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildPlanChangeEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "plan-change",
  });
}

export async function sendSubscriptionAlertEmail(
  toEmail: string,
  data: SubscriptionAlertEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildSubscriptionAlertEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "subscription-alert",
  });
}

export async function sendClientInvoiceEmail(
  toEmail: string,
  data: ClientInvoiceEmailData
): Promise<{ success: boolean; simulated?: boolean }> {
  const { subject, html, text } = buildClientInvoiceEmail(data);
  return sendEmail({
    to: toEmail,
    subject,
    html,
    text,
    category: "client-invoice",
  });
}

// Re-export template builders for preview and direct rendering
export {
  buildVerificationCodeEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildTeamInviteEmail,
  buildPaymentReceiptEmail,
  buildPlanChangeEmail,
  buildSubscriptionAlertEmail,
  buildClientInvoiceEmail,
};
