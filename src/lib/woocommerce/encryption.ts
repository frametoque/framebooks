import crypto from "crypto";

const DEFAULT_DEV_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
export const WOO_KEY_VERSION = "v1";

/**
 * Retrieves the 256-bit master key for integration credential encryption.
 * Reads INTEGRATION_ENCRYPTION_KEY, with fallback to APP_MASTER_KEY or stable dev key.
 */
function getIntegrationMasterKey(): Buffer {
  const envKey = process.env.INTEGRATION_ENCRYPTION_KEY?.trim() || process.env.APP_MASTER_KEY?.trim();
  if (process.env.NODE_ENV === "production" && (!envKey || envKey === DEFAULT_DEV_KEY)) {
    throw new Error(
      "Critical Security Configuration: INTEGRATION_ENCRYPTION_KEY must be configured with a 32-byte hex secret in production."
    );
  }
  const keyToUse = envKey || DEFAULT_DEV_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(keyToUse)) {
    return Buffer.from(keyToUse, "hex");
  }
  return crypto.createHash("sha256").update(keyToUse).digest();
}

/**
 * Derives a dedicated 256-bit Tenant Key using HKDF-SHA256.
 * Cryptographically isolates Tenant A's integration keys from Tenant B.
 */
function getTenantIntegrationKey(tenantId: string | number): Buffer {
  const salt = Buffer.from(`woocommerce-tenant-${tenantId}`);
  const info = Buffer.from(`framebooks-woo-dek-${WOO_KEY_VERSION}-${tenantId}`);
  return Buffer.from(crypto.hkdfSync("sha256", getIntegrationMasterKey(), salt, info, 32));
}

/**
 * Encrypts a sensitive credential (consumer_key, consumer_secret) with AES-256-GCM.
 * Each encryption generates a fresh, cryptographically secure 96-bit random IV.
 * Format: `v1:<iv-hex>:<ciphertext-hex>:<authTag-hex>`
 */
export function encryptWooCredential(plaintext: string, tenantId: string | number): string {
  if (!plaintext || typeof plaintext !== "string") return "";

  const cleanText = plaintext.trim();
  const key = getTenantIntegrationKey(tenantId);
  const iv = crypto.randomBytes(12); // 96-bit random IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  // Authenticated Additional Data (AAD) cryptographically bound to this tenant
  const aad = Buffer.from(`tenant:${tenantId}|type:woocommerce_credential|ver:${WOO_KEY_VERSION}`, "utf8");
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([cipher.update(cleanText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${WOO_KEY_VERSION}:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Decrypts a stored credential for internal sync engine use ONLY.
 * NEVER exposed to client APIs, logs, or error reports.
 */
export function decryptWooCredential(ciphertext: string, tenantId: string | number): string {
  if (!ciphertext || typeof ciphertext !== "string") return "";

  const parts = ciphertext.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext structure for WooCommerce credential.");
  }

  const [version, ivHex, encryptedHex, tagHex] = parts;
  if (version !== WOO_KEY_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const key = getTenantIntegrationKey(tenantId);
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  const aad = Buffer.from(`tenant:${tenantId}|type:woocommerce_credential|ver:${WOO_KEY_VERSION}`, "utf8");
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Failed to decrypt WooCommerce credential: authentication tag mismatch or corrupted data.");
  }
}

/**
 * Generates a high-entropy random webhook secret for a tenant.
 */
export function generateTenantWebhookSecret(): string {
  return `fb_wh_${crypto.randomBytes(24).toString("hex")}`;
}

/**
 * Verifies the WooCommerce webhook HMAC-SHA256 signature against the raw request body.
 */
export function verifyWooWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  const expectedHmac = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("base64");

  const expectedBuf = Buffer.from(expectedHmac, "utf8");
  const providedBuf = Buffer.from(signatureHeader.trim(), "utf8");

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Masks sensitive keys for client-side display without exposing secrets.
 * Example: ck_9a8b7c6d5e4f -> ck_••••4e4f
 */
export function maskWooKey(key: string | null | undefined): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";

  const prefix = trimmed.startsWith("ck_") ? "ck_" : trimmed.startsWith("cs_") ? "cs_" : "";
  const suffix = trimmed.slice(-4);
  return `${prefix}••••${suffix}`;
}
