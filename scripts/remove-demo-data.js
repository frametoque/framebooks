#!/usr/bin/env node
// scripts/remove-demo-data
// Safe cleanup script for demo and test data
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

// Load environment from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { ssl: 'require' });

const isExecute = process.argv.includes('--execute') || process.argv.includes('-f');

async function main() {
  console.log("==========================================");
  console.log("   FRAMEBOOKS DEMO DATA REMOVAL TOOL");
  console.log(`   Mode: ${isExecute ? '⚠️  EXECUTE (WILL DELETE)' : '🔍 DRY-RUN (READ-ONLY)'}`);
  console.log("==========================================\n");

  // Suspected test tenants
  const testTenants = await sql`
    SELECT id, name, plan, created_at 
    FROM tenants 
    WHERE id NOT IN (5) AND (name ILIKE '%test%' OR name ILIKE '%dummy%')
  `;

  // Suspected test users
  const testUsers = await sql`
    SELECT id, email, full_name, role, system_role 
    FROM admin_users 
    WHERE email NOT IN ('itsnelitha@gmail.com', 'frametoque@gmail.com')
      AND (email ILIKE '%test%' OR email ILIKE '%example.com%' OR email ILIKE '%demo%')
  `;

  // Suspected demo transfers & quotations
  const testTransfers = await sql`SELECT count(*) FROM admin_transfers WHERE description ILIKE 'Dummy Transfer%'`;
  const testQuotations = await sql`SELECT count(*) FROM admin_quotations WHERE description ILIKE 'Dummy Project%'`;

  console.log(`Suspected Test Tenants: ${testTenants.length}`);
  testTenants.forEach(t => console.log(`  - [ID ${t.id}] ${t.name} (${t.plan})`));

  console.log(`\nSuspected Test Users: ${testUsers.length}`);
  testUsers.forEach(u => console.log(`  - [ID ${u.id}] ${u.email} (${u.role})`));

  console.log(`\nSuspected Demo Transfers: ${testTransfers[0].count}`);
  console.log(`Suspected Demo Quotations: ${testQuotations[0].count}`);

  if (!isExecute) {
    console.log("\n🔒 DRY-RUN COMPLETE. No data was modified.");
    console.log("To execute deletion, run with: node scripts/remove-demo-data --execute");
    await sql.end();
    return;
  }

  // Backup first
  console.log("\n📦 Creating safety backup before execution...");
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-auto-${timestamp}.json`);

  const dump = {
    testTenants,
    testUsers,
    createdAt: new Date()
  };
  fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2));
  console.log(`Safety snapshot created: ${backupFile}`);

  // Delete in transaction
  await sql.begin(async (tx) => {
    if (testTenants.length > 0) {
      const tenantIds = testTenants.map(t => t.id);
      await tx`DELETE FROM invoice_items WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM invoices WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM admin_clients WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM admin_expenses WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM admin_incomes WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM payments WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM subscriptions WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM accounts WHERE tenant_id = ANY(${tenantIds})`;
      await tx`DELETE FROM tenants WHERE id = ANY(${tenantIds})`;
    }

    if (testUsers.length > 0) {
      const userIds = testUsers.map(u => u.id);
      await tx`DELETE FROM admin_users WHERE id = ANY(${userIds})`;
    }

    await tx`DELETE FROM admin_transfers WHERE description ILIKE 'Dummy Transfer%'`;
    await tx`DELETE FROM admin_quotations WHERE description ILIKE 'Dummy Project%'`;
  });

  console.log("✅ Cleanup executed successfully.");
  await sql.end();
}

main().catch(err => {
  console.error("Cleanup error:", err);
  process.exit(1);
});
