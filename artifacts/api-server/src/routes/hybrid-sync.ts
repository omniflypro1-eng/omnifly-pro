import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  masterDb,
  getTenantDb,
  getTenantDbPath,
  getActiveDatabasePath,
  createTenantDatabase,
  deleteTenantDatabase,
  revokeTenantSessions,
  revokeUserSessions,
  hashPassword,
  isLocalDesktopMode,
  getDbDir,
} from "../lib/sqlite";
import { getAuthUser, getSystemDeviceId, CURRENT_SYSTEM_VERSION } from "./auth";
import {
  authenticateDesktopLoginOnCloud,
  verifyCloudDeviceToken,
  exportTenantBootstrapSnapshot,
  processCloudPushBatch,
  pullCloudDeltasForTenant,
  getLocalSyncStatusSummary,
  runBidirectionalSync,
  resolveSyncConflictRecord,
  getTenantPolicyStatus,
  applyBootstrapSnapshotLocally,
} from "../lib/sync-engine";
import { HYBRID_DB_VERSION } from "../lib/hybrid-sync-schema";
import { computeBufferSha256, decryptHybridSecret, getOrCreatePersistentInstallationId } from "../lib/hybrid-crypto";

const router = Router();

function requireDeveloper(req: any, res: any): any | null {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "تسجيل الدخول مطلوب" });
    return null;
  }
  const isDev = user.role === "developer" || user.username?.toLowerCase() === "developer";
  if (!isDev) {
    res.status(403).json({ error: "هذه اللوحة والعمليات مخصصة لحساب مطور النظام فقط" });
    return null;
  }
  return user;
}

function resolveTenantUploadDir(tenantId: number): string {
  const base = path.resolve(process.cwd(), "public/uploads");
  if (tenantId <= 1) return base;
  return path.join(base, "tenants", String(tenantId));
}

function getExistingTenantDb(tenantId: number) {
  if (tenantId <= 1) return masterDb;
  const tPath = getTenantDbPath(tenantId);
  if (!fs.existsSync(tPath)) return null;
  try {
    return getTenantDb(tenantId, true);
  } catch {
    return null;
  }
}

function safeTableCount(targetDb: any, sql: string, ...params: any[]): number {
  if (!targetDb) return 0;
  try {
    const row = targetDb.prepare(sql).get(...params) as { c?: number } | undefined;
    return Number(row?.c || 0);
  } catch {
    return 0;
  }
}

function getTenantDbSizeBytes(tenantId: number): number {
  try {
    const targetPath = tenantId <= 1 ? getActiveDatabasePath() : getTenantDbPath(tenantId);
    if (fs.existsSync(targetPath)) {
      return fs.statSync(targetPath).size;
    }
  } catch {}
  return 0;
}

