# Security Policy

Framebooks takes the security of customer financial data and infrastructure seriously. This document outlines vulnerability reporting, supported versions, and cryptographic standards.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability in Framebooks, please report it immediately:

- **Security Team Email**: [security@frametoque.com](mailto:security@frametoque.com)
- **Urgent Issues**: [framebooks@frametoque.com](mailto:framebooks@frametoque.com)

Please do **NOT** file public GitHub issues for security vulnerabilities.

### What to Include in Your Report
1. Detailed description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or a minimal proof of concept (PoC).
3. Affected routes, API endpoints, or database fields.
4. Any relevant HTTP requests, headers, or screenshots.

### Our Response Commitment
- **Initial Acknowledgment**: Within 24 hours.
- **Triage & Severity Assessment**: Within 48 hours.
- **Remediation & Patch Deployment**: Prioritized by severity (Critical: <24h, High: <72h).

---

## 2. Supported Versions

Security updates and patches are actively maintained on the current production release branch.

| Version | Status | Security Support |
|---|---|---|
| `1.x` (`main` / `release/*`) | **Active** | Supported |
| `< 1.0` | **End of Life** | Unsupported |

---

## 3. Cryptographic Standards

Framebooks implements defense-in-depth data security:

1. **Encryption in Transit**: TLS 1.3/1.2 enforced across all client-to-server traffic, database connections (`sslmode=require`), Cloudflare R2 S3 operations, and SMTP dispatches.
2. **Application-Level Encryption (AES-256-GCM)**: Sensitive banking records (account numbers, branch codes) and client personal identification details (phone numbers, addresses, tax IDs) are encrypted before reaching the database.
3. **Envelope Encryption & Isolation**: Each tenant uses a dedicated Data Encryption Key (DEK) derived via HKDF-SHA256 from the master key. Tenant A's cryptographic material can never decrypt Tenant B's data.
4. **Searchable Blind Indexing**: Exact lookups on encrypted columns use tenant-isolated HMAC-SHA256 blind indexes without exposing raw plaintext.
