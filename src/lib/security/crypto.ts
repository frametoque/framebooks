import crypto from "crypto";

export interface CryptoContext {
  tenantId: string | number;
  table: string;
  column: string;
  recordId?: string | number;
}

const DEFAULT_DEV_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CURRENT_KEY_VERSION = "v1";

/**
 * Retrieves the 256-bit master key (KEK) from environment.
 * In development/test, provides a stable fallback if not explicitly configured.
 */
function getMasterKey(): Buffer {
  const envKey = process.env.APP_MASTER_KEY?.trim();
  if (process.env.NODE_ENV === "production" && (!envKey || envKey === DEFAULT_DEV_KEY)) {
    throw new Error("Critical Security Misconfiguration: APP_MASTER_KEY must be configured with a 32-byte hex secret in production.");
  }
  const keyToUse = envKey || DEFAULT_DEV_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(keyToUse)) {
    return Buffer.from(keyToUse, "hex");
  }
  return crypto.createHash("sha256").update(keyToUse).digest();
}

/**
 * Retrieves or derives the blind index key used for exact match lookups.
 */
function getBlindIndexKey(): Buffer {
  const envKey = process.env.BLIND_INDEX_KEY?.trim();
  if (envKey && /^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  // Derive deterministically from Master Key using HKDF
  return Buffer.from(
    crypto.hkdfSync("sha256", getMasterKey(), "framebooks-blind-index-salt", "framebooks-blind-index-key-v1", 32)
  );
}

/**
 * Derives a dedicated 256-bit Data Encryption Key (DEK) isolated per tenant.
 * Uses HKDF-SHA256 to ensure Tenant A's key can never decrypt Tenant B's data.
 */
export function getTenantDek(tenantId: string | number): Buffer {
  const salt = Buffer.from(`tenant-${tenantId}`);
  const info = Buffer.from(`framebooks-dek-v1-${tenantId}`);
  return Buffer.from(crypto.hkdfSync("sha256", getMasterKey(), salt, info, 32));
}

/**
 * Builds canonical Associated Authenticated Data (AAD) for AES-256-GCM.
 * Cryptographically binds ciphertext to the specific tenant, table, column, and record.
 */
function buildAad(context: CryptoContext): Buffer {
  const record = context.recordId !== undefined && context.recordId !== null ? String(context.recordId) : "any";
  const canonical = `tenant:${context.tenantId}|table:${context.table}|col:${context.column}|id:${record}`;
  return Buffer.from(canonical, "utf8");
}

/**
 * Encrypts a sensitive string field using AES-256-GCM with unique random 96-bit nonce.
 *
 * @returns Formatted ciphertext string: `v1:<nonce-hex>:<ciphertext-hex>:<tag-hex>`
 */
export function encryptField(plaintext: string, context: CryptoContext): string {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const rawText = String(plaintext);
  if (!rawText) return rawText;

  const dek = getTenantDek(context.tenantId);
  const iv = crypto.randomBytes(12); // 96-bit nonce
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);

  const aad = buildAad(context);
  cipher.setAAD(aad);

  const encrypted = Buffer.concat([cipher.update(rawText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${CURRENT_KEY_VERSION}:${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Decrypts an encrypted field string with authentication validation.
 * Throws an error if ciphertext was tampered with or if tenant/table context does not match.
 */
export function decryptField(ciphertext: string, context: CryptoContext): string {
  if (!ciphertext || typeof ciphertext !== "string") return ciphertext;

  // Check if string follows standard encrypted format
  if (!ciphertext.startsWith(`${CURRENT_KEY_VERSION}:`)) {
    // Return unchanged if legacy unencrypted plaintext
    return ciphertext;
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid ciphertext payload format.");
  }

  const [, ivHex, encHex, tagHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encHex, "hex");
  const tag = Buffer.from(tagHex, "hex");

  const dek = getTenantDek(context.tenantId);
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);

  const aad = buildAad(context);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);

  try {
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      `Decryption failed for ${context.table}.${context.column}: Tampered ciphertext or wrong tenant/record context.`
    );
  }
}

/**
 * Computes an HMAC-SHA256 blind index for exact search on encrypted columns.
 * Normalizes values (lowercased, stripped of whitespace and non-alphanumeric separators)
 * and scopes to tenant.
 */
export function blindIndex(value: string, tenantId: string | number): string {
  if (!value) return "";
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s\-\(\)\.]+/g, "");

  const key = getBlindIndexKey();
  return crypto
    .createHmac("sha256", key)
    .update(`tenant:${tenantId}:${normalized}`)
    .digest("hex");
}

/**
 * Masks sensitive values for safe UI presentation (e.g. showing only last 4 digits).
 */
export function maskSensitive(value: string | null | undefined, type: "account" | "phone" | "tax" = "account"): string {
  if (!value) return "";
  const str = String(value).trim();
  if (str.length <= 4) return "••••";

  switch (type) {
    case "account":
      return `•••• •••• •••• ${str.slice(-4)}`;
    case "phone":
      return `•••••••${str.slice(-4)}`;
    case "tax":
      return `••••••${str.slice(-4)}`;
    default:
      return `••••${str.slice(-4)}`;
  }
}