function collectTenantOperationalMetrics(tenantId: number) {
  const tDb = getExistingTenantDb(tenantId);
  if (!tDb) {
    return {
      travel_bookings: 0,
      travel_visas: 0,
      travel_passengers: 0,
      travel_hotels: 0,
      travel_bus_bookings: 0,
      orders: 0,
      customers: 0,
      suppliers: 0,
      journal_entries: 0,
      pending_conflicts: 0,
      active_web_sessions: 0,
    };
  }
  return {
    travel_bookings: safeTableCount(tDb, "SELECT COUNT(*) as c FROM travel_bookings"),
    travel_visas: safeTableCount(tDb, "SELECT COUNT(*) as c FROM travel_visas"),
    travel_passengers: safeTableCount(tDb, "SELECT COUNT(*) as c FROM travel_passengers"),
    travel_hotels: safeTableCount(tDb, "SELECT COUNT(*) as c FROM travel_hotels"),
    travel_bus_bookings: safeTableCount(tDb, "SELECT COUNT(*) as c FROM travel_bus_bookings"),
    orders: safeTableCount(tDb, "SELECT COUNT(*) as c FROM orders"),
    customers: safeTableCount(tDb, "SELECT COUNT(*) as c FROM customers"),
    suppliers: safeTableCount(tDb, "SELECT COUNT(*) as c FROM suppliers"),
    journal_entries: safeTableCount(tDb, "SELECT COUNT(*) as c FROM journal_entries"),
    pending_conflicts: safeTableCount(tDb, "SELECT COUNT(*) as c FROM sync_conflicts WHERE status = 'pending'"),
    active_web_sessions: safeTableCount(tDb, "SELECT COUNT(*) as c FROM erp_sessions WHERE status = 'نشط'"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DEVELOPER MULTI-TENANT & DEVICE GOVERNANCE PORTAL
// ─────────────────────────────────────────────────────────────────────────────

router.get("/developer/tenants", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenants = masterDb.prepare("SELECT * FROM cloud_tenants ORDER BY id DESC").all() as any[];

  const enriched = tenants.map((t) => {
    const installations = masterDb
      .prepare(
        `SELECT id, tenant_id, installation_id, device_id, cloud_account_id, username, device_name, os_info,
                app_version, db_version, mode, status, last_successful_sync, last_downloaded_seq,
                last_uploaded_seq, sync_status, license_status, last_seen_at, registered_at
         FROM tenant_installations
         WHERE tenant_id = ?
         ORDER BY id DESC`
      )
      .all(t.id) as any[];

    const tDb = getExistingTenantDb(t.id);
    const masterUsersCount =
      (
        masterDb
          .prepare("SELECT COUNT(*) as c FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer'")
          .get(t.id) as { c: number }
      )?.c || 0;
    const tenantUsersCount =
      t.id > 1 && tDb
        ? safeTableCount(tDb, "SELECT COUNT(*) as c FROM users WHERE LOWER(username) != 'developer'")
        : masterUsersCount;

    const adminUser = masterDb
      .prepare("SELECT id, username, name, role, active FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer' ORDER BY id ASC LIMIT 1")
      .get(t.id) as any;

    const policy = getTenantPolicyStatus(t);
    const authorizedDevs = installations.filter((i) => i.status === "authorized").length;
    const blockedDevs = installations.filter((i) => i.status !== "authorized").length;
    const lastSyncAt =
      installations
        .map((i) => i.last_successful_sync)
        .filter(Boolean)
        .sort()
        .reverse()[0] || null;

    const metrics = collectTenantOperationalMetrics(t.id);

    return {
      ...t,
      users_count: Math.max(masterUsersCount, tenantUsersCount),
      admin_username: adminUser?.username || "",
      active_devices_count: authorizedDevs,
      blocked_devices_count: blockedDevs,
      total_devices_count: installations.length,
      last_sync_at: lastSyncAt,
      db_size_bytes: getTenantDbSizeBytes(t.id),
      stats: metrics,
      installations,
      effective_policy: policy,
    };
  });

  res.json(enriched);
});

router.get("/developer/tenants/:id/details", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const tenant = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!tenant) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }

  const installations = masterDb
    .prepare(
      `SELECT id, tenant_id, installation_id, device_id, cloud_account_id, username, device_name, os_info,
              app_version, db_version, mode, status, last_successful_sync, last_downloaded_seq,
              last_uploaded_seq, sync_status, license_status, last_seen_at, registered_at
       FROM tenant_installations
       WHERE tenant_id = ?
       ORDER BY id DESC`
    )
    .all(tenantId) as any[];

  const tDb = getExistingTenantDb(tenantId);
  let users: any[] = [];
  if (tenantId === 1) {
    users = masterDb
      .prepare(
        `SELECT id, username, name, role, active, email, phone, status, full_name
         FROM users
         WHERE COALESCE(tenant_id, 1) = 1 AND LOWER(username) != 'developer'
         ORDER BY id ASC`
      )
      .all() as any[];
  } else if (tDb) {
    try {
      users = tDb
        .prepare(
          `SELECT id, username, name, role, active, email, phone, status, full_name
           FROM users
           WHERE LOWER(username) != 'developer'
           ORDER BY id ASC`
        )
        .all() as any[];
    } catch {}
  }
  if (users.length === 0) {
    users = masterDb
      .prepare(
        `SELECT id, username, name, role, active, email, phone, status, full_name
         FROM users
         WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer'
         ORDER BY id ASC`
      )
      .all(tenantId) as any[];
  }

  let syncLogs: any[] = [];
  let auditLogs: any[] = [];
  if (tDb) {
    try {
      syncLogs = tDb.prepare("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 20").all() as any[];
    } catch {}
    try {
      auditLogs = tDb.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 25").all() as any[];
    } catch {}
  }

  res.json({
    tenant,
    effective_policy: getTenantPolicyStatus(tenant),
    db_size_bytes: getTenantDbSizeBytes(tenantId),
    metrics: collectTenantOperationalMetrics(tenantId),
    users: users.map((u) => ({ ...u, active: Boolean(u.active) })),
    installations,
    sync_logs: syncLogs,
    audit_logs: auditLogs,
  });
});

