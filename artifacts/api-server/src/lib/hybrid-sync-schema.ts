import crypto from "node:crypto";
import { getOrCreatePersistentInstallationId } from "./hybrid-crypto";

export const HYBRID_DB_VERSION = "2.1.0";

export interface SyncTableConfig {
  table: string;
  pk: "id" | "key" | "role";
  naturalKey?: string | string[];
  immutableFinancial?: boolean;
  fkMap?: Record<string, string>;
}

/**
 * Strict topological order (parents before children) for safe bootstrap & delta application.
 */
export const SYNC_TABLES_ORDERED: SyncTableConfig[] = [
  // Tier 1: Settings, Branches, Roles, Users, Currencies
  { table: "settings", pk: "key", naturalKey: "key" },
  { table: "travel_system_settings", pk: "id" },
  { table: "document_print_settings", pk: "id" },
  { table: "document_numbering_config", pk: "id", naturalKey: "doc_type" },
  { table: "currencies", pk: "id", naturalKey: "code" },
  { table: "branches", pk: "id" },
  { table: "role_permissions", pk: "role", naturalKey: "role" },
  { table: "users", pk: "id", naturalKey: "username" },
  { table: "travel_4whatsapp_config", pk: "id" },
  { table: "travel_whatsapp_automation_config", pk: "id" },
  { table: "travel_notification_automations", pk: "id" },
  { table: "travel_notification_templates", pk: "id" },
  { table: "website_settings", pk: "id" },

  // Tier 2: Accounting COA, Safes, Banks, CRM, Catalogs
  { table: "accounts", pk: "id", naturalKey: "code" },
  { table: "safes", pk: "id", fkMap: { branch_id: "branches" } },
  { table: "bank_accounts", pk: "id" },
  { table: "cost_centers", pk: "id", naturalKey: "code" },
  { table: "categories", pk: "id" },
  { table: "products", pk: "id", naturalKey: "number", fkMap: { category_id: "categories" } },
  { table: "customers", pk: "id" },
  { table: "suppliers", pk: "id" },
  { table: "travel_suppliers", pk: "id", naturalKey: "supplier_code" },
  { table: "travel_airlines", pk: "id" },
  { table: "travel_airports", pk: "id" },
  { table: "travel_hotels_db", pk: "id" },
  { table: "travel_visa_types", pk: "id" },
  { table: "travel_transport_companies", pk: "id" },
  { table: "hr_departments", pk: "id" },
  { table: "hr_employees", pk: "id", fkMap: { department_id: "hr_departments", branch_id: "branches" } },

  // Tier 3: Travel Operational Records, POS, Bookings, Visas, Hotels, Passengers
  {
    table: "travel_passengers",
    pk: "id",
    fkMap: { customer_id: "customers" },
  },
  {
    table: "travel_visas",
    pk: "id",
    naturalKey: "visa_number",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers", supplier_id: "travel_suppliers" },
  },
  {
    table: "travel_bookings",
    pk: "id",
    naturalKey: "booking_number",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers", branch_id: "branches" },
  },
  {
    table: "travel_bus_bookings",
    pk: "id",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers", supplier_id: "travel_suppliers" },
  },
  {
    table: "travel_hotels",
    pk: "id",
    naturalKey: "booking_ref",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers", supplier_id: "travel_suppliers" },
  },
  {
    table: "travel_packages",
    pk: "id",
    fkMap: { customer_id: "customers" },
  },
  {
    table: "travel_transports",
    pk: "id",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers" },
  },
  {
    table: "travel_insurances",
    pk: "id",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers" },
  },
  {
    table: "travel_ticket_refunds",
    pk: "id",
    fkMap: { booking_id: "travel_bookings", customer_id: "customers" },
  },
  {
    table: "travel_booking_modifications",
    pk: "id",
    fkMap: { booking_id: "travel_bookings", customer_id: "customers" },
  },
  {
    table: "travel_documents",
    pk: "id",
    fkMap: { customer_id: "customers", passenger_id: "travel_passengers", booking_id: "travel_bookings", visa_id: "travel_visas" },
  },
  { table: "travel_attachments", pk: "id" },
  {
    table: "travel_tasks",
    pk: "id",
    naturalKey: "task_code",
    fkMap: { assigned_to_user_id: "users", branch_id: "branches" },
  },
  {
    table: "travel_quotations",
    pk: "id",
    fkMap: { customer_id: "customers" },
  },
  {
    table: "travel_quotation_items",
    pk: "id",
    fkMap: { quotation_id: "travel_quotations" },
  },

  // Tier 4: Invoicing, Commissions, Journal Entries, Vouchers, Expenses
  {
    table: "travel_invoices",
    pk: "id",
    naturalKey: "invoice_number",
    immutableFinancial: true,
    fkMap: { customer_id: "customers", branch_id: "branches", user_id: "users", journal_entry_id: "journal_entries" },
  },
  {
    table: "travel_invoice_items",
    pk: "id",
    immutableFinancial: true,
    fkMap: { invoice_id: "travel_invoices" },
  },
  {
    table: "travel_commissions",
    pk: "id",
    naturalKey: "commission_code",
    fkMap: { customer_id: "customers", supplier_id: "travel_suppliers", agent_user_id: "users" },
  },
  {
    table: "orders",
    pk: "id",
    immutableFinancial: true,
    fkMap: { customer_id: "customers", user_id: "users", safe_id: "safes" },
  },
  {
    table: "order_items",
    pk: "id",
    immutableFinancial: true,
    fkMap: { order_id: "orders", category_id: "categories" },
  },
  {
    table: "returns",
    pk: "id",
    immutableFinancial: true,
    fkMap: { order_id: "orders", user_id: "users" },
  },
  {
    table: "return_items",
    pk: "id",
    immutableFinancial: true,
    fkMap: { return_id: "returns" },
  },
  {
    table: "journal_entries",
    pk: "id",
    naturalKey: "entry_number",
    immutableFinancial: true,
    fkMap: { user_id: "users", cost_center_id: "cost_centers" },
  },
  {
    table: "journal_entry_lines",
    pk: "id",
    immutableFinancial: true,
    fkMap: { journal_entry_id: "journal_entries", account_id: "accounts", cost_center_id: "cost_centers" },
  },
  {
    table: "vouchers",
    pk: "id",
    naturalKey: "voucher_number",
    immutableFinancial: true,
    fkMap: { safe_id: "safes", bank_account_id: "bank_accounts", cost_center_id: "cost_centers" },
  },
  {
    table: "expenses",
    pk: "id",
    immutableFinancial: true,
    fkMap: { user_id: "users", safe_id: "safes", cost_center_id: "cost_centers", bank_account_id: "bank_accounts", account_id: "accounts", branch_id: "branches", employee_id: "hr_employees" },
  },
  {
    table: "safe_transactions",
    pk: "id",
    immutableFinancial: true,
    fkMap: { safe_id: "safes" },
  },
  {
    table: "supplier_payments",
    pk: "id",
    immutableFinancial: true,
    fkMap: { supplier_id: "suppliers" },
  },
  {
    table: "travel_supplier_payments",
    pk: "id",
    immutableFinancial: true,
    fkMap: { supplier_id: "travel_suppliers" },
  },
  {
    table: "hr_attendance",
    pk: "id",
    fkMap: { employee_id: "hr_employees" },
  },
  {
    table: "hr_loans",
    pk: "id",
    fkMap: { employee_id: "hr_employees" },
  },
  {
    table: "hr_leaves",
    pk: "id",
    fkMap: { employee_id: "hr_employees" },
  },
  {
    table: "hr_salaries",
    pk: "id",
    fkMap: { employee_id: "hr_employees" },
  },
];

