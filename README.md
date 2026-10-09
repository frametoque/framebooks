# Framebooks

**Modern Invoicing, Accounting & Business Management Platform**

Framebooks is a full-featured bookkeeping and invoicing platform designed for small businesses, freelancers, and growing teams. It features multi-tenant workspace isolation, professional invoice & quotation generation, financial reporting, client management, passkey biometric authentication, and an isolated administrative control center.

---

## Features

- **Invoicing & Quotations**: Generate PDF invoices and quotes, convert quotes to invoices, record client payments, and track outstanding balances.
- **Digital Wallet Passes**: Export invoices to Apple Wallet (`.pkpass`) and Google Wallet passes.
- **Income & Expense Tracking**: Track income streams, business expenses, bank transfers, and generate profit & loss summaries.
- **Client & Inventory Management**: Manage client contacts, transaction histories, and product/service catalogs.
- **Multi-Tenant Workspaces**: Role-based access control (Owner, Admin, Member) with granular permissions and team invitations.
- **Biometric Passkey Authentication**: Modern WebAuthn/FIDO2 passkey support for passwordless 2FA login.
- **Administrative Portal (`/admin`)**: Strict separation between tenant data and platform-level administration (user management, subscription management, platform audit logs).
- **Audit Logs**: Immutable activity trails for critical financial operations.

---

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack, React 19)
- **Database**: [PostgreSQL](https://www.postgresql.org/) / [Neon Serverless](https://neon.tech/)
- **Authentication**: NextAuth.js (Google OAuth & Credentials) + WebAuthn Passkeys (`@simplewebauthn`)
- **Styling**: Tailwind CSS v4 + Framer Motion
- **Storage**: Vercel Blob (receipt attachments, logos)
- **PDF Generation**: `jspdf` & `pdf-lib`

---

## Getting Started

### 1. Prerequisites

- Node.js 18.17+ or 20+
- PostgreSQL database (e.g., Neon serverless)

### 2. Environment Setup

Copy `.env.example` to `.env.local` and populate your credentials:

```bash
cp .env.example .env.local
```

Key required variables:
- `DATABASE_URL`: Connection string for PostgreSQL
- `NEXTAUTH_URL`: Canonical URL (`http://localhost:3000` in dev)
- `NEXTAUTH_SECRET`: Random 32+ character string
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Google OAuth credentials

### 3. Database Migration & Seeding

Apply the initial database schema and seed default subscription tiers and admin roles:

```bash
node scripts/seed_admin.js
```

### 4. Running the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts local Next.js dev server with Turbopack |
| `npm run build` | Compiles optimized production build |
| `npm run start` | Starts Next.js production server |
| `npm run lint` | Runs ESLint |
| `node scripts/seed_admin.js` | Runs database migrations and seeds admin / plans |
| `node scripts/remove-demo-data.js` | Utility script to safely clean demo/test tenants |
| `node scripts/restore-backup.js <file>` | Restores data snapshot from a JSON backup |

---

## Production Deployment

### Vercel
1. Connect your repository to Vercel.
2. Configure environment variables matching `.env.example`.
3. Set build command to `npm run build` and output directory to default.

### Self-Hosted (PM2 / Node.js)
```bash
npm run build
pm2 start ecosystem.config.js
```

---

## Security

- Role separation: Workspace permissions (`admin_users.role`) are strictly separated from platform admin access (`admin_users.system_role`).
- Admin routes (`/admin/*`) enforce strict caching directives (`no-store`) and frame protection headers (`X-Frame-Options: DENY`).
- Server actions and API routes perform user authentication and workspace authorization checks before mutating tenant records.

---

## License

Private and confidential. Proprietary software.
