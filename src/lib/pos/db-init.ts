import sql from "@/lib/db";
import { ensureDefaultRolePermissions } from "@/app/(dashboard)/user/actions/roles";

let isInitialized = false;
let posInitPromise: Promise<void> | null = null;

export async function ensurePosSchema() {
  if (isInitialized) return;
  if (posInitPromise) return posInitPromise;

  posInitPromise = (async () => {
    try {
    // 1. Add-on Entitlement Table
    await sql`
      CREATE TABLE IF NOT EXISTS tenant_addons (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        addon_key VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        price NUMERIC(12, 2) DEFAULT 0,
        billing_interval VARCHAR(20) DEFAULT 'monthly',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, addon_key)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_tenant_addons_lookup ON tenant_addons(tenant_id, addon_key, status);`;

    // 1b. Global System Addons Definition & Pricing Table
    await sql`
      CREATE TABLE IF NOT EXISTS system_addons (
        key VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 3000,
        price_yearly NUMERIC(12, 2) NOT NULL DEFAULT 30000,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        compatible_plans TEXT[] DEFAULT ARRAY['pro', 'pro_plus'],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // 1c. Ensure system role permissions table and default role privileges
    await ensureDefaultRolePermissions().catch(() => {});

    // Seed default POS add-on if it doesn't exist
    await sql`
      INSERT INTO system_addons (key, name, description, price_monthly, price_yearly, is_active, compatible_plans)
      VALUES (
        'pos',
        'Point of Sale (POS)',
        'Complete Cloud Point of Sale add-on for retail counters, fast barcode scanning, receipt printing, and live stock tracking.',
        3000,
        30000,
        TRUE,
        ARRAY['pro', 'pro_plus']
      )
      ON CONFLICT (key) DO NOTHING;
    `;

    // 2. Extend admin_inventory for retail & POS stock
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS sku VARCHAR(100);`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS barcode VARCHAR(100);`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS brand VARCHAR(100);`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0;`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) DEFAULT 0;`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) DEFAULT 0;`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT 'pcs';`;
    await sql`ALTER TABLE admin_inventory ADD COLUMN IF NOT EXISTS reorder_level NUMERIC(12, 2) DEFAULT 5;`;

    await sql`CREATE INDEX IF NOT EXISTS idx_inventory_tenant_sku ON admin_inventory(tenant_id, sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_inventory_tenant_barcode ON admin_inventory(tenant_id, barcode);`;

    // Backfill empty SKUs and selling prices on existing inventory
    await sql`
      UPDATE admin_inventory
      SET sku = 'SKU-' || LPAD(id::text, 6, '0')
      WHERE sku IS NULL OR TRIM(sku) = '';
    `;

    await sql`
      UPDATE admin_inventory
      SET selling_price = COALESCE(purchase_price, 0),
          cost_price = COALESCE(purchase_price, 0)
      WHERE selling_price = 0 OR selling_price IS NULL;
    `;

    // 3. Stock Movements (Audit Trail & Transactions)
    await sql`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        inventory_id INTEGER NOT NULL REFERENCES admin_inventory(id) ON DELETE CASCADE,
        change_qty NUMERIC(12, 2) NOT NULL,
        previous_qty NUMERIC(12, 2) NOT NULL,
        new_qty NUMERIC(12, 2) NOT NULL,
        reason VARCHAR(50) NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(100),
        user_id INTEGER,
        user_name VARCHAR(150),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_item ON stock_movements(tenant_id, inventory_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at DESC);`;

    // 4. POS Settings
    await sql`
      CREATE TABLE IF NOT EXISTS pos_settings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
        allow_negative_stock BOOLEAN DEFAULT FALSE,
        sku_prefix VARCHAR(20) DEFAULT 'SKU',
        receipt_header TEXT,
        receipt_footer TEXT,
        default_tax_rate NUMERIC(5, 2) DEFAULT 0,
        default_account_id INTEGER,
        customer_display_slides JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE pos_settings ADD COLUMN IF NOT EXISTS customer_display_slides JSONB;`;

    // 4b. Cashier Counters (Physical or logical registers)
    await sql`
      CREATE TABLE IF NOT EXISTS pos_counters (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, name)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_counters_tenant ON pos_counters(tenant_id, is_active);`;

    // 5. POS Shifts (Cash Drawer Sessions associated with Counters)
    await sql`
      CREATE TABLE IF NOT EXISTS pos_shifts (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        user_name VARCHAR(150),
        shift_number INTEGER,
        counter_id INTEGER,
        counter_name VARCHAR(100),
        opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        closed_at TIMESTAMP WITH TIME ZONE,
        opening_cash NUMERIC(12, 2) DEFAULT 0,
        closing_cash NUMERIC(12, 2),
        expected_cash NUMERIC(12, 2),
        notes TEXT,
        status VARCHAR(20) DEFAULT 'open',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS shift_number INTEGER;`;
    await sql`ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS counter_id INTEGER;`;
    await sql`ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS counter_name VARCHAR(100);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_shifts_tenant_status ON pos_shifts(tenant_id, status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_shifts_tenant_shift_num ON pos_shifts(tenant_id, shift_number);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_shifts_counter ON pos_shifts(tenant_id, counter_id, status);`;

    // Backfill sequential shift_number per tenant for any existing shifts
    await sql`
      WITH numbered AS (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id ASC) as num
        FROM pos_shifts
        WHERE shift_number IS NULL
      )
      UPDATE pos_shifts p
      SET shift_number = numbered.num
      FROM numbered
      WHERE p.id = numbered.id;
    `.catch(() => {});

    // Ensure default Counter 1 exists for tenants and backfill legacy shifts
    await sql`
      INSERT INTO pos_counters (tenant_id, name, code, is_active)
      SELECT DISTINCT t.id, 'Counter 1', 'C1', true
      FROM tenants t
      WHERE EXISTS (SELECT 1 FROM pos_shifts s WHERE s.tenant_id = t.id)
         OR EXISTS (SELECT 1 FROM tenant_addons a WHERE a.tenant_id = t.id AND a.addon_key = 'pos' AND a.status = 'active')
      ON CONFLICT (tenant_id, name) DO NOTHING;
    `.catch(() => {});

    await sql`
      UPDATE pos_shifts s
      SET counter_id = c.id, counter_name = c.name
      FROM pos_counters c
      WHERE s.tenant_id = c.tenant_id AND s.counter_id IS NULL AND c.name = 'Counter 1';
    `.catch(() => {});

    // 6. POS Orders
    await sql`
      CREATE TABLE IF NOT EXISTS pos_orders (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        order_number VARCHAR(50) NOT NULL,
        invoice_id VARCHAR(50),
        shift_id INTEGER,
        counter_id INTEGER,
        counter_name VARCHAR(100),
        user_id INTEGER,
        user_name VARCHAR(150),
        customer_name VARCHAR(150) DEFAULT 'Walk-in Customer',
        customer_phone VARCHAR(50),
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
        amount_tendered NUMERIC(12, 2) DEFAULT 0,
        change_returned NUMERIC(12, 2) DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, order_number)
      );
    `;
    await sql`ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS counter_id INTEGER;`;
    await sql`ALTER TABLE pos_orders ADD COLUMN IF NOT EXISTS counter_name VARCHAR(100);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant_number ON pos_orders(tenant_id, order_number);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_orders_tenant_date ON pos_orders(tenant_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_orders_counter ON pos_orders(tenant_id, counter_id);`;

    // Migrate existing POS- orders to REC-
    await sql`
      UPDATE pos_orders
      SET order_number = 'REC-' || SUBSTRING(order_number FROM 5)
      WHERE order_number LIKE 'POS-%';
    `.catch(() => {});

    // 7. POS Promotions & Special Offers (Brand discounts, bundle offers, cross-item offers, spend discounts)
    await sql`
      CREATE TABLE IF NOT EXISTS pos_promotions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        type VARCHAR(50) NOT NULL, -- 'brand', 'bundle', 'item', 'cart'
        discount_type VARCHAR(20) NOT NULL DEFAULT 'percent', -- 'percent' or 'fixed'
        discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
        brand VARCHAR(100),
        trigger_item_id INTEGER,
        target_item_id INTEGER,
        min_quantity INTEGER DEFAULT 1,
        min_cart_total NUMERIC(12, 2) DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_pos_promotions_tenant ON pos_promotions(tenant_id, active);`;

    // 8. Add manager approval flag to promotions & POS access code to team members
    await sql`ALTER TABLE pos_promotions ADD COLUMN IF NOT EXISTS requires_manager_approval BOOLEAN DEFAULT FALSE;`;
    await sql`ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS pos_manager_code VARCHAR(50);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_admin_users_pos_code ON admin_users(tenant_id, pos_manager_code);`;

    // Auto-assign default manager code for owners/admins if not set
    await sql`
      UPDATE admin_users
      SET pos_manager_code = '123456'
      WHERE pos_manager_code IS NULL
        AND LOWER(role) IN ('owner', 'super admin');
    `;
    await sql`
      UPDATE admin_users
      SET pos_manager_code = 'MGR-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::text, 4, '0')
      WHERE pos_manager_code IS NULL
        AND LOWER(role) IN ('admin', 'manager');
    `;

    isInitialized = true;

    // Enable Row Level Security (RLS) on all POS & retail tables
    await sql`ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE pos_settings ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE pos_counters ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE pos_shifts ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE pos_orders ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE pos_promotions ENABLE ROW LEVEL SECURITY;`.catch(() => {});

    // Reconcile and clean up any orphan incomes tied to cancelled/voided invoices or POS orders
    await sql`
      DELETE FROM admin_incomes
      WHERE id IN (
        SELECT inc.id
        FROM admin_incomes inc
        LEFT JOIN invoices inv ON inc.invoice_id = inv.invoice_id AND inc.tenant_id = inv.tenant_id
        LEFT JOIN pos_orders po ON (inc.invoice_id = po.invoice_id OR inc.description = 'POS Sale #' || po.order_number) AND inc.tenant_id = po.tenant_id
        WHERE inv.payment_status IN ('cancelled', 'canceled', 'refunded', 'voided')
           OR po.status IN ('voided', 'refunded', 'cancelled')
      )
    `.catch(() => {});

    // Seed test stock for FT DEMO tenant if present
    await seedFtDemoTenantStock();
  } catch (err) {
    console.error("[POS DB Init] Error verifying or migrating schema:", err);
  } finally {
    posInitPromise = null;
  }
})();

  return posInitPromise;
}

