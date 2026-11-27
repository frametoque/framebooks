import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import * as forge from "node-forge";
import fs from "fs";
import path from "path";
import sql from "@/lib/db";
import { getUserContext } from "@/app/(dashboard)/user/actions/rbac";

/* ─── Env vars ─── */
const PASS_TYPE_ID = (process.env.APPLE_PASS_TYPE_ID     ?? "").trim();
const TEAM_ID      = (process.env.APPLE_TEAM_ID          ?? "").trim();
const CERT_B64     = (process.env.APPLE_CERT_P12_BASE64  ?? "").trim().replace(/%$/g, "");
const CERT_PASS    = (process.env.APPLE_CERT_P12_PASSWORD ?? "").trim();
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL     ?? "https://app.framebooks.com").trim();

/**
 * Extract PEM-encoded cert and private key from a PKCS#12 buffer.
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
  if (!certBag?.cert) throw new Error("No certificate found in Apple P12 file");
  const certPem  = forge.pki.certificateToPem(certBag.cert);

  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag   = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("No private key found in Apple P12 file");
  const keyPem   = forge.pki.privateKeyToPem(keyBag.key);

  return { certPem, keyPem };
}

/** Convert DER-encoded cert Buffer to PEM string */
function derToPem(derBuffer: Buffer): string {
  const b64  = derBuffer.toString("base64");
  const body = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;
}

/* ─── POST /api/pos/pass/apple-wallet ─── */
export async function POST(req: NextRequest) {
  try {
    const context = await getUserContext();
    if (!context.userId || !context.tenantId) {
      return NextResponse.json({ error: "Unauthorized session." }, { status: 401 });
    }

    const tenantId = Number(context.tenantId);
    const body = await req.json().catch(() => ({}));
    const memberId = Number(body.memberId);

    if (!memberId) {
      return NextResponse.json({ error: "Missing memberId parameter." }, { status: 400 });
    }

    // Check caller permission
    const currentRole = (context.role || "").toLowerCase();
    const isAuthorized =
      currentRole === "owner" ||
      currentRole === "super admin" ||
      currentRole === "admin" ||
      Number(context.userId) === memberId;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You cannot generate a wallet pass for this user." },
        { status: 403 }
      );
    }

    // Guard: env vars must be configured
    if (!PASS_TYPE_ID || !TEAM_ID || !CERT_B64 || CERT_B64.length < 50) {
      return NextResponse.json(
        { error: "Apple Wallet certificates are not yet configured on the server." },
        { status: 503 }
      );
    }

    // Fetch member and tenant
    const [memberRows, tenantRows] = await Promise.all([
      sql`
        SELECT id, full_name, email, role, pos_manager_code
        FROM admin_users
        WHERE id = ${memberId} AND tenant_id = ${tenantId} AND deleted_at IS NULL
        LIMIT 1
      `,
      sql`
        SELECT id, name, logo_url
        FROM tenants
        WHERE id = ${tenantId}
        LIMIT 1
      `,
    ]);

    if (!memberRows || memberRows.length === 0) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    const member = memberRows[0] as any;
    const tenant = (tenantRows && tenantRows[0]) ? tenantRows[0] as any : { id: tenantId, name: "Framebooks POS" };
    const code = (body.code || member.pos_manager_code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "No POS passcode has been configured for this member yet." },
        { status: 400 }
      );
    }

    const adminName = member.full_name?.trim() || member.email;
    const businessName = tenant.name?.trim() || "Framebooks POS";
    const roleName = (member.role || "Admin").toUpperCase();

    // Parse P12
    const p12Buffer = Buffer.from(CERT_B64, "base64");
    const { certPem, keyPem } = extractFromP12(p12Buffer, CERT_PASS);

    // Load logo images + WWDR cert (using no-bg transparent logo)
    const logoPath = path.join(process.cwd(), "public/logos/ft/logo.png");
    const iconPath = path.join(process.cwd(), "public/logos/ft/logo.png");
    const wwdrPath = path.join(process.cwd(), "public/certs/AppleWWDRCAG4.cer");

    if (!fs.existsSync(logoPath) || !fs.existsSync(iconPath)) {
      throw new Error("Missing Framebooks logo assets in public directory.");
    }
    if (!fs.existsSync(wwdrPath)) {
      throw new Error("Missing Apple WWDR certificate in public/certs.");
    }

    const logoBuffer = fs.readFileSync(logoPath);
    const iconBuffer = fs.readFileSync(iconPath);
    const wwdrDer    = fs.readFileSync(wwdrPath);
    const wwdrPem    = derToPem(wwdrDer);

    // Build PKPass with minimalist, elegant obsidian dark styling and Framebooks emerald green accent
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
        serialNumber:       `pos-auth-${tenantId}-${member.id}`,
        teamIdentifier:     TEAM_ID,
        organizationName:   "Framebooks",
        description:        `Framebooks POS Authorization – ${adminName}`,
        backgroundColor:    "rgb(11, 15, 23)",
        foregroundColor:    "rgb(255, 255, 255)",
        labelColor:         "rgb(0, 227, 91)",
        logoText:           "Framebooks",
      }
    );

    pass.type = "generic";
    pass.setBarcodes({
      message:         `POS_MGR:${code}`,
      format:          "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText:         "POS Access Pass",
    });

    // Pass Fields
    pass.headerFields.push({
      key:           "role",
      label:         "AUTHORIZATION",
      value:         roleName,
      textAlignment: "PKTextAlignmentRight",
    });

    pass.primaryFields.push({
      key:   "admin_name",
      label: "ADMINISTRATOR",
      value: adminName,
    });

    pass.secondaryFields.push(
      {
        key:   "business",
        label: "BUSINESS",
        value: businessName,
      },
      {
        key:   "email",
        label: "EMAIL",
        value: member.email,
      }
    );

    const backLines = [
      `Administrator: ${adminName}`,
      `Email: ${member.email}`,
      `Role: ${roleName}`,
      `Business: ${businessName}`,
      "",
      "--- How to Use ---",
      "Hold this QR code up to the POS terminal camera whenever a transaction requires manager authorization (e.g. high-value discounts, voids, or special promotional offers).",
      "",
      "--- Security Notice ---",
      "This pass grants administrative privileges at point-of-sale registers. Keep this pass strictly confidential.",
    ];

    pass.backFields.push(
      {
        key:   "pass_details",
        label: "POS Authorization Details",
        value: backLines.join("\n"),
      },
      {
        key:             "portal_link",
        label:           "Framebooks Portal",
        value:           `${APP_URL}/dashboard/settings/team`,
        attributedValue: `<a href='${APP_URL}/dashboard/settings/team'>Open Team Settings</a>`,
      },
      {
        key:   "powered_by",
        label: "",
        value: "Framebooks Point of Sale",
      }
    );

    const passBuffer = pass.getAsBuffer();

    return new NextResponse(passBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":        "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="framebooks-pos-pass-${member.id}.pkpass"`,
        "Cache-Control":       "no-store",
      },
    });
  } catch (err: any) {
    console.error("[apple-wallet] Error generating pass:", err?.message ?? err);
    return NextResponse.json(
      { error: "Failed to generate Apple Wallet pass", detail: err?.message },
      { status: 500 }
    );
  }
}
