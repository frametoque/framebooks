// scripts/restore-backup.js
const fs = require("fs");
const path = require("path");
const postgres = require("postgres");
require("dotenv").config({ path: ".env.local" });

const backupPath = process.argv[2];
if (!backupPath) {
  console.error("Usage: node scripts/restore-backup.js <path-to-backup.json>");
  process.exit(1);
}

const fullPath = path.resolve(backupPath);
if (!fs.existsSync(fullPath)) {
  console.error(`Backup file not found: ${fullPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function restore() {
  console.log(`Starting restore from ${fullPath}...`);
  // Tables in dependency order
  const tableOrder = [
    "invoice_items",
    "invoices",
    "admin_expenses",
    "admin_incomes",
    "admin_transfers",
    "admin_quotations",
    "payments",
    "subscriptions",
    "accounts",
    "admin_clients",
    "admin_users",
    "tenants"
  ];

  await sql.begin(async (tx) => {
    for (const table of tableOrder) {
      console.log(`Clearing ${table}...`);
      await tx.unsafe(`DELETE FROM ${table}`);
    }

    // Insert in reverse dependency order
    const insertOrder = [...tableOrder].reverse();
    for (const table of insertOrder) {
      const rows = data[table] || [];
      if (rows.length === 0) continue;
      console.log(`Restoring ${rows.length} rows to ${table}...`);
      for (const row of rows) {
        const keys = Object.keys(row);
        const cols = keys.map(k => `"${k}"`).join(", ");
        const vals = keys.map(k => row[k]);
        await tx.unsafe(
          `INSERT INTO ${table} (${cols}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
          vals
        );
      }
    }
  });

  console.log("Restore complete!");
  await sql.end();
}

restore().catch((err) => {
  console.error("Restore failed:", err);
  process.exit(1);
});