router.post("/developer/tenants", (req, res) => {
  const devUser = requireDeveloper(req, res);
  if (!devUser) return;

  const {
    company_name,
    package_name = "enterprise",
    license_start_date,
    license_expires_at,
    max_users = 25,
    max_devices = 5,
    allow_local_desktop = true,
    offline_grace_hours = 72,
    grace_days = 14,
    retention_days_after_expiry = 30,
    admin_username,
    admin_password,
    admin_name,
    notes = "",
  } = req.body;

  if (!company_name || !String(company_name).trim()) {
    return res.status(400).json({ error: "يرجى إدخال اسم المؤسسة / مكتب السفر والسياحة" });
  }
  if (!admin_username || !String(admin_username).trim() || !admin_password || !String(admin_password).trim()) {
    return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور الأولية للعميل" });
  }

  const cleanUsername = String(admin_username).trim();
  if (cleanUsername.toLowerCase() === "developer") {
    return res.status(400).json({ error: "لا يمكن استخدام اسم المستخدم developer لحساب مؤسسة" });
  }

  const existingUser = masterDb
    .prepare("SELECT id FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
    .get(cleanUsername);
  if (existingUser) {
    return res.status(409).json({ error: `اسم المستخدم (${cleanUsername}) مسجل مسبقاً، يرجى اختيار اسم آخر` });
  }

  const cleanCompany = String(company_name).trim();
  const cleanAdminName = String(admin_name || `مدير ${cleanCompany}`).trim();
  const tenantCode = `OMNI-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  const licenseKey = `OMNI-TEN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const startDate = license_start_date || new Date().toISOString().split("T")[0];
  const expDate = license_expires_at || "2027-12-31";
  const passHash = hashPassword(String(admin_password).trim());
  const effGraceDays = Math.max(0, Number(grace_days ?? 14));
  const effRetentionDays = Math.max(effGraceDays, Number(retention_days_after_expiry ?? 30));

  const insertRes = masterDb
    .prepare(
      `INSERT INTO cloud_tenants (
        tenant_code, company_name, package_name, subscription_status, license_status,
        license_key, license_start_date, license_expires_at, max_users, max_devices,
        allow_local_desktop, offline_grace_hours, grace_days, retention_days_after_expiry, notes
      ) VALUES (?, ?, ?, 'active', 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      tenantCode,
      cleanCompany,
      package_name,
      licenseKey,
      startDate,
      expDate,
      Math.max(1, Number(max_users) || 25),
      Math.max(1, Number(max_devices) || 5),
      allow_local_desktop ? 1 : 0,
      Math.max(1, Number(offline_grace_hours) || 72),
      effGraceDays,
      effRetentionDays,
      notes
    );

  const tenantId = Number(insertRes.lastInsertRowid);

  // Register admin user in master auth directory
  const userInsertRes = masterDb
    .prepare(
      `INSERT INTO users (
        username, password_hash, name, role, active, can_discount, tenant_id,
        perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
        perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
      ) VALUES (?, ?, ?, 'admin', 1, 1, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)`
    )
    .run(cleanUsername, passHash, cleanAdminName, tenantId);

  const masterUserId = Number(userInsertRes.lastInsertRowid);

  // Create isolated operational Tenant DB with schema parity & triggers
  try {
    createTenantDatabase(tenantId, {
      companyName: cleanCompany,
      tenantCode,
      adminUsername: cleanUsername,
      adminPasswordHash: passHash,
      adminName: cleanAdminName,
      licenseExpiresAt: expDate,
      maxDevices: Math.max(1, Number(max_devices) || 5),
    });
  } catch (err: any) {
    try {
      masterDb.prepare("DELETE FROM users WHERE id = ?").run(masterUserId);
    } catch {}
    try {
      masterDb.prepare("DELETE FROM cloud_tenants WHERE id = ?").run(tenantId);
    } catch {}
    return res.status(500).json({
      error: `فشل تهيئة قاعدة بيانات المؤسسة: ${err?.message || "خطأ غير متوقع"}`,
    });
  }

  const created = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId);
  res.status(201).json({
    ok: true,
    tenant: created,
    credentials: {
      username: cleanUsername,
      adminName: cleanAdminName,
    },
  });
});

router.patch("/developer/tenants/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const existing = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }

  const {
    company_name,
    package_name,
    subscription_status,
    license_status,
    license_start_date,
    license_expires_at,
    max_users,
    max_devices,
    allow_local_desktop,
    offline_grace_hours,
    grace_days,
    retention_days_after_expiry,
    notes,
  } = req.body;

  const cleanCompanyName = company_name !== undefined ? String(company_name).trim() || existing.company_name : existing.company_name;
  const finalSubStatus = subscription_status ?? existing.subscription_status;
  const finalLicStatus = license_status ?? (subscription_status ? subscription_status : existing.license_status);
  const finalExpires = license_expires_at ?? existing.license_expires_at;
  const finalAllowLocal =
    allow_local_desktop !== undefined ? (allow_local_desktop ? 1 : 0) : existing.allow_local_desktop;
  const nextGraceDays = grace_days !== undefined ? Math.max(0, Number(grace_days)) : Number(existing.grace_days ?? 14);
  const nextRetentionDays = retention_days_after_expiry !== undefined
    ? Math.max(nextGraceDays, Number(retention_days_after_expiry))
    : Math.max(nextGraceDays, Number(existing.retention_days_after_expiry ?? 30));

  masterDb
    .prepare(
      `UPDATE cloud_tenants
       SET company_name = ?, package_name = ?, subscription_status = ?, license_status = ?,
           license_start_date = ?, license_expires_at = ?, max_users = ?, max_devices = ?,
           allow_local_desktop = ?, offline_grace_hours = ?, grace_days = ?, retention_days_after_expiry = ?,
           notes = ?, updated_at = datetime('now', 'localtime')
       WHERE id = ?`
    )
    .run(
      cleanCompanyName,
      package_name ?? existing.package_name,
      finalSubStatus,
      finalLicStatus,
      license_start_date ?? existing.license_start_date,
      finalExpires,
      max_users !== undefined ? Math.max(1, Number(max_users)) : existing.max_users,
      max_devices !== undefined ? Math.max(1, Number(max_devices)) : existing.max_devices,
      finalAllowLocal,
      offline_grace_hours !== undefined ? Math.max(1, Number(offline_grace_hours)) : existing.offline_grace_hours,
      nextGraceDays,
      nextRetentionDays,
      notes !== undefined ? notes : existing.notes,
      tenantId
    );

  // Sync updated company name inside tenant operational DB settings
  if (company_name !== undefined && cleanCompanyName !== existing.company_name) {
    const tDb = getExistingTenantDb(tenantId);
    if (tDb) {
      try {
        tDb.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('businessName', ?)").run(cleanCompanyName);
      } catch {}
      try {
        tDb.prepare("UPDATE travel_system_settings SET company_name_ar = ?, company_name_en = ? WHERE id = 1").run(
          cleanCompanyName,
          cleanCompanyName
        );
      } catch {}
      try {
        tDb.prepare("UPDATE sync_runtime_config SET company_name = ? WHERE id = 1").run(cleanCompanyName);
      } catch {}
    }
  }

  // Enforce immediate session revocation when tenant is suspended or expired
  if (finalSubStatus === "suspended" || finalSubStatus === "expired") {
    revokeTenantSessions(tenantId);
  }

  // Keep Tenant #1 legacy licenses table aligned if Tenant #1 is updated
  if (tenantId === 1) {
    try {
      const legacyActive = finalSubStatus === "suspended" ? 0 : 1;
      masterDb
        .prepare("UPDATE licenses SET status = ?, active = ?, expires_at = ?, devices_limit = ? WHERE active = 1 OR id = (SELECT MAX(id) FROM licenses)")
        .run(finalLicStatus, legacyActive, finalExpires, max_devices !== undefined ? Number(max_devices) : existing.max_devices);
    } catch {}
  }

  masterDb
    .prepare(
      `UPDATE tenant_installations
       SET license_status = ?,
           sync_status = CASE
             WHEN status != 'authorized' THEN 'Blocked'
             WHEN ? IN ('suspended', 'expired') THEN 'License Expired'
             WHEN ? = 0 THEN 'Local Disabled'
             WHEN sync_status IN ('Blocked', 'License Expired', 'Local Disabled') THEN 'Connected'
             ELSE sync_status
           END
       WHERE tenant_id = ?`
    )
    .run(finalLicStatus, finalSubStatus, finalAllowLocal, tenantId);

  const updated = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId);
  res.json({ ok: true, tenant: updated, effective_policy: getTenantPolicyStatus(updated) });
});

router.post("/developer/tenants/:id/regenerate-key", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const existing = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }
  const newKey = `OMNI-TEN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  masterDb
    .prepare("UPDATE cloud_tenants SET license_key = ?, updated_at = datetime('now', 'localtime') WHERE id = ?")
    .run(newKey, tenantId);
  res.json({ ok: true, license_key: newKey });
});

router.post("/developer/tenants/:id/reset-password", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const existing = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }

  const { username, new_password } = req.body || {};
  if (!new_password || String(new_password).trim().length < 3) {
    return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل" });
  }

  let targetUser: any = null;
  if (username && String(username).trim()) {
    targetUser = masterDb
      .prepare("SELECT * FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(TRIM(username)) = LOWER(TRIM(?))")
      .get(tenantId, String(username).trim());
  } else {
    targetUser = masterDb
      .prepare(
        "SELECT * FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer' ORDER BY id ASC LIMIT 1"
      )
      .get(tenantId);
  }

  if (!targetUser) {
    return res.status(404).json({ error: "لم يتم العثور على المستخدم المطلوب ضمن هذه المؤسسة" });
  }
  if (String(targetUser.username).toLowerCase() === "developer" || targetUser.role === "developer") {
    return res.status(403).json({ error: "لا يمكن تعديل حساب المطور من هذه الأداة" });
  }

  const passHash = hashPassword(String(new_password).trim());
  masterDb.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passHash, targetUser.id);

  if (tenantId > 1) {
    const tDb = getExistingTenantDb(tenantId);
    if (tDb) {
      try {
        tDb
          .prepare("UPDATE users SET password_hash = ? WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))")
          .run(passHash, targetUser.username);
      } catch {}
    }
  }

  revokeUserSessions(tenantId, targetUser.username, targetUser.id);
  res.json({ ok: true, username: targetUser.username });
});

