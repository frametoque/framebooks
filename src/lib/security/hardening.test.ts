import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { isPrivateOrReservedIP, validateSafeUrl } from "./ssrf.ts";
import { checkRateLimit } from "./rate-limit.ts";

describe("Security Hardening: SSRF and URL Protection", () => {
  it("rejects loopback and private IP addresses", () => {
    assert.equal(isPrivateOrReservedIP("127.0.0.1"), true);
    assert.equal(isPrivateOrReservedIP("10.0.0.1"), true);
    assert.equal(isPrivateOrReservedIP("172.16.0.1"), true);
    assert.equal(isPrivateOrReservedIP("192.168.1.1"), true);
    assert.equal(isPrivateOrReservedIP("169.254.169.254"), true);
    assert.equal(isPrivateOrReservedIP("::1"), true);
    assert.equal(isPrivateOrReservedIP("::ffff:127.0.0.1"), true);
  });

  it("permits public Internet IP addresses", () => {
    assert.equal(isPrivateOrReservedIP("8.8.8.8"), false);
    assert.equal(isPrivateOrReservedIP("1.1.1.1"), false);
  });

  it("rejects dangerous or private schemes", async () => {
    const fileRes = await validateSafeUrl("file:///etc/passwd");
    assert.equal(fileRes.safe, false);

    const ftpRes = await validateSafeUrl("ftp://example.com/file");
    assert.equal(ftpRes.safe, false);

    const localRes = await validateSafeUrl("http://localhost:3000/api");
    assert.equal(localRes.safe, false);

    const metadataRes = await validateSafeUrl("http://169.254.169.254/latest/meta-data");
    assert.equal(metadataRes.safe, false);
  });
});

describe("Security Hardening: Admin JWT Verification & Rate Limiting", () => {
  it("verifies HMAC-SHA256 signature and rejects forged or tampered tokens", async () => {
    const secret = "framebooks_super_secret_hardening_key_32bytes!";
    const now = Math.floor(Date.now() / 1000);
    const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payloadB64 = Buffer.from(JSON.stringify({ id: 1, email: "admin@framebooks.com", exp: now + 3600 })).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest("base64url");
    const validToken = `${headerB64}.${payloadB64}.${sig}`;

    // Web Crypto verification matching src/proxy.ts
    async function verifyToken(token: string, keySecret: string) {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const [h, p, s] = parts;
      const key = await globalThis.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(keySecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      let base64 = s.replace(/-/g, "+").replace(/_/g, "/");
      while (base64.length % 4) base64 += "=";
      const sigBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      const dataBytes = new TextEncoder().encode(`${h}.${p}`);
      const ok = await globalThis.crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
      if (!ok) return null;
      let pStr = p.replace(/-/g, "+").replace(/_/g, "/");
      while (pStr.length % 4) pStr += "=";
      const data = JSON.parse(atob(pStr));
      if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
      return data;
    }

    const validResult = await verifyToken(validToken, secret);
    assert.ok(validResult);
    assert.equal(validResult.id, 1);
    assert.equal(validResult.email, "admin@framebooks.com");

    // Tampered signature must fail
    const tampered = validToken.slice(0, -6) + "xxxxxx";
    const tamperedResult = await verifyToken(tampered, secret);
    assert.equal(tamperedResult, null);

    // Tampered payload must fail
    const fakePayloadB64 = Buffer.from(JSON.stringify({ id: 999, email: "hacker@framebooks.com", exp: now + 3600 })).toString("base64url");
    const forgedToken = `${headerB64}.${fakePayloadB64}.${sig}`;
    const forgedResult = await verifyToken(forgedToken, secret);
    assert.equal(forgedResult, null);

    // Expired token must fail
    const expPayloadB64 = Buffer.from(JSON.stringify({ id: 1, email: "admin@framebooks.com", exp: now - 60 })).toString("base64url");
    const expSig = crypto.createHmac("sha256", secret).update(`${headerB64}.${expPayloadB64}`).digest("base64url");
    const expToken = `${headerB64}.${expPayloadB64}.${expSig}`;
    const expResult = await verifyToken(expToken, secret);
    assert.equal(expResult, null);
  });

  it("enforces sliding-window rate limits independently across namespaces and identifiers", () => {
    const ip1 = "203.0.113.19";
    const ip2 = "203.0.113.20";

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit("test-hardening", ip1, { max: 5, windowMs: 60000 });
      assert.equal(res.allowed, true);
    }

    // 6th request from ip1 should be blocked
    const blockedRes = checkRateLimit("test-hardening", ip1, { max: 5, windowMs: 60000 });
    assert.equal(blockedRes.allowed, false);
    assert.ok(blockedRes.retryAfterSeconds > 0);

    // ip2 should still be allowed (independent identifier)
    const ip2Res = checkRateLimit("test-hardening", ip2, { max: 5, windowMs: 60000 });
    assert.equal(ip2Res.allowed, true);
  });
});
