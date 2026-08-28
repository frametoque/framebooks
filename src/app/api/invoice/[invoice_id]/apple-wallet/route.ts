import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import {  auth, clerkClient  } from '@/lib/auth';
import sql from "@/lib/db";
import * as forge from "node-forge";
import fs from "fs";
import path from "path";

/* ─── Env vars ─── */
const PASS_TYPE_ID = (process.env.APPLE_PASS_TYPE_ID          ?? "").trim();
const TEAM_ID      = (process.env.APPLE_TEAM_ID               ?? "").trim();
// Strip any stray URL-encoding chars (e.g. trailing %) that appear when pasting base64
const CERT_B64     = (process.env.APPLE_CERT_P12_BASE64       ?? "").trim().replace(/%$/g, "");
const CERT_PASS    = (process.env.APPLE_CERT_P12_PASSWORD      ?? "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL          ?? "").trim();

/* ─── Helpers ─── */
const formatDate = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

const formatMoney = (value: any, currency = "LKR"): string => {
  const prefix = currency === "LKR" ? "Rs." : currency;
  const num = parseFloat(value ?? 0);
  if (isNaN(num)) return "N/A";
  return `${prefix} ${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const capitalize = (s: string): string => {
  if (!s) return s;
  return s
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Extract PEM-encoded cert and private key from a PKCS#12 buffer.
 * passkit-generator requires them as separate PEM strings.
 */
function extractFromP12(
  p12Buffer: Buffer,
  passphrase: string
): { certPem: string; keyPem: string } {
  const p12Asn1  = forge.asn1.fromDer(
    forge.util.createBuffer(p12Buffer.toString("binary"))
  );
  const p12      = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag  = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("No certificate found in P12 file");
  const certPem  = forge.pki.certificateToPem(certBag.cert);

  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag   = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("No private key found in P12 file");
  const keyPem   = forge.pki.privateKeyToPem(keyBag.key);

  return { certPem, keyPem };
}

/** Convert DER-encoded cert Buffer to PEM string (Apple WWDR is served as DER). */
function derToPem(derBuffer: Buffer): string {
  const b64  = derBuffer.toString("base64");
  const body = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

/* ─── POST /api/invoice/[invoice_id]/apple-wallet ─── */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoice_id: string }> }
) {
  /* 0. Guard: env vars must be configured */
  const isEmptyOrPlaceholder = (v: string) =>
    !v || v.startsWith("YOUR_") || v.startsWith("PASTE_");
  const isBadCert = (v: string) => isEmptyOrPlaceholder(v) || v.length < 100;

  if (isEmptyOrPlaceholder(PASS_TYPE_ID) || isEmptyOrPlaceholder(TEAM_ID) || isBadCert(CERT_B64)) {
    console.warn("[apple-wallet] Missing or placeholder Apple Wallet env vars", {
      hasPassTypeId: !!PASS_TYPE_ID,
      hasTeamId:     !!TEAM_ID,
      certLength:    CERT_B64.length,
    });
    return NextResponse.json(
      {
        error:
          "Apple Wallet certificates are not yet configured. " +
          "Please complete the setup in .env.local.",
      },
      { status: 503 }
    );
  }

  /* 1. Authenticate via Clerk (same request context — no cookie forwarding needed) */
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized — please sign in" }, { status: 401 });
  }
  const clerk    = await clerkClient();
  const user     = await clerk.users.getUser(userId);
  const userEmail = user.emailAddresses[0]?.emailAddress;
  if (!userEmail) {
    return NextResponse.json({ error: "User email not found" }, { status: 400 });
  }

  try {
    const { invoice_id } = await params;

    /* 2. Fetch invoice from DB (owns-check included) */
     const result = await sql`
      SELECT
        i.invoice_id,
        i.project_name,
        i.date,
        i.currency,
        i.subtotal,
        i.discount,
        i.total,
        i.advance,
        i.total_due,
        
        i.payment_status
       FROM public.invoices i
       WHERE i.invoice_id = ${invoice_id} AND LOWER(i.user_email) = LOWER(${userEmail})
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }
    const invoice = result[0] as any;

    /* 3. Financial calculations */
    const paymentsResult = await sql`
      SELECT amount, description FROM public.admin_incomes WHERE invoice_id = ${invoice_id}
    `;
    const nonAdvancePayments = paymentsResult
      .filter((p: any) => !String(p.description || '').toLowerCase().startsWith('advance'))
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    const subtotal = parseFloat(invoice.subtotal ?? 0);
    const discount = parseFloat(invoice.discount ?? 0);
    const advance  = parseFloat(invoice.advance  ?? 0);
    const total    = parseFloat(invoice.total    ?? subtotal - discount);
    const totalDue = invoice.total_due !== undefined && invoice.total_due !== null
      ? parseFloat(invoice.total_due)
      : Math.max(0, total - advance - nonAdvancePayments);
    const currency = invoice.currency ?? "LKR";

    /* 4. Parse P12 → extract PEM cert + PEM key */
    const p12Buffer           = Buffer.from(CERT_B64, "base64");
    const { certPem, keyPem } = extractFromP12(p12Buffer, CERT_PASS);
    console.log("[apple-wallet] P12 parsed successfully");

    /* 5. Load logo images + Apple WWDR cert from local filesystem */
    const logoPath = path.join(process.cwd(), "public/logos/ft/logo-main.png");
    const iconPath = path.join(process.cwd(), "public/logos/ft/logo.png");
    const wwdrPath = path.join(process.cwd(), "public/certs/AppleWWDRCAG4.cer");

    if (!fs.existsSync(logoPath) || !fs.existsSync(iconPath)) {
      throw new Error("Failed to find FrameBookss logo assets on local filesystem");
    }
    if (!fs.existsSync(wwdrPath)) {
      throw new Error("Failed to find Apple WWDR certificate on local filesystem");
    }

    const logoBuffer = fs.readFileSync(logoPath);
    const iconBuffer = fs.readFileSync(iconPath);
    const wwdrDer   = fs.readFileSync(wwdrPath);

    const wwdrPem = derToPem(wwdrDer);

    /* 6. Build PKPass */
    const pass = new PKPass(
      {
        "icon.png":    Buffer.from(iconBuffer),
        "icon@2x.png": Buffer.from(iconBuffer),
        "logo.png":    Buffer.from(logoBuffer),
        "logo@2x.png": Buffer.from(logoBuffer),
      },
      {
        wwdr:                wwdrPem,
        signerCert:          certPem,
        signerKey:           keyPem,
        signerKeyPassphrase: CERT_PASS,
      },
      {
        formatVersion:      1 as const,
        passTypeIdentifier: PASS_TYPE_ID,
        serialNumber:       invoice_id,
        teamIdentifier:     TEAM_ID,
        organizationName:   "FrameBookss",
        description:        `Invoice ${invoice_id} – ${invoice.project_name ?? ""}`,
        backgroundColor:    "rgb(0, 0, 0)",
        foregroundColor:    "rgb(255, 255, 255)",
        labelColor:         "rgb(110, 197, 244)",
        logoText:           "FrameBookss",
      }
    );

    /* 7. Pass type + barcode */
    pass.type = "generic";
    pass.setBarcodes({
      message:         `${APP_URL}/dashboard/invoice/${invoice_id}`,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         invoice_id,
    });

    /* 8. Fields */
    pass.headerFields.push({
      key:           "total_due",
      label:         "TOTAL DUE",
      value:         formatMoney(totalDue, currency),
      textAlignment: "PKTextAlignmentRight",
    });

    // Moved project name to secondaryFields so it uses a smaller font size and doesn't get aggressively truncated with giant text
    pass.secondaryFields.push({
      key:   "project",
      label: "PROJECT",
      value: invoice.project_name ?? "Invoice",
    });

    pass.secondaryFields.push(
      { key: "invoice_id", label: "INVOICE", value: invoice_id }
    );

    pass.auxiliaryFields.push(
      { key: "date",       label: "DATE",    value: formatDate(invoice.date) },
      {
        key:   "work_status",
        label: "PROJECT STATUS",
        value: capitalize(invoice.work_status ?? "pending"),
      },
      {
        key:   "payment_status",
        label: "PAYMENT",
        value: capitalize(invoice.payment_status ?? "unpaid"),
      },
      {
        key:   "total",
        label: "TOTAL",
        value: formatMoney(total, currency),
      }
    );

    const backLines = [
      `Invoice ID: ${invoice_id}`,
      `Project: ${invoice.project_name ?? "—"}`,
      `Date: ${formatDate(invoice.date)}`,
      `Subtotal: ${formatMoney(subtotal, currency)}`,
      ...(discount > 0 ? [`Discount: −${formatMoney(discount, currency)}`] : []),
      `Total: ${formatMoney(total, currency)}`,
      ...(advance > 0 ? [`Advance Paid: −${formatMoney(advance, currency)}`] : []),
      `Total Due: ${formatMoney(totalDue, currency)}`,
      
      `Payment Status: ${invoice.payment_status ?? "unpaid"}`,
    ];

    pass.backFields.push(
      { key: "details",    label: "Invoice Details",    value: backLines.join("\n") },
      {
        key:             "view_online",
        label:           "View Invoice Online",
        value:           `${APP_URL}/dashboard/invoice/${invoice_id}`,
        attributedValue: `<a href='${APP_URL}/dashboard/invoice/${invoice_id}'>Open in FrameBookss</a>`,
      },
      { key: "powered_by", label: "", value: "Powered by FrameBookss" }
    );

    /* 9. Export */
    const passBuffer = pass.getAsBuffer();
    console.log("[apple-wallet] Pass generated, size:", passBuffer.length, "bytes");

    return new NextResponse(passBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${invoice_id}.pkpass"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[apple-wallet] Error:", err?.message ?? err);
    return NextResponse.json(
      { error: "Failed to generate Apple Wallet pass", detail: err?.message },
      { status: 500 }
    );
  }
}