router.post("/developer/tenants/:id/users", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const existing = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }

  const { username, password, name, role = "employee", phone = "", email = "", bypass_quota = false } = req.body || {};
  const cleanUser = String(username || "").trim();
  const cleanPass = String(password || "").trim();
  const cleanName = String(name || cleanUser).trim();

  if (!cleanUser || !cleanPass || cleanPass.length < 3) {
    return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور (3 أحرف على الأقل)" });
  }
  if (cleanUser.toLowerCase() === "developer" || role === "developer") {
    return res.status(403).json({ error: "لا يمكن إنشاء مستخدم بصلاحية developer لمؤسسة" });
  }

  const dup = masterDb
    .prepare("SELECT id FROM users WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))")
    .get(cleanUser);
  if (dup) {
    return res.status(409).json({ error: `اسم المستخدم (${cleanUser}) مسجل مسبقاً في النظام السحابي` });
  }

  const currentUsers =
    (
      masterDb
        .prepare("SELECT COUNT(*) as c FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer'")
        .get(tenantId) as { c: number }
    )?.c || 0;
  if (!bypass_quota && currentUsers >= Number(existing.max_users || 1)) {
    return res.status(403).json({
      error: `تم الوصول للحد الأقصى للمستخدمين (${existing.max_users}). قم بزيادة الحد الأقصى في الباقة أولاً.`,
    });
  }

  const passHash = hashPassword(cleanPass);
  const isAdmin = role === "admin" || role === "general_manager" || role === "accountant";
  const mRes = masterDb
    .prepare(
      `INSERT INTO users (
        username, password_hash, name, role, active, can_discount, tenant_id, email, phone, status, full_name,
        perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
        perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
      ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'نشط', ?, 1, 1, ?, ?, 1, ?, 1, 1, ?, ?, ?)`
    )
    .run(
      cleanUser,
      passHash,
      cleanName,
      role,
      isAdmin ? 1 : 0,
      tenantId,
      email || null,
      phone || null,
      cleanName,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0,
      isAdmin ? 1 : 0
    );

  if (tenantId > 1) {
    const tDb = getExistingTenantDb(tenantId);
    if (tDb) {
      try {
        tDb
          .prepare(
            `INSERT INTO users (
              username, password_hash, name, role, active, can_discount, tenant_id, email, phone, status, full_name,
              perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
              perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
            ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'نشط', ?, 1, 1, ?, ?, 1, ?, 1, 1, ?, ?, ?)`
          )
          .run(
            cleanUser,
            passHash,
            cleanName,
            role,
            isAdmin ? 1 : 0,
            tenantId,
            email || null,
            phone || null,
            cleanName,
            isAdmin ? 1 : 0,
            isAdmin ? 1 : 0,
            isAdmin ? 1 : 0,
            isAdmin ? 1 : 0,
            isAdmin ? 1 : 0,
            isAdmin ? 1 : 0
          );
      } catch {}
    }
  }

  res.status(201).json({
    ok: true,
    user: {
      id: Number(mRes.lastInsertRowid),
      username: cleanUser,
      name: cleanName,
      role,
      active: true,
      email,
      phone,
    },
  });
});

