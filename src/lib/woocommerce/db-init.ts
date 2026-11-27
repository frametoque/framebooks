import sql from "@/lib/db";

let isWooSchemaInitialized = false;
let wooInitPromise: Promise<void> | null = null;

export async function ensureWooCommerceSchema() {
  if (isWooSchemaInitialized) return;
  if (wooInitPromise) return wooInitPromise;

  wooInitPromise = (async () => {
    try {
    // 1. Tenant-scoped WooCommerce Connections Table
    await sql`
      CREATE TABLE IF NOT EXISTS woocommerce_connections (
        tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        store_url TEXT NOT NULL,
        encrypted_key TEXT NOT NULL,
        encrypted_secret TEXT NOT NULL,
        key_version VARCHAR(10) NOT NULL DEFAULT 'v1',
        webhook_secret TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'connected',
        created_by INTEGER,
        last_sync_at TIMESTAMP WITH TIME ZONE,
        sync_settings JSONB DEFAULT '{"conflict_winner": "newest_wins", "sync_price": false, "sync_title": false, "auto_import_products": false, "post_online_orders": false}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_conn_tenant ON woocommerce_connections(tenant_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_conn_status ON woocommerce_connections(status);`;

    // 2. Tenant-scoped Product & Variation Mapping Table
    await sql`
      CREATE TABLE IF NOT EXISTS woocommerce_product_mappings (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        inventory_id INTEGER NOT NULL REFERENCES admin_inventory(id) ON DELETE CASCADE,
        woo_product_id BIGINT NOT NULL,
        woo_variation_id BIGINT DEFAULT 0,
        woo_sku VARCHAR(100),
        last_synced_stock NUMERIC(12, 2) DEFAULT 0,
        content_hash VARCHAR(64),
        sync_status VARCHAR(20) DEFAULT 'synced',
        last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, inventory_id),
        UNIQUE(tenant_id, woo_product_id, woo_variation_id)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_map_tenant_sku ON woocommerce_product_mappings(tenant_id, woo_sku);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_map_tenant_inv ON woocommerce_product_mappings(tenant_id, inventory_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_map_tenant_woo_prod ON woocommerce_product_mappings(tenant_id, woo_product_id, woo_variation_id);`;

    // 3. Tenant-scoped Sync Logs Table
    await sql`
      CREATE TABLE IF NOT EXISTS woocommerce_sync_logs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        direction VARCHAR(20) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100),
        status VARCHAR(20) NOT NULL,
        details TEXT,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_logs_tenant_date ON woocommerce_sync_logs(tenant_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_logs_tenant_status ON woocommerce_sync_logs(tenant_id, status);`;

    // 4. Webhook Idempotency Table
    await sql`
      CREATE TABLE IF NOT EXISTS woocommerce_idempotency_keys (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        idempotency_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, idempotency_key)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_idemp_tenant_key ON woocommerce_idempotency_keys(tenant_id, idempotency_key);`;

    // 5. Job Queue Table
    await sql`
      CREATE TABLE IF NOT EXISTS integration_sync_jobs (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        job_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        status VARCHAR(20) DEFAULT 'pending',
        last_error TEXT,
        scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status ON integration_sync_jobs(tenant_id, status, scheduled_at);`;

    // 6. Registered Webhooks Status Table (Tracks order.created, order.updated, product.updated in Woo)
    await sql`
      CREATE TABLE IF NOT EXISTS woocommerce_registered_webhooks (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        topic VARCHAR(50) NOT NULL,
        woo_webhook_id BIGINT,
        delivery_url TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(tenant_id, topic)
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_woo_webhooks_tenant ON woocommerce_registered_webhooks(tenant_id);`;

    // Enable Row Level Security (RLS) on all WooCommerce tables
    await sql`ALTER TABLE woocommerce_connections ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE woocommerce_product_mappings ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE woocommerce_sync_logs ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE woocommerce_idempotency_keys ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;`.catch(() => {});
    await sql`ALTER TABLE woocommerce_registered_webhooks ENABLE ROW LEVEL SECURITY;`.catch(() => {});

    isWooSchemaInitialized = true;
  } catch (err) {
    console.error("[WooCommerce Schema Init Error]", err);
    throw err;
  } finally {
    wooInitPromise = null;
  }
})();

  return wooInitPromise;
}
