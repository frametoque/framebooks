# Performance & Resource Management Guide

This document defines performance budgets, compute limits, and best practices to maintain optimal resource usage on Vercel and shared hosting.

## Performance Budgets

| Metric | Budget Target | Optimization Mechanism |
|---|---|---|
| **Landing Page TTFB** | < 100 ms | Edge CDN caching via 1-hour ISR (`revalidate = 3600`) |
| **Dashboard Limit Check** | < 150 ms | Single round-trip parallel query in `getAllLimits()`; 0 queries for unlimited plans |
| **Maintenance Mode Polling** | 0 active CPU when hidden | Visibility-aware tab listener (`document.hidden`) + 5-min interval + 60s cache header |
| **Notification Polling** | 0 active CPU when hidden | Visibility-aware listener (`document.hidden`) + 5-min interval |
| **Standalone Distribution Size** | < 80 MB | Only traced production dependencies copied to `.next/standalone` |

## Resource Reduction Tactics Applied

1. **Singapore (`sin1`) Edge Co-location**:
   Eliminated transatlantic network latency between Vercel serverless functions (previously defaulted to `iad1` - US East) and the database (`aws-0-ap-southeast-1` - Singapore).

2. **Source Map Stripping**:
   Browser source maps disabled in production to eliminate unnecessary megabytes from output bundles.

3. **Optimized Imports**:
   Modular icon and animation imports enabled for `lucide-react`, `react-icons`, `recharts`, and `framer-motion`.

4. **Vercel Functions Storage Clean-up**:
   Old preview deployments accumulate storage toward the 10 GB quota. Regularly prune deployments or configure automated branch deletion in Vercel.