router.patch("/developer/tenants/:id/users/:userId", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const tDb = getExistingTenantDb(tenantId);

  let targetUser: any = null;
  if (tenantId > 1 && tDb) {
    targetUser = tDb.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }
  if (!targetUser) {
    targetUser = masterDb
      .prepare("SELECT * FROM users WHERE id = ? AND COALESCE(tenant_id, 1) = ?")
      .get(userId, tenantId);
  }
  if (!targetUser) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }
  if (targetUser.role === "developer" || String(targetUser.username).toLowerCase() === "developer") {
    return res.status(403).json({ error: "لا يمكن تعديل حساب مطور النظام" });
  }

  const { active, role, name, phone, email, password } = req.body || {};
  const nextActive = active !== undefined ? (active ? 1 : 0) : Number(targetUser.active ?? 1);
  const nextRole = role && role !== "developer" ? role : targetUser.role;
  const nextName = name !== undefined ? String(name).trim() || targetUser.name : targetUser.name;
  const nextStatus = nextActive ? "نشط" : "معطل";
  const nextPassHash = password && String(password).trim().length >= 3 ? hashPassword(String(password).trim()) : null;

  const masterRow = masterDb
    .prepare("SELECT id FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(TRIM(username)) = LOWER(TRIM(?))")
    .get(tenantId, targetUser.username) as { id: number } | undefined;

  if (nextPassHash) {
    if (tenantId > 1 && tDb) {
      tDb
        .prepare(
          "UPDATE users SET active = ?, role = ?, name = ?, full_name = ?, phone = ?, email = ?, status = ?, password_hash = ? WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))"
        )
        .run(
          nextActive,
          nextRole,
          nextName,
          nextName,
          phone !== undefined ? phone : targetUser.phone,
          email !== undefined ? email : targetUser.email,
          nextStatus,
          nextPassHash,
          targetUser.username
        );
    }
    masterDb
      .prepare(
        "UPDATE users SET active = ?, role = ?, name = ?, full_name = ?, phone = ?, email = ?, status = ?, password_hash = ? WHERE COALESCE(tenant_id, 1) = ? AND LOWER(TRIM(username)) = LOWER(TRIM(?))"
      )
      .run(
        nextActive,
        nextRole,
        nextName,
        nextName,
        phone !== undefined ? phone : targetUser.phone,
        email !== undefined ? email : targetUser.email,
        nextStatus,
        nextPassHash,
        tenantId,
        targetUser.username
      );
  } else {
    if (tenantId > 1 && tDb) {
      tDb
        .prepare(
          "UPDATE users SET active = ?, role = ?, name = ?, full_name = ?, phone = ?, email = ?, status = ? WHERE LOWER(TRIM(username)) = LOWER(TRIM(?))"
        )
        .run(
          nextActive,
          nextRole,
          nextName,
          nextName,
          phone !== undefined ? phone : targetUser.phone,
          email !== undefined ? email : targetUser.email,
          nextStatus,
          targetUser.username
        );
    }
    masterDb
      .prepare(
        "UPDATE users SET active = ?, role = ?, name = ?, full_name = ?, phone = ?, email = ?, status = ? WHERE COALESCE(tenant_id, 1) = ? AND LOWER(TRIM(username)) = LOWER(TRIM(?))"
      )
      .run(
        nextActive,
        nextRole,
        nextName,
        nextName,
        phone !== undefined ? phone : targetUser.phone,
        email !== undefined ? email : targetUser.email,
        nextStatus,
        tenantId,
        targetUser.username
      );
  }

  if (!nextActive || nextPassHash) {
    revokeUserSessions(tenantId, targetUser.username, masterRow?.id);
  }

  res.json({ ok: true, username: targetUser.username, active: Boolean(nextActive), role: nextRole });
});

router.delete("/developer/tenants/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantId = Number(req.params.id);
  if (!tenantId || tenantId <= 1) {
    return res.status(400).json({ error: "لا يمكن حذف المؤسسة الرئيسية الافتراضية للنظام" });
  }
  const existing = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
  if (!existing) {
    return res.status(404).json({ error: "المؤسسة غير موجودة" });
  }

  revokeTenantSessions(tenantId);
  masterDb.prepare("DELETE FROM tenant_installations WHERE tenant_id = ?").run(tenantId);
  masterDb
    .prepare("DELETE FROM users WHERE COALESCE(tenant_id, 1) = ? AND LOWER(username) != 'developer' AND role != 'developer'")
    .run(tenantId);
  masterDb.prepare("DELETE FROM cloud_tenants WHERE id = ?").run(tenantId);

  try {
    deleteTenantDatabase(tenantId);
  } catch {}

  try {
    const tenantUploadDir = resolveTenantUploadDir(tenantId);
    if (fs.existsSync(tenantUploadDir)) {
      fs.rmSync(tenantUploadDir, { recursive: true, force: true });
    }
  } catch {}

  res.json({ ok: true, deletedId: tenantId });
});

