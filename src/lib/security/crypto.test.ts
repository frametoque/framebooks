import test from "node:test";
import assert from "node:assert/strict";
import {
  encryptField,
  decryptField,
  blindIndex,
  maskSensitive,
  getTenantDek,
} from "./crypto.ts";

test("Crypto Module: Round-trip encryption and decryption", () => {
  const context = {
    tenantId: 5,
    table: "accounts",
    column: "account_number",
    recordId: 101,
  };

  const plaintext = "8002914820194";
  const encrypted = encryptField(plaintext, context);

  assert.ok(encrypted.startsWith("v1:"), "Must start with v1 prefix");
  assert.notEqual(encrypted, plaintext, "Encrypted text must not match plaintext");

  const decrypted = decryptField(encrypted, context);
  assert.equal(decrypted, plaintext, "Decrypted text must match original plaintext");
});

test("Crypto Module: Tenant isolation (Tenant B cannot decrypt Tenant A ciphertext)", () => {
  const tenantAContext = {
    tenantId: 5,
    table: "accounts",
    column: "account_number",
    recordId: 101,
  };

  const tenantBContext = {
    tenantId: 8, // IslandSpares
    table: "accounts",
    column: "account_number",
    recordId: 101,
  };

  const plaintext = "SECRET_ACCOUNT_A";
  const encrypted = encryptField(plaintext, tenantAContext);

  assert.throws(() => {
    decryptField(encrypted, tenantBContext);
  }, /Decryption failed/);
});

test("Crypto Module: Tamper detection (Corrupted ciphertext or auth tag fails)", () => {
  const context = {
    tenantId: 5,
    table: "admin_clients",
    column: "phone",
    recordId: 42,
  };

  const encrypted = encryptField("0771234567", context);
  const parts = encrypted.split(":");
  // Flip a character in the ciphertext
  const tamperedCipher = parts[2].slice(0, -2) + (parts[2].slice(-2) === "aa" ? "bb" : "aa");
  const tampered = `${parts[0]}:${parts[1]}:${tamperedCipher}:${parts[3]}`;

  assert.throws(() => {
    decryptField(tampered, context);
  }, /Decryption failed/);
});

test("Crypto Module: Row swap detection (Ciphertext cannot be copied to another record)", () => {
  const record1Context = {
    tenantId: 5,
    table: "accounts",
    column: "account_number",
    recordId: 1,
  };

  const record2Context = {
    tenantId: 5,
    table: "accounts",
    column: "account_number",
    recordId: 2,
  };

  const encrypted = encryptField("ACCOUNT_1", record1Context);

  assert.throws(() => {
    decryptField(encrypted, record2Context);
  }, /Decryption failed/);
});

test("Crypto Module: Unique nonces produce different ciphertexts for same plaintext", () => {
  const context = {
    tenantId: 5,
    table: "admin_clients",
    column: "phone",
    recordId: 10,
  };

  const plain = "0719998888";
  const enc1 = encryptField(plain, context);
  const enc2 = encryptField(plain, context);

  assert.notEqual(enc1, enc2, "Each encryption must use a fresh random 96-bit nonce");
  assert.equal(decryptField(enc1, context), plain);
  assert.equal(decryptField(enc2, context), plain);
});

test("Crypto Module: Blind index consistency and normalization", () => {
  const phone1 = "077-123-4567";
  const phone2 = "  (077) 123 4567 ";
  const phone3 = "0771234567";

  const idx1 = blindIndex(phone1, 5);
  const idx2 = blindIndex(phone2, 5);
  const idx3 = blindIndex(phone3, 5);

  assert.equal(idx1, idx2, "Normalized phone blind index must match");
  assert.equal(idx2, idx3, "Cleaned phone blind index must match");
  assert.equal(idx1.length, 64, "Blind index must be 64-char SHA256 hex");

  // Different tenant gets different blind index
  const idxTenant8 = blindIndex(phone1, 8);
  assert.notEqual(idx1, idxTenant8, "Tenant isolation must apply to blind indexes");
});

test("Crypto Module: Masking helper", () => {
  assert.equal(maskSensitive("10028919248", "account"), "•••• •••• •••• 9248");
  assert.equal(maskSensitive("0771234567", "phone"), "•••••••4567");
  assert.equal(maskSensitive("982341908V", "tax"), "••••••908V");
  assert.equal(maskSensitive("123", "account"), "••••");
});
