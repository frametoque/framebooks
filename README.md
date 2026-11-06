# Framebooks

Enterprise multi-tenant financial management and accounting platform built for small-to-medium businesses. Features automated invoicing, quotation lifecycles, income and expense tracking, multi-account ledgering, PDF generation with Sinhala font support, Apple/Google Wallet integration, WebAuthn passkey authentication, and field-level database encryption.

---

## 1. Stack & System Requirements

- **Runtime**: Node.js `>= 20.0.0`
- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Database**: PostgreSQL 15+ (Hosted on Supabase or Neon, TLS required via `sslmode=require`)
- **Styling**: Tailwind CSS v4, Framer Motion
- **Authentication**: NextAuth.js v4 (Google OAuth + Credentials for staff admins) + `@simplewebauthn` for passkeys
- **Storage**: Cloudflare R2 (S3-compatible Object Storage)
- **Email Delivery**: SMTP (NodeMailer with RFC 5321 envelope routing)
- **Package Manager**: `npm`

---

## 2. Getting Started

### A. Clone and Install Dependencies
```bash
git clone <repository-url>
cd framebooks
npm install
```

### B. Environment Configuration
Copy the template and supply real production credentials:
```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string with `?sslmode=require`
- `NEXTAUTH_URL`: Canonical site URL (e.g. `https://books.frametoque.com`)
- `NEXTAUTH_SECRET`: Random 32-byte secret (`openssl rand -hex 32`)
- `APP_MASTER_KEY`: 32-byte hexadecimal key for AES-256-GCM envelope encryption
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 credentials
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_REPLY_TO`: Outbound email configuration

### C. Database Migrations
Run versioned migrations located under `scripts/security/`:
```bash
# Apply additive encryption migration
node -e "
const fs = require('fs');
const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
sql.unsafe(fs.readFileSync('scripts/security/additive_migration.sql', 'utf8'))
  .then(() => { console.log('Migrations applied'); process.exit(0); });
"
```

### D. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Available Scripts

| Command | Action |
|---|---|
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Compiles optimized production bundle |
| `npm run start` | Launches compiled production server |
| `npm run lint` | Runs ESLint 9 static analysis |
| `npm test` | Runs native Node.js security and crypto unit tests |
| `npm run typecheck` | Validates TypeScript types across the entire project |
| `npm run format:check` | Enforces zero-warning linter compliance |

---

## 4. Project Structure

```
├── docs/                   # Security runbooks, architecture, and migrations
│   ├── internal/           # Admin platform documentation (ADMIN_README.md)
│   ├── migrations/         # Versioned schema migrations and rollback scripts
│   └── SECURITY_RUNBOOK.md # Key rotation, incident response, and disaster recovery
├── public/                 # Optimized static assets, icons, logos, manifest
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (dashboard)/    # Authenticated user (/user) and admin (/admin) route groups
│   │   ├── api/            # Server Route Handlers (auth, invoices, upload, export, health)
│   │   └── guide/          # Interactive product documentation & tutorials
│   ├── components/         # Shared UI design system, modals, navigation
│   ├── data/               # Landing content, feature definitions, guide data
│   ├── lib/                # Core libraries (db, auth, email, plans, security)
│   │   └── security/       # AES-256-GCM crypto, blind indexing, rate limiting, SSRF
│   └── types/              # TypeScript ambient interfaces and schemas
├── .env.example            # Environment template with sanitized placeholders
└── SECURITY.md             # Public vulnerability reporting policy
```

---

## 5. Security & Cryptography

- **Envelope Encryption**: Highly sensitive fields (`accounts.account_number`, `admin_clients.phone`, `admin_clients.tax_id`, `admin_clients.address`, `admin_users.phone`) are encrypted at the application layer using AES-256-GCM before database storage.
- **Tenant Isolation**: Data Encryption Keys (DEKs) are derived per tenant using HKDF-SHA256. A compromised key for Tenant A cannot decrypt Tenant B's data.
- **Searchable Blind Indexing**: Exact lookups on encrypted columns use tenant-isolated HMAC-SHA256 blind indexes (`_bidx`).
- **Security Policy**: For vulnerability disclosure guidelines, review [SECURITY.md](SECURITY.md).
- **Operations & Runbook**: For key rotation and incident response procedures, review [docs/SECURITY_RUNBOOK.md](docs/SECURITY_RUNBOOK.md).

---

## 6. Administration & Gating

- **Admin Portal**: Located at `/admin` and protected by server-side `system_role` checks (`super_admin`, `admin`, `support`). Refer to [docs/internal/ADMIN_README.md](docs/internal/ADMIN_README.md) for full operational permissions and promotion instructions.
- **Plans & Tier Gating**: Managed through `src/lib/plans.ts` and `src/lib/plans-db.ts` across `Free`, `Pro`, and `Pro Plus`. Free tier invoices automatically embed the compliance footer (`Generated by Framebooks`), while Pro tiers remove it.

---

## 7. Deployment Checklist

1. **Environment Variables**: Configure all secrets in host provider (Vercel, Cloudflare, or Docker). Ensure `APP_MASTER_KEY` is securely backed up in an offline password manager.
2. **Database Verification**: Ensure `DATABASE_URL` has `sslmode=require` and point-in-time recovery is enabled in the PostgreSQL host.
3. **Automated CI**: GitHub Actions automatically runs `npm ci`, `npm test`, and `npm run typecheck` prior to production deployments.
4. **Health Check**: Confirm `/api/health` returns HTTP 200 after deployment.