router.get("/developer/installations", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const tenantFilter = req.query.tenant_id ? Number(req.query.tenant_id) : null;
  const sql = tenantFilter
    ? `SELECT ti.*, ct.company_name, ct.tenant_code, ct.license_expires_at, ct.subscription_status
       FROM tenant_installations ti
       JOIN cloud_tenants ct ON ct.id = ti.tenant_id
       WHERE ti.tenant_id = ?
       ORDER BY ti.id DESC`
    : `SELECT ti.*, ct.company_name, ct.tenant_code, ct.license_expires_at, ct.subscription_status
       FROM tenant_installations ti
       JOIN cloud_tenants ct ON ct.id = ti.tenant_id
       ORDER BY ti.id DESC`;

  const rows = tenantFilter
    ? (masterDb.prepare(sql).all(tenantFilter) as any[])
    : (masterDb.prepare(sql).all() as any[]);

  // Never leak sync_token_hash to UI
  const sanitized = rows.map(({ sync_token_hash, ...rest }) => rest);
  res.json(sanitized);
});

router.patch("/developer/installations/:id/status", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const instId = Number(req.params.id);
  const { status } = req.body;
  if (!["authorized", "blocked", "revoked"].includes(status)) {
    return res.status(400).json({ error: "الحالة غير صالحة (authorized | blocked | revoked)" });
  }
  const row = masterDb.prepare("SELECT * FROM tenant_installations WHERE id = ?").get(instId) as any;
  if (!row) return res.status(404).json({ error: "التثبيت غير موجود" });

  masterDb
    .prepare(
      "UPDATE tenant_installations SET status = ?, sync_status = ?, sync_token_hash = CASE WHEN ? != 'authorized' THEN NULL ELSE sync_token_hash END WHERE id = ?"
    )
    .run(status, status === "authorized" ? "Connected" : "Blocked", status, instId);

  res.json({ ok: true, id: instId, status });
});

router.delete("/developer/installations/:id", (req, res) => {
  if (!requireDeveloper(req, res)) return;
  const instId = Number(req.params.id);
  masterDb.prepare("DELETE FROM tenant_installations WHERE id = ?").run(instId);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CLOUD HUB SYNC & AUTHENTICATION ENDPOINTS (Server-derived Tenant Isolation)
// ─────────────────────────────────────────────────────────────────────────────

router.post("/cloud/auth/desktop-login", (req, res) => {
  const { username, password, installation_id, device_id, device_name, os_info, app_version, db_version } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
  }

  const result = authenticateDesktopLoginOnCloud({
    username,
    password,
    installationId: installation_id || `INST-${device_id || "LOCAL"}`,
    deviceId: device_id || getSystemDeviceId(),
    deviceName: device_name,
    osInfo: os_info,
    appVersion: app_version,
    dbVersion: db_version,
  });

  if (result.ok === false) {
    return res.status(result.status).json({ error: result.error, code: result.code });
  }

  res.json({
    ok: true,
    user: result.user,
    tenant: result.tenant,
    installation: result.installation,
    deviceSyncToken: result.deviceSyncToken,
    cloudMaxSeq: result.cloudMaxSeq,
    licenseSnapshot: result.licenseSnapshot,
    licensePolicy: result.licensePolicy,
  });
});

router.get("/cloud/ping", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }
  const tDb = getTenantDb(verified.tenantId);
  const seqRow = tDb
    .prepare("SELECT COALESCE(MAX(seq), 0) as max_seq FROM sync_change_log WHERE tenant_id = ?")
    .get(verified.tenantId) as { max_seq: number };

  res.json({
    ok: true,
    tenantId: verified.tenantId,
    tenant: verified.tenant,
    cloudDbVersion: HYBRID_DB_VERSION,
    cloudMaxSeq: Number(seqRow?.max_seq || 0),
    serverTime: new Date().toISOString(),
  });
});

router.post("/cloud/sync/bootstrap", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  // Strictly uses server-derived verified.tenantId — client tenant_id is ignored
  const snapshot = exportTenantBootstrapSnapshot(verified.tenantId);
  res.json({
    ok: true,
    ...snapshot,
    tenant: verified.tenant,
  });
});

router.get("/cloud/sync/pull", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  const sinceSeq = Number(req.query.since_seq || 0);
  const limit = Number(req.query.limit || 250);
  // Strictly scoped to verified.tenantId
  const delta = pullCloudDeltasForTenant(verified.tenantId, verified.installationId, sinceSeq, limit);
  res.json({ ok: true, tenantId: verified.tenantId, ...delta });
});

router.post("/cloud/sync/push", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  const ops = Array.isArray(req.body?.ops) ? req.body.ops : [];
  if (ops.length === 0) {
    return res.json({ ok: true, results: [], appliedCount: 0, conflictCount: 0, cloudMaxSeq: 0 });
  }

  const pushResult = processCloudPushBatch(verified.tenantId, verified.installationId, ops);
  res.json({ ok: true, tenantId: verified.tenantId, ...pushResult });
});

