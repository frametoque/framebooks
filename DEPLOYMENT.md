# Deployment & Hosting Guide

Framebooks supports two deployment targets out of the box from a single codebase:
1. **Vercel** (Serverless + CDN)
2. **Shared Hosting / VPS / Container** (Standalone long-lived Node.js server via Next.js `output: 'standalone'`)

---

## Target 1: Vercel (Current Production)

### Configuration
- **Region**: `sin1` (Singapore) configured in `vercel.json` to co-locate serverless execution with the Supabase PostgreSQL database (`aws-0-ap-southeast-1.pooler.supabase.com`).
- **Function Timeout**: Configured to 15s in `vercel.json` to prevent orphaned connections.
- **Scheduled Cron**: `/api/payments/cron/renewals` runs daily at `02:00 UTC` (`0 2 * * *`).

### Storage & Active CPU Retention Best Practices
1. **Clean Old Deployments**: Vercel limits Functions Storage across all active deployments (preview + production). Navigate to **Project Settings > Deployments** and delete stale preview deployments or configure a 7-day retention policy.
2. **Static & ISR Routes**: The landing page (`/`) uses 1-hour ISR (`export const revalidate = 3600`) and the root layout avoids blocking cookie evaluation during viewport generation, serving public assets directly from the Vercel Edge Cache with zero Active CPU consumption.

---

## Target 2: Shared Hosting (cPanel / DirectAdmin / Passenger / VPS)

### Prerequisites
- Node.js 20+ (LTS) or 22+
- Persistent PostgreSQL connection (e.g., Supabase Session/Transaction pooler or direct TLS connection to Postgres)
- Shared hosting with Node.js application manager (CloudLinux Passenger, cPanel Setup Node.js App, or PM2)

### Build & Export (Local or CI)
Because shared hosting environments often enforce tight RAM limits (512MB - 1GB) and CPU throttling during compilation, build the project locally or via GitHub Actions:

```bash
npm ci
npm run build
```

Next.js will generate a standalone distribution in `.next/standalone`.

### Upload Package Structure
Upload the following files to your shared hosting application root (e.g. `/home/username/framebooks`):

```text
/home/username/framebooks/
├── .next/
│   ├── standalone/       <-- Copy everything inside .next/standalone
│   └── static/           <-- Copy from .next/static into .next/standalone/.next/static
├── public/               <-- Copy from project root into .next/standalone/public
└── .env.production       <-- Set your production environment variables
```

### Starting the Application
In cPanel / Passenger or PM2:
- **Application Root**: `/home/username/framebooks`
- **Application Startup File**: `server.js` (from `.next/standalone/server.js`)
- **Port**: Bound automatically by Passenger or specified via `PORT=3000`

Using PM2 (if SSH access is available):
```bash
PORT=3000 node server.js
# Or with PM2:
pm2 start server.js --name "framebooks"
```

### Scheduled Cron on Shared Hosting
Instead of Vercel cron, set up a standard cPanel / Linux crontab entry for daily subscription renewals:

```bash
# Runs daily at 02:00 AM UTC
0 2 * * * curl -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/payments/cron/renewals >/dev/null 2>&1
```

