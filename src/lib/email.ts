import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
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
  const user = process.env.SMTP_USER || "noreply@framebooks.io";
  const rawFrom = process.env.SMTP_FROM || "";

  // Strip extraneous backslashes and quotes
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
 * Send an email using configured SMTP transport.
 * Falls back to logging to server console in development if SMTP is unconfigured.
 */
export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<{ success: boolean; simulated?: boolean }> {
  const mailer = getTransporter();

  if (!mailer) {
    // In development or if SMTP is not configured, log to server console
    console.log(
      `\n=======================================================\n` +
      `[EMAIL SERVICE - DEV FALLBACK]\n` +
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
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    // In non-production, log to console as fallback so flows don't completely lock out
    if (process.env.NODE_ENV !== "production") {
      console.log(`[SMTP Error Fallback] Content: ${text}`);
      return { success: true, simulated: true };
    }
    throw error;
  }
}

/**
 * Send App Lock recovery OTP email with high-contrast, modern security template.
 */
export async function sendAppLockOtpEmail(toEmail: string, otpCode: string): Promise<{ success: boolean; simulated?: boolean }> {
  const subject = `Your Framebooks Verification Code: ${otpCode}`;
  
  const text = `Your Framebooks verification code is: ${otpCode}\n\n` +
    `Use this one-time code to verify your identity and unlock your Framebooks dashboard.\n` +
    `This code will expire in 10 minutes.\n\n` +
    `If you did not request this verification code, someone may be attempting to access your account. Please change your password and review your security settings immediately.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Framebooks Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #041418; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #041418; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #071E22; border: 1px solid rgba(255,255,255,0.1); border-radius: 24px; padding: 40px 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
          
          <!-- Logo & Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: rgba(0,227,91,0.1); border: 1px solid rgba(0,227,91,0.25); border-radius: 16px; padding: 10px 18px;">
                <span style="font-size: 18px; font-weight: 800; color: #00E35B; letter-spacing: -0.5px;">Framebooks</span>
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #FFFFFF;">Security Verification Code</h1>
            </td>
          </tr>

          <!-- Description -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #94A3B8;">
                You requested to unlock your account or disable App Lock. Enter the verification code below to proceed:
              </p>
            </td>
          </tr>

          <!-- OTP Code Box -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <div style="background-color: rgba(0,0,0,0.3); border: 2px dashed rgba(0,227,91,0.4); border-radius: 16px; padding: 20px 32px; display: inline-block;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #00E35B; font-family: monospace;">${otpCode}</span>
              </div>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <p style="margin: 0; font-size: 13px; color: #64748B;">
                This code will expire in <strong style="color: #E2E8F0;">10 minutes</strong> and can only be used once.
              </p>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 24px;">
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #94A3B8;">
                <strong style="color: #F87171;">Didn't request this?</strong> If you did not initiate this request, someone may be attempting to access your device. Please sign out immediately and change your account credentials.
              </p>
            </td>
          </tr>

        </table>
        
        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; padding-top: 20px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} Framebooks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendEmail({
    to: toEmail,
    subject,
    text,
    html,
  });
}