router.post("/cloud/conflicts/resolve-by-uuid", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  const { sync_uuid, strategy, merged_fields, resolved_by, note } = req.body || {};
  const tDb = getTenantDb(verified.tenantId);
  const row = tDb
    .prepare("SELECT id FROM sync_conflicts WHERE tenant_id = ? AND sync_uuid = ? AND status = 'pending' ORDER BY id DESC LIMIT 1")
    .get(verified.tenantId, sync_uuid) as { id: number } | undefined;

  if (!row) {
    return res.json({ ok: true, message: "No pending conflict matched" });
  }

  const resConflict = resolveSyncConflictRecord({
    targetDb: tDb,
    tenantId: verified.tenantId,
    conflictId: row.id,
    strategy: strategy || "cloud",
    mergedFields: merged_fields,
    resolvedBy: resolved_by || "Admin",
    note,
  });

  if (!resConflict.ok) {
    return res.status(400).json({ error: resConflict.error });
  }
  res.json({ ok: true, conflict: resConflict.conflict });
});

router.post("/cloud/files/upload", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  const { relativePath, checksumSha256, contentBase64 } = req.body || {};
  if (!relativePath || !contentBase64) {
    return res.status(400).json({ error: "بيانات الملف غير مكتملة" });
  }

  const cleanRel = String(relativePath).replace(/^\/+/, "").replace(/\.\./g, "");
  const buf = Buffer.from(String(contentBase64), "base64");
  const actualSha = computeBufferSha256(buf);
  if (checksumSha256 && actualSha !== checksumSha256) {
    return res.status(400).json({ error: "فشل التحقق من سلامة الملف (SHA-256 mismatch)" });
  }

  const tenantRoot = resolveTenantUploadDir(verified.tenantId);
  const target = path.join(tenantRoot, cleanRel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buf);

  res.json({ ok: true, relativePath: cleanRel, checksumSha256: actualSha, fileSize: buf.length });
});

router.get("/cloud/files/download", (req, res) => {
  const token = String(req.headers["x-sync-token"] || "");
  const verified = verifyCloudDeviceToken(token);
  if (verified.ok === false) {
    return res.status(verified.status).json({ error: verified.error, code: verified.code });
  }

  const rel = String(req.query.path || "").replace(/^\/+/, "").replace(/\.\./g, "");
  if (!rel) return res.status(400).json({ error: "مسار الملف مطلوب" });

  const tenantRoot = resolveTenantUploadDir(verified.tenantId);
  let target = path.join(tenantRoot, rel);
  if (!fs.existsSync(target) && verified.tenantId === 1) {
    target = path.join(path.resolve(process.cwd(), "public/uploads"), rel);
  }
  if (!fs.existsSync(target)) {
    return res.status(404).json({ error: "الملف غير موجود على السحابة" });
  }

  res.sendFile(target);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LOCAL CLIENT & ACTIVE WORKSPACE SYNC CENTER ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────

router.get("/sync/status", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const tenantId = Number(user.tenant_id || 1);
  const summary = getLocalSyncStatusSummary(tenantId);

  const installations = masterDb
    .prepare(
      `SELECT id, tenant_id, installation_id, device_id, username, device_name, os_info, app_version, db_version,
              mode, status, last_successful_sync, last_downloaded_seq, last_uploaded_seq, sync_status, license_status, last_seen_at
       FROM tenant_installations
       WHERE tenant_id = ?
       ORDER BY id DESC`
    )
    .all(tenantId);

  res.json({
    ...summary,
    tenantId,
    installations,
    currentSystemDeviceId: getSystemDeviceId(),
    currentVersion: CURRENT_SYSTEM_VERSION,
  });
});

router.post("/sync/now", async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const tenantId = Number(user.tenant_id || 1);
  if (!isLocalDesktopMode()) {
    return res.json({
      ok: true,
      status: "Connected",
      uploadedCount: 0,
      downloadedCount: 0,
      filesSynced: 0,
      conflictsCount: 0,
      summary: getLocalSyncStatusSummary(tenantId),
      message: "أنت تعمل حالياً مباشرة على النسخة السحابية (Cloud Version).",
    });
  }

  const result = await runBidirectionalSync("manual");
  res.status(result.ok ? 200 : result.status === "License Expired" ? 403 : 200).json(result);
});

router.post("/sync/configure", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const tenantId = Number(user.tenant_id || 1);
  const { cloud_server_url, auto_sync_enabled, auto_sync_interval_sec, mode } = req.body || {};
  const cfg = masterDb.prepare("SELECT * FROM sync_runtime_config WHERE id = 1").get() as any;

  const nextUrl =
    cloud_server_url !== undefined
      ? String(cloud_server_url).trim().replace(/\/+$/, "")
      : cfg?.cloud_server_url || "";
  const nextAuto =
    auto_sync_enabled !== undefined ? (auto_sync_enabled ? 1 : 0) : (cfg?.auto_sync_enabled ?? 1);
  const nextInterval =
    auto_sync_interval_sec !== undefined
      ? Math.max(10, Number(auto_sync_interval_sec) || 30)
      : (cfg?.auto_sync_interval_sec || 30);
  const nextMode = mode === "local" || mode === "cloud" ? mode : (cfg?.mode || "cloud");

  masterDb
    .prepare(
      `UPDATE sync_runtime_config
       SET cloud_server_url = ?, auto_sync_enabled = ?, auto_sync_interval_sec = ?, mode = ?, updated_at = datetime('now', 'localtime')
       WHERE id = 1`
    )
    .run(nextUrl, nextAuto, nextInterval, nextMode);

  res.json({ ok: true, summary: getLocalSyncStatusSummary(tenantId) });
});

