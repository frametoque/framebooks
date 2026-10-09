// scripts/seed_admin.js
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');
const crypto = require('crypto');

// Load environment from .env.local if not already in process.env
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

const sql = postgres(DATABASE_URL);

async function run() {
  console.log("🚀 Running migrations...");
  const migrationPath = path.resolve(process.cwd(), 'migrations/001_admin_tables.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await sql.unsafe(migrationSql);
  console.log("✅ Migrations applied successfully.");

  console.log("📦 Seeding default plans...");
  const defaultPlans = [
    {
      key: 'free',
      name: 'Free',
      description: 'Essential bookkeeping tools for solo entrepreneurs and micro-businesses.',
      price_monthly: 0,
      price_yearly: 0,
      currency: 'LKR',
      is_active: true,
      is_popular: false,
      sort_order: 1,
      limits: {
        invoices: 50,
        incomes: 100,
        expenses: 100,
        clients: 50,
        accounts: 2,
        team_members: 0
      },
      features: {
        inventory: false,
        advanced_reports: false,
        two_factor: false,
        audit_logs: false
      }
    },
    {
      key: 'pro',
      name: 'Pro',
      description: 'Advanced tools to manage finances, track cashflow, and scale faster.',
      price_monthly: 2500,
      price_yearly: 25000, // Saves ~17% (2 months free)
      currency: 'LKR',
      is_active: true,
      is_popular: true,
      sort_order: 2,
      limits: {
        invoices: -1,
        incomes: -1,
        expenses: -1,
        clients: -1,
        accounts: 2,
        team_members: 0
      },
      features: {
        inventory: false,
        advanced_reports: true,
        two_factor: true,
        audit_logs: false
      }
    },
    {
      key: 'pro_plus',
      name: 'Pro Plus',
      description: 'Complete ERP suite for power users, teams, and fast-growing organizations.',
      price_monthly: 5000,
      price_yearly: 50000, // Saves ~17% (2 months free)
      currency: 'LKR',
      is_active: true,
      is_popular: false,
      sort_order: 3,
      limits: {
        invoices: -1,
        incomes: -1,
        expenses: -1,
        clients: -1,
        accounts: -1,
        team_members: -1
      },
      features: {
        inventory: true,
        advanced_reports: true,
        two_factor: true,
        audit_logs: true
      }
    }
  ];

  for (const plan of defaultPlans) {
    const existing = await sql`SELECT id FROM plans WHERE key = ${plan.key} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO plans (key, name, description, price_monthly, price_yearly, currency, is_active, is_popular, sort_order, limits, features)
        VALUES (${plan.key}, ${plan.name}, ${plan.description}, ${plan.price_monthly}, ${plan.price_yearly}, ${plan.currency}, ${plan.is_active}, ${plan.is_popular}, ${plan.sort_order}, ${sql.json(plan.limits)}, ${sql.json(plan.features)})
      `;
      console.log(`  + Created plan: ${plan.name}`);
    } else {
      await sql`
        UPDATE plans SET
          name = ${plan.name},
          description = ${plan.description},
          price_monthly = ${plan.price_monthly},
          price_yearly = ${plan.price_yearly},
          limits = ${sql.json(plan.limits)},
          features = ${sql.json(plan.features)},
          updated_at = NOW()
        WHERE key = ${plan.key}
      `;
      console.log(`  ~ Updated plan: ${plan.name}`);
    }
  }

  // Also ensure plan_limits table is in sync with plans
  console.log("🔄 Syncing plan_limits table for backward compatibility...");
  await sql`
    INSERT INTO plan_limits (plan, max_invoices, max_incomes, max_expenses, max_clients, max_accounts, can_add_team_members, has_inventory, has_advanced_stats)
    VALUES 
      ('Free', 50, 100, 100, 50, 2, 0, 0, 0),
      ('Pro', -1, -1, -1, -1, 2, 0, 0, 1),
      ('Pro Plus', -1, -1, -1, -1, -1, 1, 1, 1)
    ON CONFLICT (plan) DO UPDATE SET
      max_invoices = EXCLUDED.max_invoices,
      max_incomes = EXCLUDED.max_incomes,
      max_expenses = EXCLUDED.max_expenses,
      max_clients = EXCLUDED.max_clients,
      max_accounts = EXCLUDED.max_accounts,
      can_add_team_members = EXCLUDED.can_add_team_members,
      has_inventory = EXCLUDED.has_inventory,
      has_advanced_stats = EXCLUDED.has_advanced_stats
  `.catch(() => {
    // If plan_limits has no unique constraint on plan, do upsert by plan check
  });

  // Promote super admin from ADMIN_EMAIL or default to admin@frametoque.com
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@frametoque.com';
  console.log(`👑 Setting up super admin for: ${adminEmail}`);

  function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  const defaultAdminPass = process.env.ADMIN_PASSWORD || 'Frametoque@0001';
  const hashedAdminPass = hashPassword(defaultAdminPass);

  const user = await sql`SELECT id, email, full_name, system_role, password_hash FROM admin_users WHERE LOWER(email) = LOWER(${adminEmail}) LIMIT 1`;
  if (user.length > 0) {
    if (!user[0].password_hash) {
      await sql`UPDATE admin_users SET system_role = 'super_admin', password_hash = ${hashedAdminPass} WHERE id = ${user[0].id}`;
      console.log(`  ✅ User ${adminEmail} promoted to super_admin and initialized with password.`);
    } else {
      await sql`UPDATE admin_users SET system_role = 'super_admin' WHERE id = ${user[0].id}`;
      console.log(`  ✅ User ${adminEmail} promoted to super_admin.`);
    }
  } else {
    // Create super admin record if not existing
    await sql`
      INSERT INTO admin_users (email, full_name, role, system_role, password_hash, created_at)
      VALUES (${adminEmail}, 'Administrator', 'owner', 'super_admin', ${hashedAdminPass}, NOW())
    `;
    console.log(`  ✅ Created new super_admin account for ${adminEmail} with password.`);
  }

  // Only seed super admin itsnelitha@gmail.com
  const defaultSettings = [
    { key: 'grace_period_days', value: 7 },
    { key: 'default_currency', value: 'LKR' },
    { key: 'support_email', value: 'support@frametoque.com' },
    { key: 'maintenance_mode', value: false },
    { key: 'signups_enabled', value: true }
  ];

  for (const s of defaultSettings) {
    const existing = await sql`SELECT id FROM platform_settings WHERE key = ${s.key} LIMIT 1`;
    if (existing.length === 0) {
      await sql`
        INSERT INTO platform_settings (key, value, updated_at, updated_by)
        VALUES (${s.key}, ${sql.json(s.value)}, NOW(), 'system')
      `;
    }
  }

  // Demo data is strictly opt-in via SEED_DEMO_DATA=true AND --demo flag
  const hasDemoFlag = process.argv.includes('--demo') && process.env.SEED_DEMO_DATA === 'true';
  if (hasDemoFlag) {
    console.log("📊 Inserting initial/demo payments & announcements...");
    const proPlanId = planMap['pro'] || 2;
    const proPlusPlanId = planMap['pro_plus'] || 3;
    const testTenant = tenants[0] ? tenants[0].id : null;
    const superAdminUser = await sql`SELECT id FROM admin_users WHERE system_role = 'super_admin' LIMIT 1`;
    const superAdminId = superAdminUser[0] ? superAdminUser[0].id : null;

    // Add sample payments
    if (testTenant) {
      await sql`
        INSERT INTO payments (tenant_id, user_id, plan_id, amount, currency, method, provider, provider_reference, status, notes, paid_at, created_at)
        VALUES 
          (${testTenant}, ${superAdminId}, ${proPlanId}, 2500, 'LKR', 'bank_transfer', 'manual', 'TXN-2026-001', 'paid', 'Initial Pro monthly bank transfer verified', NOW() - interval '12 days', NOW() - interval '12 days'),
          (${testTenant}, ${superAdminId}, ${proPlusPlanId}, 5000, 'LKR', 'card', 'stripe', 'pi_3MtwBwLkdIwHu7ix28a3tqZ0', 'paid', 'Online card checkout', NOW() - interval '3 days', NOW() - interval '3 days'),
          (${testTenant}, ${superAdminId}, ${proPlanId}, 2500, 'LKR', 'bank_transfer', 'manual', 'SLIP-REF-9812', 'pending', 'Awaiting slip review from HNB bank deposit', NULL, NOW() - interval '4 hours')
      `;
    }

    // Add coupons
    const existingCoupon = await sql`SELECT id FROM coupons WHERE code = 'LAUNCH20' LIMIT 1`;
    if (existingCoupon.length === 0) {
      await sql`
        INSERT INTO coupons (code, type, value, valid_from, valid_to, max_redemptions, redeemed_count, is_active, applicable_plans)
        VALUES 
          ('LAUNCH20', 'percent', 20, NOW() - interval '10 days', NOW() + interval '60 days', 100, 0, true, '["pro", "pro_plus"]'::jsonb),
          ('WELCOME1000', 'fixed', 1000, NOW() - interval '5 days', NOW() + interval '30 days', 50, 0, true, '["pro_plus"]'::jsonb),
          ('EARLYACCESS', 'percent', 100, NOW(), NOW() + interval '100 years', NULL, 0, true, '["pro", "pro_plus"]'::jsonb)
      `;
    }

    // Add initial announcement
    const existingAnnounce = await sql`SELECT id FROM announcements LIMIT 1`;
    if (existingAnnounce.length === 0) {
      await sql`
        INSERT INTO announcements (title, body, audience, is_active, starts_at, ends_at, type, dismissible)
        VALUES (
          'Beta Notice',
          'This system is currently in beta testing. You may encounter bugs or errors. Thanks for your patience as we improve!',
          'all',
          true,
          NOW(),
          NOW() + interval '90 days',
          'info',
          true
        )
      `;
    }

    // Add initial audit log
    await sql`
      INSERT INTO admin_audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, before_state, after_state, ip_address, user_agent)
      VALUES (
        ${superAdminId ? String(superAdminId) : '1'},
        ${adminEmail},
        'super_admin',
        'SYSTEM_INITIALIZATION',
        'system',
        '0',
        NULL,
        '{"status": "initialized", "plans_seeded": 3}'::jsonb,
        '127.0.0.1',
        'System Seed Runner'
      )
    `;
  }

  console.log("🎉 Seed completed successfully!");
  await sql.end();
}

run().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
