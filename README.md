# Framebooks

Enterprise multi-tenant financial management, accounting, billing, inventory, and retail POS platform.

---

## 1. Technical Stack

- **Framework:** Next.js 16.2 (App Router, Server Components, Server Actions, Route Handlers, Turbopack)
- **UI Library:** React 19, Tailwind CSS v4, Lucide React, Framer Motion
- **Language:** TypeScript 5.9 (Strict mode enabled)
- **Database:** PostgreSQL on Neon Serverless (driver: `postgres` 3.4.9 with SSL enforcement)
- **Object Storage:** Cloudflare R2 via `@aws-sdk/client-s3`
- **Authentication:** NextAuth 4.24, WebAuthn Biometric Passkeys (`@simplewebauthn/server`), Scrypt password hashing
- **Payments:** Payments.lk (primary gateway), Stripe, PayHere
- **E-Commerce Sync:** WooCommerce REST API with HMAC-SHA256 webhooks and AES-256-GCM encrypted credentials
- **Hosting & Runtime:** Vercel (Edge Proxy / Serverless Node.js 22 runtime)

---

## 2. Prerequisites

- **Node.js:** `>= 20.0.0` (Node 22 recommended)
- **Package Manager:** `npm`
- **Database:** PostgreSQL 15+ with SSL enabled (`sslmode=require`)

---

## 3. Getting Started

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd framebooks
npm ci
```

### 2. Environment Configuration
Copy the template and configure required environment variables:
```bash
cp .env.example .env.local
```

Critical variables required at startup:
- `DATABASE_URL`: PostgreSQL connection string with SSL required.
- `NEXTAUTH_SECRET`: 32-byte secret for NextAuth session signing.
- `NEXTAUTH_URL`: Canonical public URL of the application.
- `APP_MASTER_KEY`: 32-byte hex key for AES-256-GCM field encryption.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with your browser.

---

## 4. Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Next.js development server with Turbopack |
| `npm run build` | Compiles an optimized production build |
| `npm start` | Starts the production Next.js server |
| `npm test` | Executes native Node.js unit and security test suite |
| `npm run typecheck` | Validates TypeScript static types across the codebase |
| `npm run lint` | Runs ESLint analysis |
| `npm run format:check` | Enforces zero linting warnings across all files |

---

## 5. Repository Structure

```
framebooks/
├── .github/workflows/          # CI/CD deployment pipelines (GitHub Actions)
├── public/                     # Static assets, logos, and web fonts
├── scripts/security/           # Security migrations, backfills, and backup tools
├── src/
│   ├── app/
│   │   ├── (dashboard)/        # Authenticated ERP, User, and Admin routes
│   │   ├── api/                # REST endpoints, crons, webhooks, and proxies
│   │   ├── pos/                # Retail POS terminal interface
│   │   ├── robots.ts           # Search engine indexing directives
│   │   └── sitemap.ts          # Sitemap definition
│   ├── components/             # Reusable UI components (POS, modals, dashboard)
│   ├── data/                   # Landing page specifications and guides
│   ├── lib/
│   │   ├── payment-gateway/    # Multi-gateway billing integration
│   │   ├── pos/                # Barcode generator, shifts, and stock logic
│   │   ├── security/           # AES-256-GCM crypto, SSRF, rate limiters, OTP
│   │   ├── woocommerce/        # E-commerce synchronization engine
│   │   ├── auth.ts             # NextAuth configuration and session handling
│   │   ├── db.tsx              # Parameterized PostgreSQL client with TLS
│   │   └── env.ts              # Startup server environment validator
│   └── proxy.ts                # Edge/Node middleware for route guarding
├── .env.example                # Canonical environment variable template
├── next.config.mjs             # Next.js build configuration & security headers
├── package.json                # Project dependencies and script declarations
├── SECURITY.md                 # Security policy, encryption, and vulnerability disclosure
└── tsconfig.json               # TypeScript configuration
```

---

## 6. Security

Please refer to [SECURITY.md](file:///Users/nelitha/Dev/framebooks/SECURITY.md) for details on:
- Cryptographic architecture and key management
- Vulnerability reporting procedures
- Transport and data-at-rest protection