router.get("/sync/config-public", (req, res) => {
  const cfg = (masterDb.prepare("SELECT mode, cloud_server_url, installation_id, tenant_id, tenant_code, company_name, is_bootstrapped FROM sync_runtime_config WHERE id = 1").get() as any) || {};
  res.json({
    mode: isLocalDesktopMode() ? "local" : "cloud",
    cloudServerUrl: cfg.cloud_server_url || "",
    installationId: cfg.installation_id || getOrCreatePersistentInstallationId(getDbDir()),
    deviceId: getSystemDeviceId(),
    tenantId: cfg.tenant_id || 1,
    tenantCode: cfg.tenant_code || "OMNI-MAIN",
    companyName: cfg.company_name || "",
    isBootstrapped: Boolean(cfg.is_bootstrapped),
  });
});

router.post("/sync/bootstrap-local", async (req, res) => {
  const { cloud_url, username, password, device_name } = req.body || {};
  if (!cloud_url || !username || !password) {
    return res.status(400).json({ error: "يرجى تحديد رابط السحابة واسم المستخدم وكلمة المرور" });
  }
  const cleanCloudUrl = String(cloud_url).trim().replace(/\/+$/, "");
  const installId = getOrCreatePersistentInstallationId(getDbDir());
  const deviceId = getSystemDeviceId();

  const loginRes = await fetch(`${cleanCloudUrl}/api/cloud/auth/desktop-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      installation_id: installId,
      device_id: deviceId,
      device_name,
    }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok) {
    return res.status(loginRes.status).json(loginJson);
  }

  const bootRes = await fetch(`${cleanCloudUrl}/api/cloud/sync/bootstrap`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sync-token": loginJson.deviceSyncToken,
    },
  });
  const bootJson = await bootRes.json();
  if (!bootRes.ok) {
    return res.status(bootRes.status).json(bootJson);
  }

  applyBootstrapSnapshotLocally({
    snapshot: bootJson,
    cloudUrl: cleanCloudUrl,
    deviceSyncToken: loginJson.deviceSyncToken,
    licenseSnapshot: loginJson.licenseSnapshot,
    tenant: loginJson.tenant,
    user: loginJson.user,
  });

  // Immediately upload any pre-existing offline local operations preserved during bootstrap
  await runBidirectionalSync("manual").catch(() => {});

  res.json({ ok: true, summary: getLocalSyncStatusSummary() });
});

router.get("/sync/conflicts", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const tenantId = Number(user.tenant_id || 1);
  const targetDb = isLocalDesktopMode() ? masterDb : getTenantDb(tenantId);
  const rows = targetDb
    .prepare("SELECT * FROM sync_conflicts WHERE tenant_id = ? ORDER BY CASE WHEN status='pending' THEN 0 ELSE 1 END, id DESC LIMIT 100")
    .all(tenantId) as any[];

  res.json(
    rows.map((r) => {
      let localPayload = {};
      let cloudPayload = {};
      let basePayload = {};
      let conflictFields: string[] = [];
      try { localPayload = JSON.parse(r.local_payload_json || "{}"); } catch {}
      try { cloudPayload = JSON.parse(r.cloud_payload_json || "{}"); } catch {}
      try { basePayload = JSON.parse(r.base_payload_json || "{}"); } catch {}
      try { conflictFields = JSON.parse(r.conflict_fields_json || "[]"); } catch {}
      return {
        ...r,
        localPayload,
        cloudPayload,
        basePayload,
        conflictFields,
      };
    })
  );
});

router.post("/sync/conflicts/:id/resolve", async (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const conflictId = Number(req.params.id);
  const { strategy, merged_fields, note } = req.body || {};
  if (!["cloud", "local", "merge"].includes(strategy)) {
    return res.status(400).json({ error: "إستراتيجية الحل غير صالحة (cloud | local | merge)" });
  }

  const tenantId = Number(user.tenant_id || 1);
  const targetDb = isLocalDesktopMode() ? masterDb : getTenantDb(tenantId);

  const result = resolveSyncConflictRecord({
    targetDb,
    tenantId,
    conflictId,
    strategy,
    mergedFields: merged_fields,
    resolvedBy: user.name || user.username,
    note,
  });

  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }

  // If running in Local mode and connected to Cloud, notify Cloud to align conflict queue & push immediately
  if (isLocalDesktopMode() && result.conflict) {
    try {
      const cfg = masterDb.prepare("SELECT cloud_server_url, encrypted_sync_token FROM sync_runtime_config WHERE id = 1").get() as any;
      const cloudUrl = String(cfg?.cloud_server_url || "").trim().replace(/\/+$/, "");
      const syncToken = decryptHybridSecret(cfg?.encrypted_sync_token);
      if (cloudUrl && syncToken) {
        await fetch(`${cloudUrl}/api/cloud/conflicts/resolve-by-uuid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-sync-token": syncToken },
          body: JSON.stringify({
            sync_uuid: result.conflict.sync_uuid,
            strategy,
            merged_fields,
            resolved_by: user.name || user.username,
            note,
          }),
        }).catch(() => {});
        await runBidirectionalSync("manual").catch(() => {});
      }
    } catch {}
  }

  res.json({ ok: true, conflict: result.conflict, summary: getLocalSyncStatusSummary() });
});

router.get("/sync/logs", (req, res) => {
  const user = getAuthUser(req);
  if (!user) return res.status(401).json({ error: "غير مصرح" });

  const tenantId = Number(user.tenant_id || 1);
  const targetDb = isLocalDesktopMode() ? masterDb : getTenantDb(tenantId);
  const logs = targetDb
    .prepare("SELECT * FROM sync_logs WHERE tenant_id = ? ORDER BY id DESC LIMIT 100")
    .all(tenantId);
  res.json(logs);
});

export default router;
