# Security Policy & Architecture

## Security Architecture Overview

Framebooks employs a defense-in-depth security model designed to safeguard sensitive accounting, financial, and customer data.

### 1. Data Encryption

- **Encryption in Transit**: All inbound and outbound communications require TLS 1.3 / TLS 1.2 with HSTS (`Strict-Transport-Security`).
- **Encryption at Rest**: PostgreSQL database storage and object storage volumes are encrypted at rest with AES-256.
- **Application-Level Field Encryption**:
  - Highly sensitive tenant and customer fields (such as client identity information and private financial metadata) are encrypted at the application layer using authenticated AES-256-GCM.
  - Dedicated key derivation and initialization vectors (IVs) are applied per record to prevent cipher reuse attacks.
  - Key rotation utilities support zero-downtime re-encryption.

### 2. Authentication & Authorization

- **Multi-Tenant Workspace Isolation**:
  - Every tenant database query enforces strict workspace scoping (`workspace_id` / `business_id`).
  - Cross-tenant data leakage is prevented via parameterized queries with `postgres` and strict authorization guards.
- **Role-Based Access Control (RBAC)**:
  - Tenant roles (`Owner`, `Admin`, `Member`) control access within an organization.
  - Platform administrator access (`system_role`) is strictly isolated from tenant operations.
- **Biometric Multi-Factor Authentication (MFA)**:
  - FIDO2 / WebAuthn passkey authentication using hardware security keys and device biometrics (Apple Touch ID, Windows Hello, Android Biometrics).
- **Session Security**:
  - NextAuth JWT sessions with secure, `HttpOnly`, `SameSite=Lax` cookies.

### 3. Application Hardening

- **Security Headers**:
  - `Content-Security-Policy` with nonces and strict origin directives.
  - `X-Frame-Options: DENY` across all authenticated views.
  - `X-Content-Type-Options: nosniff`.
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` disabling unused browser APIs (camera, microphone, geolocation).
- **Rate Limiting**:
  - In-memory token bucket rate limiting on sensitive public endpoints, authentication routes, and export actions.
- **Input Sanitization & Injection Defense**:
  - Parameterized SQL queries preventing SQL injection.
  - CSV formula injection defenses (`src/lib/security/csv.ts`) stripping malicious execution prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`).

---

## Reporting a Vulnerability

If you discover a security vulnerability within Framebooks, please report it privately:

- **Email**: `security@framebooks.io` or direct contact via administration portal.
- **Response SLA**: Initial triage within 24 hours; critical fixes deployed within 72 hours.
- Please do not disclose vulnerabilities publicly or create public GitHub issues for security reports.
