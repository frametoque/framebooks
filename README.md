# Framebooks

**Modern Invoicing, Accounting & Enterprise Business Management Platform**

Framebooks is a high-performance bookkeeping, financial reporting, and invoicing platform built for small-to-medium businesses, agencies, and growing teams. It features multi-tenant workspace isolation, professional invoice and quotation generation, automated financial reporting, client management, passkey biometric authentication, and an isolated administrative control center.

---

## Features

- **Invoicing & Quotations**: Generate PDF invoices and quotes, convert quotes to invoices, record client payments, and track outstanding balances.
- **Digital Wallet Passes**: Export invoices to Apple Wallet (`.pkpass`) and Google Wallet passes.
- **Income & Expense Tracking**: Track income streams, business expenses, bank transfers, and generate profit & loss summaries.
- **Client & Inventory Management**: Manage client contacts, transaction histories, and product/service catalogs.
- **Multi-Tenant Workspaces**: Role-based access control (`Owner`, `Admin`, `Member`) with granular permissions and team invitations.
- **Biometric Passkey Authentication**: WebAuthn/FIDO2 passkey support for passwordless 2FA login.
- **Administrative Portal (`/admin`)**: Strict separation between tenant data and platform-level administration (user management, subscription management, platform audit logs).
- **Audit Logs**: Immutable activity trails for critical financial operations.
- **Field-Level Data Encryption**: AES-256-GCM application-level encryption for sensitive client and financial data.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Database**: [PostgreSQL](https://www.postgresql.org/) / [Neon Serverless](https://neon.tech/)
- **Authentication**: NextAuth.js (Google OAuth & Credentials) + WebAuthn Passkeys (`@simplewebauthn`)
- **Styling**: Tailwind CSS v4 + Framer Motion
- **Object Storage**: Cloudflare R2 (S3-compatible bucket for receipts and logos)
- **PDF Generation**: `jspdf` & `pdf-lib`

---

## Getting Started

### 1. Prerequisites

- **Node.js**: `>=20.0.0`
- **PostgreSQL**: PostgreSQL 14+ or Neon Serverless
- **Cloudflare R2**: Bucket for file storage

### 2. Environment Setup

Copy `.env.example` to `.env.local` and populate your credentials:

```bash
cp .env.example .env.local
```

Key required variables:
- `DATABASE_URL`: PostgreSQL connection string with SSL enabled
- `NEXTAUTH_URL`: Canonical site URL (e.g., `http://localhost:3000` in development)
- `NEXTAUTH_SECRET`: Strong 32+ character random secret
- `APP_SECRET_KEY`: 32-byte hex key for application-level AES-256-GCM field encryption
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`: Cloudflare R2 credentials

See [`.env.example`](file:///.env.example) for the complete reference.

### 3. Database Migration & Seeding

Apply database schema migrations and seed platform administrator roles and subscription tiers:

```bash
node scripts/seed_admin.js
```

### 4. Running the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local Next.js dev server with Turbopack |
| `npm run build` | Compiles optimized production build |
| `npm run start` | Starts Next.js production server |
| `npm run typecheck` | Validates TypeScript types across the entire project |
| `npm run lint` | Runs ESLint checks |
| `npm run format:check` | Verifies code style compliance with ESLint |
| `node scripts/seed_admin.js` | Runs database migrations and seeds admin / plans |
| `node scripts/remove-demo-data.js` | Utility script to safely clean demo/test tenants |
| `node scripts/restore-backup.js <file>` | Restores data snapshot from a JSON backup |

---

## Health & Monitoring

- **Health Check Route**: `GET /api/health`
  Returns `{"status": "ok", "timestamp": "..."}` for uptime monitoring and container orchestration health checks without exposing internal infrastructure details.

---

## Production Deployment

### Vercel / Cloudflare
1. Connect your repository.
2. Configure all required environment variables in project settings.
3. Set build command to `npm run build` and output directory to default (`.next`).

### Node.js / Docker
```bash
npm ci
npm run build
NODE_ENV=production npm run start
```

---

## Documentation

- [SECURITY.md](file:///SECURITY.md) - Security architecture, encryption model, and vulnerability reporting.
- [ADMIN_README.md](file:///ADMIN_README.md) - Platform administration portal documentation and operations guide.

---

## License

Private and confidential. Proprietary software.
