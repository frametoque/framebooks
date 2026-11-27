import { NextRequest, NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createSign } from "crypto";
import sql from "@/lib/db";
import { getUserContext } from "@/app/(dashboard)/user/actions/rbac";

const ISSUER_ID    = (process.env.GOOGLE_WALLET_ISSUER_ID    ?? "").trim();
const CLIENT_EMAIL = (process.env.GOOGLE_WALLET_CLIENT_EMAIL ?? "").trim();
const PRIVATE_KEY  = (process.env.GOOGLE_WALLET_PRIVATE_KEY  ?? "").trim().replace(/\\n/g, "\n");
const APP_URL      = (process.env.NEXT_PUBLIC_APP_URL         ?? "https://app.framebooks.com").trim();
const ASSET_URL    = (process.env.WALLET_ASSET_BASE_URL ?? APP_URL).trim();

const CLASS_SUFFIX = "pos_admin_pass_v2";
const CLASS_ID     = `${ISSUER_ID}.${CLASS_SUFFIX}`;

/* ── Auth client for Google Wallet API ── */
function getAuthClient() {
  return new GoogleAuth({
    credentials: {
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    },
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
}

/* ── Sign a JWT using Node crypto (PKCS8 RSA-SHA256) ── */
function signJwt(payload: object): string {
  const header    = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body      = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsigned  = `${header}.${body}`;
  const signer    = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(PRIVATE_KEY, "base64url");
  return `${unsigned}.${signature}`;
}

/* ── Ensure Generic Pass Class exists ── */
async function ensureClass(authClient: GoogleAuth) {
  const accessToken = await authClient.getAccessToken();

  const checkRes = await fetch(
    `https://walletobjects.googleapis.com/walletobjects/v1/genericClass/${CLASS_ID}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (checkRes.status === 404) {
    const createRes = await fetch(
      "https://walletobjects.googleapis.com/walletobjects/v1/genericClass",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: CLASS_ID,
          issuerName: "Framebooks",
          reviewStatus: "UNDER_REVIEW",
          logo: {
            sourceUri: {
              uri: `${ASSET_URL}/logos/ft/logo.png`,
            },
            contentDescription: {
              defaultValue: { language: "en-US", value: "Framebooks Logo" },
            },
          },
          classTemplateInfo: {
            cardTemplateOverride: {
              cardRowTemplateInfos: [
                {
                  twoItems: {
                    startItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['admin_name']" }],
                      },
                    },
                    endItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['role']" }],
                      },
                    },
                  },
                },
                {
                  twoItems: {
                    startItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['business_name']" }],
                      },
                    },
                    endItem: {
                      firstValue: {
                        fields: [{ fieldPath: "object.textModulesData['admin_email']" }],
                      },
                    },
                  },
                },
              ],
            },
          },
        }),
      }
    );

    if (!createRes.ok) {
      const createBody = await createRes.json();
      console.warn("[google-wallet] Class creation response:", createBody);
    }
  }
}

/* ── Build Generic Pass Object ── */
function buildPassObject({
  member,
  tenant,
  code,
}: {
  member: { id: number; full_name?: string | null; email: string; role: string };
  tenant: { id: number; name?: string | null; logo_url?: string | null };
  code: string;
}) {
  const objectId = `${ISSUER_ID}.pos_admin_${tenant.id}_${member.id}`;
  const adminName = member.full_name?.trim() || member.email;
  const businessName = tenant.name?.trim() || "Framebooks POS";
  const roleName = (member.role || "Admin").toUpperCase();

  return {
    id: objectId,
    classId: CLASS_ID,
    state: "ACTIVE",

    cardTitle: {
      defaultValue: { language: "en-US", value: "Framebooks POS" },
    },
    subheader: {
      defaultValue: { language: "en-US", value: businessName },
    },
    header: {
      defaultValue: {
        language: "en-US",
        value: `${roleName} ACCESS`,
      },
    },

    hexBackgroundColor: "#0B0F17",

    heroImage: {
      sourceUri: {
        uri: `${ASSET_URL}/og-image.png`,
      },
      contentDescription: {
        defaultValue: { language: "en-US", value: "Framebooks POS Access Pass" },
      },
    },

    barcode: {
      type: "QR_CODE",
      value: `POS_MGR:${code}`,
      alternateText: "POS Access Pass",
    },

    textModulesData: [
      {
        id: "admin_name",
        header: "ADMINISTRATOR",
        body: adminName,
      },
      {
        id: "role",
        header: "AUTHORIZATION",
        body: roleName,
      },
      {
        id: "business_name",
        header: "BUSINESS",
        body: businessName,
      },
      {
        id: "admin_email",
        header: "EMAIL",
        body: member.email,
      },
      {
        id: "usage_instructions",
        header: "HOW TO USE",
        body: "Present this QR code to the POS terminal camera to authorize manager actions and special discounts.",
      },
    ],
  };
}

/* ── POST /api/pos/pass/google-wallet ── */
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

    // Check caller permission: must be Owner/Super Admin/Admin or the member themselves
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
    if (!ISSUER_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Google Wallet credentials are not configured on the server." },
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

    // Initialize Auth & Ensure Class
    const authClient = getAuthClient();
    try {
      await ensureClass(authClient);
    } catch (classErr) {
      console.warn("[google-wallet] Class ensure error (proceeding with pass object):", classErr);
    }

    // Build pass object
    const passObject = buildPassObject({ member, tenant, code });

    // Sign JWT
    const claims = {
      iss: CLIENT_EMAIL,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      payload: {
        genericObjects: [passObject],
      },
    };

    const token = signJwt(claims);
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    return NextResponse.json({ success: true, saveUrl });
  } catch (err: any) {
    console.error("[google-wallet] Error generating pass:", err?.message ?? err);
    return NextResponse.json(
      { error: "Failed to generate Google Wallet pass", detail: err?.message },
      { status: 500 }
    );
  }
}
