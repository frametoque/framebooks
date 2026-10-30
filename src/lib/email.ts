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
  <style>
    @media (prefers-color-scheme: dark) {
      .email-bg { background-color: #090D11 !important; }
      .email-card { background-color: #121820 !important; border-color: rgba(255, 255, 255, 0.1) !important; }
      .email-title { color: #FFFFFF !important; }
      .email-desc { color: #94A3B8 !important; }
      .otp-box { background-color: rgba(0, 227, 91, 0.08) !important; border-color: rgba(0, 227, 91, 0.4) !important; }
      .otp-code { color: #00E35B !important; }
      .expiry-text { color: #94A3B8 !important; }
      .expiry-bold { color: #F1F5F9 !important; }
      .warning-box { border-color: rgba(255, 255, 255, 0.08) !important; }
      .warning-text { color: #94A3B8 !important; }
      .footer-text { color: #64748B !important; }
    }
  </style>
</head>
<body class="email-bg" style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
  <table class="email-bg" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 48px 20px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table class="email-card" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 24px; padding: 40px 32px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.06);">
          
          <!-- Logo & Brand Header -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div style="display: inline-block; background-color: #E6FDF0; border: 1px solid #BFFCDF; border-radius: 14px; padding: 8px 18px;">
                <span style="font-size: 16px; font-weight: 800; color: #008736; letter-spacing: -0.3px;">Framebooks</span>
              </div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <h1 class="email-title" style="margin: 0; font-size: 22px; font-weight: 700; color: #0F172A; letter-spacing: -0.3px;">Security Verification Code</h1>
            </td>
          </tr>

          <!-- Description -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <p class="email-desc" style="margin: 0; font-size: 14px; line-height: 22px; color: #475569; max-width: 360px;">
                You requested to unlock your account or disable App Lock. Enter the verification code below to proceed:
              </p>
            </td>
          </tr>

          <!-- OTP Code Box -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <div class="otp-box" style="background-color: #F0FDF4; border: 2px dashed #00E35B; border-radius: 16px; padding: 18px 32px; display: inline-block;">
                <span class="otp-code" style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #007A31; font-family: 'SF Mono', Consolas, Monaco, monospace; display: block;">${otpCode}</span>
              </div>
            </td>
          </tr>

          <!-- Expiry Notice -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <p class="expiry-text" style="margin: 0; font-size: 13px; color: #64748B;">
                This code will expire in <strong class="expiry-bold" style="color: #0F172A;">10 minutes</strong> and can only be used once.
              </p>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td class="warning-box" style="border-top: 1px solid #E2E8F0; padding-top: 22px;">
              <p class="warning-text" style="margin: 0; font-size: 12px; line-height: 18px; color: #64748B;">
                <strong style="color: #DC2626;">Didn't request this?</strong> If you did not initiate this request, someone may be attempting to access your device. Please sign out immediately and change your account credentials.
              </p>
            </td>
          </tr>

        </table>
        
        <!-- Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 480px; padding-top: 24px;">
          <tr>
            <td align="center">
              <p class="footer-text" style="margin: 0; font-size: 12px; color: #94A3B8;">
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