export const SYNC_TABLE_MAP = new Map<string, SyncTableConfig>(
  SYNC_TABLES_ORDERED.map((t) => [t.table, t])
);

export const IMMUTABLE_FINANCIAL_TABLES = new Set<string>(
  SYNC_TABLES_ORDERED.filter((t) => t.immutableFinancial).map((t) => t.table)
);

function tableExists(targetDb: any, tableName: string): boolean {
  const row = targetDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row?.name);
}

function getTableColumns(targetDb: any, tableName: string): string[] {
  const rows = targetDb.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

/**
 * Build SQLite JSON expression safely respecting SQLite's 127-argument limit per function call.
 * Chunks columns in groups of 40 and nests json_set(json_object(...), ...).
 */
function buildSqliteRowJsonExpr(cols: string[], rowPrefix: string): string {
  if (cols.length === 0) return "json_object()";
  const firstChunk = cols.slice(0, 40);
  const argsForFirst = firstChunk
    .map((c) => `'${c.replace(/'/g, "''")}', ${rowPrefix}"${c}"`)
    .join(", ");
  let expr = `json_object(${argsForFirst})`;

  for (let i = 40; i < cols.length; i += 40) {
    const chunk = cols.slice(i, i + 40);
    const setArgs = chunk
      .map((c) => `'$.${c.replace(/'/g, "''")}', ${rowPrefix}"${c}"`)
      .join(", ");
    expr = `json_set(${expr}, ${setArgs})`;
  }
  return expr;
}

export function initHybridCoreTables(targetDb: any, dbDir: string, defaultTenantId = 1): void {
  const mode =
    process.env.OMNIFLY_MODE === "local" || process.env.OMNIFLY_MODE === "cloud"
      ? process.env.OMNIFLY_MODE
      : "cloud";
  const installationId = getOrCreatePersistentInstallationId(dbDir);

  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS cloud_tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_code TEXT UNIQUE NOT NULL,
      company_name TEXT NOT NULL,
      package_name TEXT NOT NULL DEFAULT 'enterprise',
      subscription_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'expired', 'trial'
      license_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'expired'
      license_key TEXT UNIQUE,
      license_start_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
      license_expires_at TEXT NOT NULL DEFAULT '2027-12-31',
      max_users INTEGER NOT NULL DEFAULT 25,
      max_devices INTEGER NOT NULL DEFAULT 5,
      allow_local_desktop INTEGER NOT NULL DEFAULT 1,
      offline_grace_hours INTEGER NOT NULL DEFAULT 72,
      enforce_clock_guard INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS tenant_installations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES cloud_tenants(id) ON DELETE CASCADE,
      installation_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      cloud_account_id TEXT,
      username TEXT,
      device_name TEXT,
      os_info TEXT,
      app_version TEXT DEFAULT '1.1.0',
      db_version TEXT DEFAULT '${HYBRID_DB_VERSION}',
      mode TEXT NOT NULL DEFAULT 'local', -- 'cloud' | 'local'
      status TEXT NOT NULL DEFAULT 'authorized', -- 'authorized' | 'blocked' | 'revoked'
      sync_token_hash TEXT,
      last_successful_sync TEXT,
      last_downloaded_seq INTEGER NOT NULL DEFAULT 0,
      last_uploaded_seq INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'Connected',
      license_status TEXT NOT NULL DEFAULT 'active',
      last_seen_at TEXT DEFAULT (datetime('now', 'localtime')),
      registered_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(tenant_id, installation_id)
    );

    CREATE TABLE IF NOT EXISTS sync_runtime_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      mode TEXT NOT NULL DEFAULT '${mode}',
      cloud_server_url TEXT DEFAULT '',
      installation_id TEXT NOT NULL,
      device_id TEXT DEFAULT '',
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      tenant_code TEXT DEFAULT 'OMNI-MAIN',
      company_name TEXT DEFAULT '',
      cloud_account_id TEXT DEFAULT '',
      encrypted_sync_token TEXT DEFAULT '',
      encrypted_license_snapshot TEXT DEFAULT '',
      is_bootstrapped INTEGER NOT NULL DEFAULT 0,
      auto_sync_enabled INTEGER NOT NULL DEFAULT 1,
      auto_sync_interval_sec INTEGER NOT NULL DEFAULT 30,
      last_successful_sync TEXT,
      last_downloaded_seq INTEGER NOT NULL DEFAULT 0,
      last_uploaded_seq INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'Connected',
      last_error TEXT DEFAULT '',
      db_version TEXT NOT NULL DEFAULT '${HYBRID_DB_VERSION}',
      app_version TEXT NOT NULL DEFAULT '1.1.0',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sync_internal_guard (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      suppress INTEGER NOT NULL DEFAULT 0,
      source_env TEXT NOT NULL DEFAULT '${mode}',
      installation_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sync_change_log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_op_id TEXT UNIQUE NOT NULL,
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      sync_uuid TEXT NOT NULL,
      operation TEXT NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
      record_version INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL,
      previous_json TEXT,
      fk_uuids_json TEXT,
      source_env TEXT NOT NULL DEFAULT '${mode}',
      installation_id TEXT DEFAULT '',
      synced INTEGER NOT NULL DEFAULT 0,
      sync_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sync_changelog_tenant_seq ON sync_change_log(tenant_id, seq);
    CREATE INDEX IF NOT EXISTS idx_sync_changelog_pending ON sync_change_log(synced, seq);
    CREATE INDEX IF NOT EXISTS idx_sync_changelog_uuid ON sync_change_log(table_name, sync_uuid);

    CREATE TABLE IF NOT EXISTS sync_applied_ops (
      sync_op_id TEXT PRIMARY KEY,
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      table_name TEXT NOT NULL,
      sync_uuid TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      table_name TEXT NOT NULL,
      record_id TEXT,
      sync_uuid TEXT NOT NULL,
      conflict_reason TEXT DEFAULT 'concurrent_edit',
      local_version INTEGER DEFAULT 1,
      cloud_version INTEGER DEFAULT 1,
      local_payload_json TEXT NOT NULL,
      cloud_payload_json TEXT NOT NULL,
      base_payload_json TEXT,
      conflict_fields_json TEXT NOT NULL,
      auto_merged_fields_json TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'resolved_cloud' | 'resolved_local' | 'resolved_merged'
      resolution_note TEXT,
      resolved_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tenant_status ON sync_conflicts(tenant_id, status);

    CREATE TABLE IF NOT EXISTS sync_file_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      file_uuid TEXT UNIQUE NOT NULL,
      relative_path TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      checksum_sha256 TEXT,
      file_size INTEGER DEFAULT 0,
      direction TEXT NOT NULL DEFAULT 'upload', -- 'upload' | 'download'
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'synced' | 'failed'
      error_message TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId},
      installation_id TEXT DEFAULT '',
      direction TEXT NOT NULL, -- 'push' | 'pull' | 'bidirectional' | 'bootstrap' | 'conflict'
      status TEXT NOT NULL, -- 'success' | 'partial' | 'conflict' | 'failed' | 'blocked'
      downloaded_count INTEGER NOT NULL DEFAULT 0,
      uploaded_count INTEGER NOT NULL DEFAULT 0,
      files_synced INTEGER NOT NULL DEFAULT 0,
      conflicts_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Ensure singleton guard & runtime config
  targetDb
    .prepare(
      `INSERT OR IGNORE INTO sync_internal_guard (id, suppress, source_env, installation_id) VALUES (1, 0, ?, ?)`
    )
    .run(mode, installationId);

  targetDb
    .prepare(
      `UPDATE sync_internal_guard SET suppress = 0, source_env = ?, installation_id = ? WHERE id = 1`
    )
    .run(mode, installationId);

  const existingCfg = targetDb
    .prepare("SELECT * FROM sync_runtime_config WHERE id = 1")
    .get() as any;

  if (!existingCfg) {
    targetDb
      .prepare(
        `INSERT INTO sync_runtime_config (
          id, mode, cloud_server_url, installation_id, tenant_id, tenant_code, db_version, is_bootstrapped
        ) VALUES (1, ?, ?, ?, ?, 'OMNI-MAIN', ?, ?)`
      )
      .run(
        mode,
        process.env.OMNIFLY_CLOUD_URL || "",
        installationId,
        defaultTenantId,
        HYBRID_DB_VERSION,
        mode === "cloud" ? 1 : 0
      );
  } else {
    // Only override mode if explicitly specified via env var
    const effectiveMode =
      process.env.OMNIFLY_MODE === "local" || process.env.OMNIFLY_MODE === "cloud"
        ? process.env.OMNIFLY_MODE
        : existingCfg.mode;
    const effectiveCloudUrl =
      process.env.OMNIFLY_CLOUD_URL !== undefined && process.env.OMNIFLY_CLOUD_URL !== ""
        ? process.env.OMNIFLY_CLOUD_URL
        : existingCfg.cloud_server_url;
    targetDb
      .prepare(
        `UPDATE sync_runtime_config SET mode = ?, cloud_server_url = ?, installation_id = ?, db_version = ? WHERE id = 1`
      )
      .run(effectiveMode, effectiveCloudUrl || "", installationId, HYBRID_DB_VERSION);
  }

  // Ensure users & user_tokens tables in master/tenant DB also carry tenant_id
  if (tableExists(targetDb, "users")) {
    const userCols = getTableColumns(targetDb, "users");
    if (!userCols.includes("tenant_id")) {
      try {
        targetDb.exec(`ALTER TABLE users ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId}`);
      } catch {}
    }
  }
  if (tableExists(targetDb, "user_tokens")) {
    const tokenCols = getTableColumns(targetDb, "user_tokens");
    if (!tokenCols.includes("tenant_id")) {
      try {
        targetDb.exec(`ALTER TABLE user_tokens ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId}`);
      } catch {}
    }
  }

  // Seed default Tenant #1 from existing active license or company setting if cloud_tenants is empty
  try {
    const tCount = (targetDb.prepare("SELECT COUNT(*) as c FROM cloud_tenants").get() as any)?.c || 0;
    if (tCount === 0) {
      let companyName = "المؤسسة الرئيسية - OmniFly Pro";
      let expiresAt = "2027-12-31";
      let licStatus = "active";
      let maxDevices = 50;
      let licKey = `TENANT-MAIN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      if (tableExists(targetDb, "settings")) {
        const sRow = targetDb.prepare("SELECT value FROM settings WHERE key='businessName'").get() as any;
        if (sRow?.value) companyName = String(sRow.value);
      }
      if (tableExists(targetDb, "licenses")) {
        const lRow = targetDb.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get() as any;
        if (lRow) {
          companyName = lRow.client_name || companyName;
          expiresAt = lRow.expires_at || expiresAt;
          licStatus = lRow.status || (lRow.active === 0 ? "suspended" : "active");
          maxDevices = Math.max(5, Number(lRow.devices_limit) || 50);
          licKey = lRow.license_key || licKey;
        }
      }

      targetDb
        .prepare(
          `INSERT INTO cloud_tenants (
            id, tenant_code, company_name, package_name, subscription_status, license_status,
            license_key, license_start_date, license_expires_at, max_users, max_devices, allow_local_desktop, offline_grace_hours, notes
          ) VALUES (?, 'OMNI-MAIN', ?, 'enterprise', ?, ?, ?, date('now', 'localtime'), ?, 100, ?, 1, 72, 'المؤسسة الرئيسية الافتراضية')`
        )
        .run(defaultTenantId, companyName, licStatus, licStatus, licKey, expiresAt, maxDevices);
    }
  } catch (err) {
    console.warn("[HybridSync] Tenant seed note:", (err as any)?.message);
  }
}

/**
 * Ensures sync metadata columns (tenant_id, sync_uuid, record_version, sync_updated_at),
 * backfills existing rows, and installs AFTER INSERT/UPDATE/DELETE change-tracking triggers.
 */
export function ensureSyncMetadataAndTriggers(
  targetDb: any,
  defaultTenantId = 1,
  recreateTriggers = true
): void {
  // Temporarily suppress triggers while backfilling columns & UUIDs
  try {
    targetDb.prepare("UPDATE sync_internal_guard SET suppress = 1 WHERE id = 1").run();
  } catch {}

  try {
    for (const cfg of SYNC_TABLES_ORDERED) {
      const tName = cfg.table;
      if (!tableExists(targetDb, tName)) continue;

      let cols = getTableColumns(targetDb, tName);
      let altered = false;

      if (!cols.includes("tenant_id")) {
        try {
          targetDb.exec(`ALTER TABLE "${tName}" ADD COLUMN tenant_id INTEGER NOT NULL DEFAULT ${defaultTenantId}`);
          altered = true;
        } catch {}
      }
      if (!cols.includes("sync_uuid")) {
        try {
          targetDb.exec(`ALTER TABLE "${tName}" ADD COLUMN sync_uuid TEXT`);
          altered = true;
        } catch {}
      }
      if (!cols.includes("record_version")) {
        try {
          targetDb.exec(`ALTER TABLE "${tName}" ADD COLUMN record_version INTEGER NOT NULL DEFAULT 1`);
          altered = true;
        } catch {}
      }
      if (!cols.includes("sync_updated_at")) {
        try {
          targetDb.exec(`ALTER TABLE "${tName}" ADD COLUMN sync_updated_at TEXT`);
          altered = true;
        } catch {}
      }

      if (altered) {
        cols = getTableColumns(targetDb, tName);
      }

      // Unique index on sync_uuid per table for O(1) sync lookups
      try {
        targetDb.exec(`CREATE INDEX IF NOT EXISTS "idx_${tName}_sync_uuid" ON "${tName}"(sync_uuid)`);
        targetDb.exec(`CREATE INDEX IF NOT EXISTS "idx_${tName}_tenant_id" ON "${tName}"(tenant_id)`);
      } catch {}

      // Backfill existing rows missing sync_uuid
      try {
        const missing = targetDb
          .prepare(`SELECT COUNT(*) as c FROM "${tName}" WHERE sync_uuid IS NULL OR sync_uuid = ''`)
          .get() as { c: number };
        if (missing?.c > 0) {
          targetDb
            .prepare(
              `UPDATE "${tName}"
               SET sync_uuid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
                   tenant_id = COALESCE(NULLIF(tenant_id, 0), ?),
                   record_version = COALESCE(record_version, 1),
                   sync_updated_at = COALESCE(sync_updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
               WHERE sync_uuid IS NULL OR sync_uuid = ''`
            )
            .run(defaultTenantId);
        }
      } catch {}

      if (recreateTriggers) {
        const pkExpr = cols.includes("id")
          ? "CAST(id AS TEXT)"
          : cols.includes("key")
          ? "CAST(\"key\" AS TEXT)"
          : cols.includes("role")
          ? "CAST(\"role\" AS TEXT)"
          : "CAST(rowid AS TEXT)";

        const oldPkExpr = cols.includes("id")
          ? "CAST(OLD.id AS TEXT)"
          : cols.includes("key")
          ? "CAST(OLD.\"key\" AS TEXT)"
          : cols.includes("role")
          ? "CAST(OLD.\"role\" AS TEXT)"
          : "CAST(OLD.rowid AS TEXT)";

        const newJsonExpr = buildSqliteRowJsonExpr(cols, "t.");
        const oldJsonExpr = buildSqliteRowJsonExpr(cols, "OLD.");

        targetDb.exec(`DROP TRIGGER IF EXISTS "trg_sync_ins_${tName}"`);
        targetDb.exec(`DROP TRIGGER IF EXISTS "trg_sync_upd_${tName}"`);
        targetDb.exec(`DROP TRIGGER IF EXISTS "trg_sync_del_${tName}"`);

        targetDb.exec(`
          CREATE TRIGGER "trg_sync_ins_${tName}" AFTER INSERT ON "${tName}"
          WHEN COALESCE((SELECT suppress FROM sync_internal_guard WHERE id = 1), 0) = 0
          BEGIN
            UPDATE "${tName}"
            SET sync_uuid = COALESCE(NULLIF(sync_uuid, ''), lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))),
                tenant_id = COALESCE(NULLIF(tenant_id, 0), COALESCE((SELECT tenant_id FROM sync_runtime_config WHERE id = 1), ${defaultTenantId})),
                record_version = COALESCE(record_version, 1),
                sync_updated_at = COALESCE(sync_updated_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            WHERE rowid = NEW.rowid;

            INSERT INTO sync_change_log (
              sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
              payload_json, source_env, installation_id, synced
            )
            SELECT
              lower(hex(randomblob(16))),
              COALESCE(t.tenant_id, ${defaultTenantId}),
              '${tName}',
              ${pkExpr.replace(/^CAST\(/, "CAST(t.")},
              t.sync_uuid,
              'INSERT',
              COALESCE(t.record_version, 1),
              ${newJsonExpr},
              COALESCE((SELECT source_env FROM sync_internal_guard WHERE id = 1), 'local'),
              COALESCE((SELECT installation_id FROM sync_internal_guard WHERE id = 1), ''),
              0
            FROM "${tName}" t
            WHERE t.rowid = NEW.rowid;
          END;
        `);

        targetDb.exec(`
          CREATE TRIGGER "trg_sync_upd_${tName}" AFTER UPDATE ON "${tName}"
          WHEN COALESCE((SELECT suppress FROM sync_internal_guard WHERE id = 1), 0) = 0
          BEGIN
            UPDATE "${tName}"
            SET sync_uuid = COALESCE(NULLIF(sync_uuid, ''), lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6)))),
                record_version = COALESCE(OLD.record_version, 1) + 1,
                sync_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE rowid = NEW.rowid;

            INSERT INTO sync_change_log (
              sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
              payload_json, previous_json, source_env, installation_id, synced
            )
            SELECT
              lower(hex(randomblob(16))),
              COALESCE(t.tenant_id, ${defaultTenantId}),
              '${tName}',
              ${pkExpr.replace(/^CAST\(/, "CAST(t.")},
              t.sync_uuid,
              'UPDATE',
              COALESCE(OLD.record_version, 1) + 1,
              ${newJsonExpr},
              ${oldJsonExpr},
              COALESCE((SELECT source_env FROM sync_internal_guard WHERE id = 1), 'local'),
              COALESCE((SELECT installation_id FROM sync_internal_guard WHERE id = 1), ''),
              0
            FROM "${tName}" t
            WHERE t.rowid = NEW.rowid;
          END;
        `);

        targetDb.exec(`
          CREATE TRIGGER "trg_sync_del_${tName}" AFTER DELETE ON "${tName}"
          WHEN COALESCE((SELECT suppress FROM sync_internal_guard WHERE id = 1), 0) = 0
          BEGIN
            INSERT INTO sync_change_log (
              sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
              payload_json, previous_json, source_env, installation_id, synced
            )
            VALUES (
              lower(hex(randomblob(16))),
              COALESCE(OLD.tenant_id, ${defaultTenantId}),
              '${tName}',
              ${oldPkExpr},
              COALESCE(NULLIF(OLD.sync_uuid, ''), '${tName}:' || ${oldPkExpr}),
              'DELETE',
              COALESCE(OLD.record_version, 1) + 1,
              json_object('deleted', 1),
              ${oldJsonExpr},
              COALESCE((SELECT source_env FROM sync_internal_guard WHERE id = 1), 'local'),
              COALESCE((SELECT installation_id FROM sync_internal_guard WHERE id = 1), ''),
              0
            );
          END;
        `);
      }
    }
  } finally {
    try {
      targetDb.prepare("UPDATE sync_internal_guard SET suppress = 0 WHERE id = 1").run();
    } catch {}
  }
}
