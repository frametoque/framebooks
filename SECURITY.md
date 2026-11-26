# Security Policy

## 1. Reporting a Vulnerability

We take the security of Framebooks and our customers' data seriously. If you discover a security vulnerability, please report it responsibly rather than disclosing it publicly.

- **Email:** `security@frametoque.com`
- **Response Target:** We acknowledge receipt within 24 business hours and provide remediation updates until resolved.

Please include:
- A detailed description of the vulnerability and attack vector.
- Reproduction steps or a minimal proof-of-concept.
- Any affected endpoints, parameters, or configurations.

---

## 2. Supported Versions

| Version | Supported |
|---|---|
| 1.0.x (Current Release) | :white_check_mark: |
| < 1.0.0 | :x: |

---

## 3. Security Architecture & Controls

### Transport Security (In Transit)
- **TLS 1.3 / 1.2 Enforcement:** All HTTP traffic is redirected to HTTPS at the edge.
- **HSTS:** Strict-Transport-Security enforced with `max-age=63072000; includeSubDomains; preload`.
- **Database Connection:** PostgreSQL connections strictly require SSL (`ssl: "require"`). Unencrypted database connections are rejected.
- **Security Headers:** Strict Content-Security-Policy (CSP without `'unsafe-eval'` in production), `X-Frame-Options: SAMEORIGIN` / `DENY`, `X-Content-Type-Options: nosniff`, and restrictive `Permissions-Policy`.

### Cryptographic Protection (Application & Field Level)
- **Algorithm:** AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- **Envelope Key Derivation:** Per-tenant Data Encryption Keys (DEKs) derived dynamically using HKDF-SHA256 from the master key (`APP_MASTER_KEY`). Cross-tenant decryption is cryptographically impossible.
- **Nonce & AAD:** Fresh 96-bit random IV per operation. Authenticated Additional Data (AAD) binds ciphertext to its table, column, tenant, and record ID to detect tampering or row-swapping.
- **Exact-Match Blind Indexing:** HMAC-SHA256 blind indexing (`_bidx`) allows indexed database lookups over encrypted fields without decrypting columns in memory or storing plaintext.

### Authentication & Access Control
- **Passwords:** Hashed using Scrypt (`crypto.scryptSync(password, salt, 64)`) with a unique 16-byte random salt. Format: `<salt>:<hex-hash>`.
- **Admin Sessions:** Dedicated HTTP-only tokens verified using timing-safe HMAC-SHA256 signatures (`verifyAdminToken`).
- **Passkeys:** WebAuthn / FIDO2 biometric authentication with origin and challenge verification.
- **Rate Limiting:** Sliding-window rate limiters prevent brute-force attacks across login, quotation generation, and data export endpoints.
- **Multi-Tenancy:** All queries enforce strict tenant scoping (`tenant_id = ${tenantId}`) derived directly from the authenticated session context.