/**
 * Seed realistic retail & POS test products exclusively for the FT DEMO workspace.
 * Idempotent: checks for existing SKUs before inserting so it never duplicates records.
 */
export async function seedFtDemoTenantStock(targetTenantId?: number) {
  try {
    let tenantIds: number[] = [];

    if (targetTenantId) {
      tenantIds = [targetTenantId];
    } else {
      const ftTenants = await sql`
        SELECT id FROM tenants 
        WHERE name ILIKE '%FT DEMO%' 
           OR name ILIKE '%FT%DEMO%'
      `;
      tenantIds = ftTenants.map((t: any) => t.id);
    }

    if (tenantIds.length === 0) return;

    const demoProducts = [
      {
        item_name: "Wireless Barcode Scanner 2.4G",
        category: "Electronics",
        sku: "FT-SCN-001",
        barcode: "2000000000018",
        cost_price: 6500.00,
        selling_price: 11500.00,
        purchase_price: 6500.00,
        quantity: 25,
        reorder_level: 5,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "High-speed laser barcode scanner with USB receiver",
      },
      {
        item_name: "Thermal Receipt Paper 80x80mm (Box of 50)",
        category: "Office Supplies",
        sku: "FT-PPR-002",
        barcode: "2000000000025",
        cost_price: 4200.00,
        selling_price: 7800.00,
        purchase_price: 4200.00,
        quantity: 50,
        reorder_level: 10,
        unit: "box",
        tax_rate: 0,
        status: "Available",
        notes: "BPA-free premium thermal paper rolls for POS printers",
      },
      {
        item_name: "Mechanical Keyboard RGB (Blue Switch)",
        category: "Computer Accessories",
        sku: "FT-KBD-003",
        barcode: "2000000000032",
        cost_price: 8500.00,
        selling_price: 14900.00,
        purchase_price: 8500.00,
        quantity: 18,
        reorder_level: 4,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "Hot-swappable mechanical keyboard with detachable Type-C cable",
      },
      {
        item_name: "Ergonomic Vertical Wireless Mouse",
        category: "Computer Accessories",
        sku: "FT-MOU-004",
        barcode: "2000000000049",
        cost_price: 3200.00,
        selling_price: 5900.00,
        purchase_price: 3200.00,
        quantity: 32,
        reorder_level: 6,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "Rechargeable 2.4GHz optical ergonomic mouse",
      },
      {
        item_name: "USB-C Multiport Hub 7-in-1",
        category: "Electronics",
        sku: "FT-HUB-005",
        barcode: "2000000000056",
        cost_price: 5400.00,
        selling_price: 9900.00,
        purchase_price: 5400.00,
        quantity: 15,
        reorder_level: 3,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "HDMI 4K, 100W PD charging, 3x USB 3.0, SD/TF card reader",
      },
      {
        item_name: "Bluetooth Desktop Label Printer",
        category: "Hardware",
        sku: "FT-PRN-006",
        barcode: "2000000000063",
        cost_price: 18500.00,
        selling_price: 29500.00,
        purchase_price: 18500.00,
        quantity: 10,
        reorder_level: 2,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "Direct thermal shipping label & SKU barcode printer",
      },
      {
        item_name: "Heavy Duty Cash Drawer (RJ11)",
        category: "Hardware",
        sku: "FT-CSH-007",
        barcode: "2000000000070",
        cost_price: 9500.00,
        selling_price: 16500.00,
        purchase_price: 9500.00,
        quantity: 8,
        reorder_level: 2,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "Reinforced steel casing with 5 bill slots and 8 coin compartments",
      },
      {
        item_name: "Fast Charging Cable 100W Braided 2M",
        category: "Accessories",
        sku: "FT-CBL-008",
        barcode: "2000000000087",
        cost_price: 1200.00,
        selling_price: 2400.00,
        purchase_price: 1200.00,
        quantity: 60,
        reorder_level: 15,
        unit: "pcs",
        tax_rate: 0,
        status: "Available",
        notes: "Nylon braided Type-C to Type-C durable charging cable",
      },
    ];

    for (const tId of tenantIds) {
      // Auto-activate POS add-on for FT DEMO workspace
      await sql`
        INSERT INTO tenant_addons (tenant_id, addon_key, status, price, purchased_at)
        VALUES (${tId}, 'pos', 'active', (SELECT COALESCE(price_monthly, 3000) FROM system_addons WHERE key = 'pos' LIMIT 1), NOW())
        ON CONFLICT (tenant_id, addon_key) DO UPDATE SET status = 'active'
      `.catch(() => {});

      // Ensure FT DEMO has workspace logo set
      await sql`
        UPDATE tenants
        SET logo_url = '/logos/ft/logo.png'
        WHERE id = ${tId} AND (logo_url IS NULL OR logo_url = '')
      `.catch(() => {});

      for (const prod of demoProducts) {
        // Check if SKU already exists for this tenant
        const existing = await sql`
          SELECT id FROM admin_inventory 
          WHERE tenant_id = ${tId} AND (sku = ${prod.sku} OR barcode = ${prod.barcode})
          LIMIT 1
        `;

        if (existing.length === 0) {
          const inserted = await sql`
            INSERT INTO admin_inventory (
              tenant_id, item_name, category, sku, barcode, cost_price, selling_price,
              purchase_price, quantity, reorder_level, unit, tax_rate, status, notes,
              created_at, updated_at
            ) VALUES (
              ${tId}, ${prod.item_name}, ${prod.category}, ${prod.sku}, ${prod.barcode},
              ${prod.cost_price}, ${prod.selling_price}, ${prod.purchase_price}, ${prod.quantity},
              ${prod.reorder_level}, ${prod.unit}, ${prod.tax_rate}, ${prod.status}, ${prod.notes},
              NOW(), NOW()
            )
            RETURNING id
          `;

          if (inserted.length > 0) {
            await sql`
              INSERT INTO stock_movements (
                tenant_id, inventory_id, change_qty, previous_qty, new_qty, reason,
                reference_type, reference_id, user_name, notes, created_at
              ) VALUES (
                ${tId}, ${inserted[0].id}, ${prod.quantity}, 0, ${prod.quantity}, 'initial',
                'manual', 'DEMO-SEED', 'System Seeder', 'Initial demo stock for FT DEMO', NOW()
              )
            `.catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.warn("[POS Seeder] seedFtDemoTenantStock notice:", err);
  }
}
