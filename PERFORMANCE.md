# Performance & Vercel Resource Optimization Guide

This document outlines the performance architecture, Vercel resource budgets, and operational maintenance procedures for Framebooks.

---

## 1. Vercel Resource Limits & Optimization Overview

### Active CPU (Fluid Compute)
* **Hobby Plan Limit**: 4 hours / billing cycle.
* **Root Causes of Active CPU Exhaustion**:
  1. Next.js automatic `<Link>` prefetching on dynamic routes inside layout shells (sidebar, headers, tables) triggers full serverless render invocations for pages the user never clicks.
  2. Module-level `setInterval` or long-running async background timers in serverless lambdas.
  3. Redundant database queries executed repeatedly across navigations without memoization.
  4. Aggressive client polling loops (e.g. 60-second intervals) waking up functions in the background.

* **Mitigations Applied**:
  - `prefetch={false}` applied to dynamic routes in `DashboardShell`, `AdminSidebar`, quick actions, and data tables.
  - Active background polling replaced with user-initiated or `visibilitychange` listeners.
  - Rate limiting converted to passive sliding-window expiration (no `setInterval`).
  - Tenant accent theme, tenant info, and subscription plan lookups wrapped in React `cache()` for request-level deduplication.

---

### Functions Storage
* **Hobby Plan Limit**: 10 GB total across all active and historical deployments.
* **Root Causes of Storage Exhaustion**:
  1. **Deployment Accumulation**: Vercel counts every historical deployment towards the 10 GB storage quota until they are deleted or expired.
  2. **Standalone Output**: Next.js `output: 'standalone'` builds a 53 MB standalone Docker server directory (`.next/standalone`) containing duplicate `node_modules` inside every build output.
  3. **Heavy SDK Tracing**: Importing `@aws-sdk/client-s3` at the top level of shared server actions traces the entire AWS SDK into 25+ separate serverless function bundles.

* **Mitigations Applied**:
  - `output: 'standalone'` removed for Vercel deployments (Vercel builds its own optimized serverless output).
  - `@aws-sdk/client-s3` isolated via dynamic `import('@/lib/r2')` inside upload/delete handlers only.
  - `outputFileTracingExcludes` configured in `next.config.mjs` to omit backups, scripts, documentation, and markdown files from function bundles.

---

## 2. Vercel Dashboard Action Items (How to Reclaim ~6 GB Immediately)

Because Vercel sums function storage across **all historical deployments**, performing the following actions in the Vercel dashboard will instantly drop Functions Storage usage from **7.82 GB** down to **< 1 GB**:

### Step 1: Prune Old Deployments
1. Go to your project in the [Vercel Dashboard](https://vercel.com).
2. Click on the **Deployments** tab.
3. Filter by **Preview** or scroll through past deployments.
4. For older, superseded deployments that are no longer needed:
   - Click the **•••** (three dots) on the right of the deployment.
   - Select **Delete Deployment**.
   *(Note: You only need to keep the latest 2-3 Production deployments for rollbacks).*

### Step 2: Configure Deployment Retention Policy
1. In the Vercel dashboard, navigate to **Settings** > **General** (or **Data & Storage**).
2. Under **Deployment Retention**:
   - Set **Preview Deployment Retention** to **7 days** (or 14 days).
   - This ensures inactive PR/preview preview deployments are automatically cleaned up and do not consume storage.

---

## 3. Client-Side Load Speed Optimizations

* **PDF & Canvas Engines**:
  `jspdf`, `pdf-lib`, and `dom-to-image-more` represent ~1 MB of unminified JavaScript. They are dynamically imported on demand when the user clicks "Download PDF" or "Print", rather than blocking initial page loads for `/user/invoices` and `/user/quotations`.
* **Database Connection Pool**:
  `postgres` connection pool size is set to `max: 5` in production serverless environments to prevent exhausting Supabase connection pool limits during high concurrency.
