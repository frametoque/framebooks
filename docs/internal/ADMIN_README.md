# Framebooks Admin Dashboard Documentation

Welcome to the internal administration documentation for Framebooks. The Admin Dashboard is located at `/admin` and is strictly isolated from standard tenant workspaces.

---

## 1. Architecture Overview

- **Route Group**: `src/app/(dashboard)/admin`
- **Framework**: Next.js App Router (React Server Components + Server Actions)
- **Styling**: Tailwind CSS v4, shared theme tokens, Framer Motion
- **Database**: PostgreSQL (via Neon serverless client `@neondatabase/serverless`)
- **Isolation**:
  - Excluded from search indexing (`/admin` blocked in `robots.ts`).
  - Strict security headers (`no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
  - Server-side role enforcement on every route, server action, and API endpoint.

---

## 2. Role Model & Separation

To prevent privilege escalation across multi-tenant workspaces, Framebooks uses two strictly separate role columns:

| Column | Scope | Values | Purpose |
|---|---|---|---|
| `admin_users.role` | **Workspace** | `owner`, `admin`, `member`, `pending` | Controls tenant-level permissions within a company workspace (e.g. creating invoices, viewing bank accounts). |
| `admin_users.system_role` | **Platform** | `super_admin`, `admin`, `support`, `user` | Controls access to the global Framebooks Admin Dashboard (`/admin`). |

Normal tenant users have `system_role = 'user'` (or `NULL`) and are completely barred from `/admin`. Any unauthorized attempt redirects to `/user` or `/login`.

---

## 3. Permissions Matrix

| Permission | Super Admin | Admin | Support |
|---|:---:|:---:|:---:|
| **View Dashboard & Analytics** | ✅ | ✅ | ✅ |
| **View Users & Workspaces** | ✅ | ✅ | ✅ |
| **Add User Support Notes** | ✅ | ✅ | ✅ |
| **Impersonate User (Read-Only Token)** | ✅ | ✅ | ❌ |
| **Ban / Unban Users** | ✅ | ✅ | ❌ |
| **Extend / Manage Subscriptions** | ✅ | ✅ | ❌ |
| **Approve / Reject Bank Transfer Payments** | ✅ | ✅ | ❌ |
| **Issue Refunds** | ✅ | ❌ | ❌ |
| **Manage Pricing Plans & Limits** | ✅ | ❌ | ❌ |
| **Create / Revoke Coupons** | ✅ | ✅ | ❌ |
| **Publish Announcements** | ✅ | ✅ | ❌ |
| **View Immutable Audit Logs** | ✅ | ✅ | ✅ |
| **Manage Admin Roles & Staff** | ✅ | ❌ | ❌ |
| **Update Platform Settings & Maintenance Mode** | ✅ | ❌ | ❌ |

---

## 4. Initial Setup & Super Admin Promotion

### A. Database Migrations
Run the admin migration script to create all administrative tables:
```bash
# Apply schema (tables, constraints, foreign keys)
node -e "
const fs = require('fs');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
async function run() {
  const query = fs.readFileSync('migrations/001_admin_tables.sql', 'utf8');
  await sql(query);
  console.log('Migration applied successfully.');
}
run();
"
```

### B. Seed Platform Data
Run the idempotent seed script to populate plans, platform settings, and default data:
```bash
node scripts/seed_admin.js
```

### C. Promote a User to Super Admin
To promote an existing user account to `super_admin`:

**Method 1: SQL Query**
```sql
UPDATE admin_users
SET system_role = 'super_admin'
WHERE email = 'your-email@example.com';
```

**Method 2: Admin Dashboard (by existing Super Admin)**
1. Navigate to `/admin/admins`.
2. Find the user or enter their email.
3. Select `super_admin` and click **Promote**.

### D. Dedicated Admin Authentication (`/admin/login`)
Admin authentication is separated from standard customer sign-in:
- **URL**: `/admin/login`
- **Method**: Email & Password (`next-auth/providers/credentials`)
- **Password Security**: Salted cryptographic hashes using Node's native `crypto.scryptSync(password, salt, 64)`. Legacy plaintext passwords automatically upgrade to scrypt on first successful login.
- **Access Control**: Users with `system_role = 'user'` or without staff roles are blocked at the authentication layer even if they know a password.
- **Setting Staff Passwords**: Super Admins can set or update passwords directly in `/admin/admins` using the **Password** button on any staff row.

**Default Seed Credentials**:
- Super Admin: `itsnelitha@gmail.com` / `Admin@2026!`
- Super Admin: `admin@frametoque.com` / `admin123`
*(Remember to update these in production settings or via `/admin/admins`)*

---

## 5. Security & Audit Logging

1. **Immutable Audit Trail (`admin_audit_logs`)**:
   - Every mutation (ban, role change, refund, payment approval, plan update, setting change) creates an append-only row in `admin_audit_logs`.
   - Records: `actor_id`, `actor_email`, `action`, `target_type`, `target_id`, `before_state` (JSON), `after_state` (JSON), `ip_address`, `user_agent`.
   - A visual JSON Diff viewer is available at `/admin/audit-logs`.

2. **Destructive Action Protection**:
   - Destructive operations (banning users, issuing refunds, changing roles, activating maintenance mode) require confirmation via typed confirmation modals.

3. **Protection Against Accidental Lockout**:
   - Super Admins cannot demote or ban their own account.
   - The last remaining Super Admin cannot be demoted.

4. **Financial Transactions**:
   - Payment approvals and refunds execute inside atomic PostgreSQL transactions (`sql.begin` / row-level locks) to guarantee idempotency and prevent double-crediting.
   - Money values are stored as integers (LKR) to eliminate floating-point precision issues.

---

## 6. Admin Modules Breakdown

### 📊 Overview (`/admin`)
- Real-time KPIs: Active Users, MRR (Monthly Recurring Revenue), Pending Payments, Churn Rate.
- Revenue trends and active user distribution charts.
- Actionable review queues: Pending bank transfer slips and recent signups.

### 👥 Users (`/admin/users`)
- Search by name, email, workspace name, or status.
- Filtering by active, banned, or plan tier.
- User Detail (`/admin/users/[id]`):
  - **Overview**: Personal info, workspace association, registration date, last login.
  - **Subscriptions**: Active tier, renewal date, quota utilization.
  - **Payments**: Invoice and payment history.
  - **Activity**: Audit events relating to this user.
  - **Notes**: Internal support notes pinned by team members.
  - **Actions**: Impersonate, Ban/Unban with reason, Send reset link.

### 💳 Subscriptions (`/admin/subscriptions`)
- Manage tenant billing cycles, plan upgrades, downgrades, and trial extensions.
- Immediate recalculation of resource limits (`plan_limits`).

### 💰 Payments (`/admin/payments`)
- Manual bank transfer verification workflow:
  - View uploaded deposit slip images directly in high resolution.
  - One-click **Approve** (automatically activates subscription and extends billing period).
  - One-click **Reject** (with required reason logged to audit trail).
- Refund issuance with reason tracking.

### 📦 Plans (`/admin/plans`)
- Dynamic single source of truth for subscription plans.
- Syncs automatically to `plan_limits` used by tenant ERP quota checks.
- Changes reflect immediately on the public landing page pricing table.

### 🎟️ Coupons (`/admin/coupons`)
- Create percentage or fixed-amount discount codes.
- Set minimum spend, max redemption limits, and expiration dates.
- Real-time redemption analytics.

### 📈 Analytics (`/admin/analytics`)
- In-depth platform financial health metrics (MRR, ARR, Average Revenue Per User, Churn Rate).
- Plan breakdown distribution.
- Retention cohort performance.

### 📢 Announcements (`/admin/announcements`)
- Platform-wide banner broadcasting.
- Configurable severity: `info`, `warning`, `critical`, `success`.
- Supports target audiences (`all`, `free_only`, `paid_only`) and expiration scheduling.
- Users can dismiss announcements with state persisted in local storage.

### 📜 Audit Logs (`/admin/audit-logs`)
- Filterable by date range, actor email, action type, and target ID.
- Detailed before/after JSON diff comparison modal.

### 🛡️ Admins & Roles (`/admin/admins`)
- Directory of staff accounts with administrative privileges.
- Role management (`support`, `admin`, `super_admin`).

### ⚙️ Platform Settings (`/admin/settings`)
- Global system toggles:
  - **Maintenance Mode**: Restrict user workspace access during upgrades.
  - **Allow New Signups**: Pause registrations.
  - **Default Trial Days**: Configure onboarding grace period.
  - **System Notice**: Live alert shown platform-wide.
  - **Support Contact Email**: Visible to users experiencing issues.

---

## 7. Development & Verification

To verify TypeScript and linting health across the admin codebase:
```bash
npx tsc --noEmit
npm run build
```
