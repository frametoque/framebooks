# Internal Security Runbook

This internal runbook outlines standard operating procedures for encryption key management, incident response, disaster recovery, and access reviews for Framebooks.

---

## 1. Cryptographic Key Management & Rotation

### Master Encryption Key (`APP_MASTER_KEY`)
- **Generation**: Generate a secure 32-byte (256-bit) cryptographic hex key:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- **Storage**: Store strictly in production environment secret stores (Cloudflare Worker Secrets, Vercel Environment Variables). **NEVER** commit to git or store alongside database backups.
- **Master Key Rotation Procedure**:
  1. Add `APP_MASTER_KEY_PREVIOUS` to environment variables holding the existing master key.
  2. Set `APP_MASTER_KEY` to the newly generated 32-byte key.
  3. Deploy application.
  4. Run key re-wrap script to re-encrypt existing `_enc` columns with the new key version (`v2`).
  5. Remove `APP_MASTER_KEY_PREVIOUS` after verification.

---

## 2. Incident Response Checklist

If a key, token, or database credential is suspected of compromise:

1. **Containment (Within 1 Hour)**:
   - Rotate database password immediately in Supabase Console (*Project Settings > Database > Database password*).
   - Invalidate all active staff sessions and rotate `NEXTAUTH_SECRET`.
   - Rotate cloud storage credentials in Cloudflare dashboard (*R2 > Manage API Tokens*).
2. **Investigation (Within 6 Hours)**:
   - Query `admin_audit_logs` and PostgreSQL statement logs for unauthorized IP addresses, abnormal mass queries, or bulk exports.
   - Determine which tenants or accounts were queried.
3. **Remediation**:
   - Re-deploy latest clean release branch.
   - Run audit verification script to confirm zero unauthorized data mutations.
4. **Post-Incident Review**:
   - Document root cause, timeline, affected records, and prevention measures.

---

## 3. Backup and Restore Testing Procedure

- **Automated Backup Command**:
  ```bash
  ./scripts/security/backup.sh
  ```
- **Integrity Verification**:
  Ensure the generated `.sql` file exceeds minimum threshold (typically > 500 KB) and contains valid PostgreSQL DDL headers (`CREATE TABLE`, `COPY`).
- **Disaster Recovery Restore**:
  ```bash
  psql "$DATABASE_URL" -f "backups/security/framebooks_backup_<TIMESTAMP>.sql"
  ```
- **Schedule**: Perform automated daily snapshots in Supabase (with Point-In-Time Recovery enabled) and monthly manual restore validation into a staging environment.

---

## 4. User Offboarding & Admin Access Review

1. **Staff Offboarding**:
   - Set `is_banned = true` and `deleted_at = NOW()` on the target account in `admin_users`.
   - Invalidate all passkeys registered under the user in the `passkeys` table.
   - Trigger session revocation across all edge nodes.
2. **Quarterly Access Review**:
   - Audit all users with `system_role IN ('super_admin', 'admin', 'support')`.
   - Confirm each active account belongs to a current team member.
   - Revoke stale invitations in `team_invitations` where `created_at < NOW() - INTERVAL '30 days'`.

---

## 5. Database Protections & Hardening Guidelines

- **Connection TLS**: Ensure `sslmode=require` is present in all database connection strings.
- **Statement Timeout**: Set statement timeouts on app connections to prevent denial-of-service queries:
  ```sql
  ALTER ROLE postgres SET statement_timeout = '15s';
  ```
- **Append-Only Audit Logs**: Disallow `UPDATE` and `DELETE` on audit log tables:
  ```sql
  REVOKE UPDATE, DELETE ON audit_logs FROM public;
  REVOKE UPDATE, DELETE ON admin_audit_logs FROM public;
  ```
