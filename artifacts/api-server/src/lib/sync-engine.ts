import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  masterDb,
  getTenantDb,
  getDbDir,
  getActiveDatabasePath,
  createSafeDatabaseBackup,
  verifyPassword,
  isLocalDesktopMode,
} from "./sqlite";
import {
  HYBRID_DB_VERSION,
  SYNC_TABLES_ORDERED,
  SYNC_TABLE_MAP,
  IMMUTABLE_FINANCIAL_TABLES,
  SyncTableConfig,
  ensureSyncMetadataAndTriggers,
} from "./hybrid-sync-schema";
import {
  encryptHybridSecret,
  decryptHybridSecret,
  encryptJsonPayload,
  decryptJsonPayload,
  generateOpaqueToken,
  hashTokenSha256,
  computeFileSha256,
  computeBufferSha256,
  getOrCreatePersistentInstallationId,
  persistInstallationFileMetadata,
  verifyOfflineLicensePolicy,
  OfflineLicenseSnapshot,
} from "./hybrid-crypto";

export type SyncLifecycleStatus =
  | "Connected"
  | "Offline"
  | "Syncing"
  | "Synced"
  | "Pending Changes"
  | "Conflict Detected"
  | "Sync Failed"
  | "License Expired";

export const APP_VERSION = "1.1.0";

const META_IGNORE_KEYS = new Set([
  "id",
  "tenant_id",
  "sync_uuid",
  "record_version",
  "sync_updated_at",
  "created_at",
  "updated_at",
]);

let activeSyncPromise: Promise<any> | null = null;
let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let lastOfflineBackoffUntil = 0;

function getTableColumns(targetDb: any, tableName: string): string[] {
  try {
    return (targetDb.prepare(`PRAGMA table_info("${tableName}")`).all() as { name: string }[]).map((c) => c.name);
  } catch {
    return [];
  }
}

function tableExists(targetDb: any, tableName: string): boolean {
  try {
    const r = targetDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
      .get(tableName) as { name: string } | undefined;
    return Boolean(r?.name);
  } catch {
    return false;
  }
}

export function getTenantPolicyStatus(tenant: any): {
  allowed: boolean;
  code?: "license_expired" | "license_suspended" | "license_not_started" | "local_disabled" | "license_required";
  reason?: string;
  remainingDays?: number;
  isGracePeriod?: boolean;
  isWarning?: boolean;
  isRetentionWarning?: boolean;
  retentionDaysLeft?: number;
  warningMessage?: string;
} {
  if (!tenant) {
    return {
      allowed: false,
      code: "license_required",
      reason: "حساب المؤسسة غير مسجل أو غير موجود في الخادم السحابي.",
    };
  }

  if (tenant.subscription_status === "suspended" || tenant.license_status === "suspended") {
    return {
      allowed: false,
      code: "license_suspended",
      reason: `تم تعليق حساب واشتراك المؤسسة (${tenant.company_name}). جميع بياناتك محفوظة بأمان، يرجى التواصل مع المطور لإعادة التفعيل.`,
    };
  }

  const now = new Date();
  const todayMid = new Date(now);
  todayMid.setHours(0, 0, 0, 0);

  if (tenant.license_start_date) {
    const startMid = new Date(`${tenant.license_start_date}T00:00:00`);
    if (!Number.isNaN(startMid.getTime()) && todayMid.getTime() < startMid.getTime()) {
      return {
        allowed: false,
        code: "license_not_started",
        reason: `لم يبدأ سريان اشتراك المؤسسة (${tenant.company_name}) بعد. تاريخ بدء التفعيل: ${tenant.license_start_date}.`,
      };
    }
  }

  const graceDays = Math.max(0, Number(tenant.grace_days ?? 14));
  const retentionDays = Math.max(graceDays, Number(tenant.retention_days_after_expiry ?? 30));

  if (tenant.subscription_status === "expired" || tenant.license_status === "expired") {
    return {
      allowed: false,
      code: "license_expired",
      isRetentionWarning: true,
      retentionDaysLeft: retentionDays,
      warningMessage: `تنبيه هام: انتهت صلاحية الاشتراك (${tenant.license_expires_at || ""}). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDays} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان.`,
      reason: `انتهت فترة اشتراك وترخيص المؤسسة (${tenant.company_name}) بتاريخ (${tenant.license_expires_at}). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDays} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان.`,
    };
  }

  if (tenant.license_expires_at) {
    const exp = new Date(`${tenant.license_expires_at}T23:59:59`);
    if (!Number.isNaN(exp.getTime())) {
      const expMid = new Date(`${tenant.license_expires_at}T00:00:00`);
      const diffDays = Math.ceil((expMid.getTime() - todayMid.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        const retentionDaysLeft = Math.max(1, retentionDays + diffDays);
        if (diffDays >= -graceDays) {
          return {
            allowed: true,
            remainingDays: diffDays,
            isGracePeriod: true,
            isWarning: true,
            isRetentionWarning: true,
            retentionDaysLeft,
            warningMessage: `تنبيه هام: انتهت صلاحية الترخيص بتاريخ (${tenant.license_expires_at}) والمؤسسة تعمل ضمن فترة السماح (${graceDays} يوم). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDaysLeft} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان.`
          };
        } else {
          return {
            allowed: false,
            code: "license_expired",
            remainingDays: diffDays,
            isRetentionWarning: true,
            retentionDaysLeft,
            warningMessage: `سوف يتم حذف بيانات هذا الحساب بعد ${retentionDaysLeft} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان.`,
            reason: `انتهت صلاحية ترخيص المؤسسة (${tenant.company_name}) وفترة السماح بتاريخ (${tenant.license_expires_at}). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDaysLeft} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان ولن يتم حذف أي ملف عند التجديد.`,
          };
        }
      }
      const isWarning = diffDays <= 15 && diffDays >= 0;
      const warningMessage = isWarning
        ? `تنبيه: متبقي ${diffDays} يوم فقط على انتهاء اشتراك المؤسسة (${tenant.license_expires_at}).`
        : undefined;
      return { allowed: true, remainingDays: diffDays, isWarning, warningMessage };
    }
  }

  return { allowed: true };
}

export function buildOfflineSnapshotFromTenant(
  tenant: any,
  installationId: string,
  deviceId: string
): OfflineLicenseSnapshot {
  const nowMs = Date.now();
  return {
    tenantId: Number(tenant.id),
    tenantCode: String(tenant.tenant_code || "OMNI-MAIN"),
    companyName: String(tenant.company_name || ""),
    packageName: String(tenant.package_name || "enterprise"),
    subscriptionStatus: String(tenant.subscription_status || "active"),
    licenseStatus: String(tenant.license_status || "active"),
    licenseStartDate: String(tenant.license_start_date || ""),
    licenseExpiresAt: String(tenant.license_expires_at || "2027-12-31"),
    maxUsers: Number(tenant.max_users || 25),
    maxDevices: Number(tenant.max_devices || 5),
    allowLocalDesktop: Boolean(tenant.allow_local_desktop ?? 1),
    offlineGraceHours: Number(tenant.offline_grace_hours || 72),
    graceDays: Number(tenant.grace_days ?? 14),
    retentionDaysAfterExpiry: Number(tenant.retention_days_after_expiry ?? 30),
    lastServerContactMs: nowMs,
    maxMonotonicEpochMs: nowMs,
    installationId,
    deviceId,
    appVersion: APP_VERSION,
  };
}

/**
 * Cloud Server Side: Authenticate Local Desktop Login against Cloud Account Directory
 */
export function authenticateDesktopLoginOnCloud(params: {
  username: string;
  password: string;
  installationId: string;
  deviceId: string;
  deviceName?: string;
  osInfo?: string;
  appVersion?: string;
  dbVersion?: string;
}):
  | {
      ok: true;
      user: any;
      tenant: any;
      installation: any;
      deviceSyncToken: string;
      cloudMaxSeq: number;
      licenseSnapshot: OfflineLicenseSnapshot;
      licensePolicy: ReturnType<typeof getTenantPolicyStatus>;
    }
  | { ok: false; status: number; code: string; error: string } {
  const cleanUsername = String(params.username || "").trim();
  const user = masterDb
    .prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
    .get(cleanUsername) as any;

  if (!user || !user.active) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      error: "اسم المستخدم أو كلمة المرور غير صحيحة أو الحساب معطل في السحابة",
    };
  }

  if (!verifyPassword(String(params.password || ""), user.password_hash)) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      error: "اسم المستخدم أو كلمة المرور غير صحيحة",
    };
  }

  const isDev = user.role === "developer" || user.username?.toLowerCase() === "developer";
  const tenantId = Number(user.tenant_id) || 1;
  const tenant = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;

  if (!tenant) {
    return {
      ok: false,
      status: 404,
      code: "tenant_not_found",
      error: "المؤسسة المرتبطة بهذا الحساب غير موجودة في قاعدة البيانات السحابية",
    };
  }

  const policy = getTenantPolicyStatus(tenant);
  if (!policy.allowed && !isDev) {
    return {
      ok: false,
      status: 403,
      code: policy.code || "license_blocked",
      error: policy.reason || "تم إيقاف أو انتهاء ترخيص المؤسسة",
    };
  }

  if (!tenant.allow_local_desktop && !isDev) {
    return {
      ok: false,
      status: 403,
      code: "local_disabled",
      error: "تم تعطيل تشغيل النسخة المحلية لهذه المؤسسة من لوحة تحكم المطور",
    };
  }

  const cleanInstallId = String(params.installationId || "").trim() || `INST-${params.deviceId}`;
  const cleanDeviceId = String(params.deviceId || "UNKNOWN-HWID").trim().toUpperCase();

  // Enforce Device Registry & Max Devices Quota
  const existingInst = masterDb
    .prepare("SELECT * FROM tenant_installations WHERE tenant_id = ? AND installation_id = ?")
    .get(tenantId, cleanInstallId) as any;

  if (existingInst && (existingInst.status === "blocked" || existingInst.status === "revoked") && !isDev) {
    return {
      ok: false,
      status: 403,
      code: "device_revoked",
      error: `تم حظر أو إلغاء تفعيل هذا الجهاز (${cleanDeviceId}) من لوحة تحكم المطور. لا يُسمح بالدخول أو المزامنة.`,
    };
  }

  if (!existingInst && !isDev) {
    const activeCountRow = masterDb
      .prepare(
        "SELECT COUNT(*) as c FROM tenant_installations WHERE tenant_id = ? AND status = 'authorized'"
      )
      .get(tenantId) as { c: number };
    const activeCount = Number(activeCountRow?.c || 0);
    const maxDevs = Math.max(1, Number(tenant.max_devices) || 1);
    if (activeCount >= maxDevs) {
      return {
        ok: false,
        status: 403,
        code: "device_limit_reached",
        error: `تم الوصول للحد الأقصى للأجهزة المسموح بها لهذه المؤسسة (${maxDevs} أجهزة). يرجى الترقية أو إلغاء ربط جهاز قديم من لوحة المطور.`,
      };
    }
  }

  const deviceSyncToken = generateOpaqueToken("OMNI-DEVSYNC");
  const syncTokenHash = hashTokenSha256(deviceSyncToken);
  const devName = params.deviceName || os.hostname();
  const osInfo = params.osInfo || `${os.platform()} ${os.arch()}`;
  const appVer = params.appVersion || APP_VERSION;
  const dbVer = params.dbVersion || HYBRID_DB_VERSION;

  if (existingInst) {
    masterDb
      .prepare(
        `UPDATE tenant_installations
         SET device_id = ?, cloud_account_id = ?, username = ?, device_name = ?, os_info = ?,
             app_version = ?, db_version = ?, mode = 'local', sync_token_hash = ?,
             license_status = ?, last_seen_at = datetime('now', 'localtime')
         WHERE id = ?`
      )
      .run(
        cleanDeviceId,
        String(user.id),
        user.username,
        devName,
        osInfo,
        appVer,
        dbVer,
        syncTokenHash,
        tenant.license_status || "active",
        existingInst.id
      );
  } else {
    masterDb
      .prepare(
        `INSERT INTO tenant_installations (
          tenant_id, installation_id, device_id, cloud_account_id, username, device_name, os_info,
          app_version, db_version, mode, status, sync_token_hash, sync_status, license_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 'authorized', ?, 'Connected', ?)`
      )
      .run(
        tenantId,
        cleanInstallId,
        cleanDeviceId,
        String(user.id),
        user.username,
        devName,
        osInfo,
        appVer,
        dbVer,
        syncTokenHash,
        tenant.license_status || "active"
      );
  }

  const installation = masterDb
    .prepare("SELECT id, tenant_id, installation_id, device_id, status, last_successful_sync, last_downloaded_seq, last_uploaded_seq FROM tenant_installations WHERE tenant_id = ? AND installation_id = ?")
    .get(tenantId, cleanInstallId);

  const tenantDb = getTenantDb(tenantId);
  const seqRow = tenantDb
    .prepare("SELECT COALESCE(MAX(seq), 0) as max_seq FROM sync_change_log WHERE tenant_id = ?")
    .get(tenantId) as { max_seq: number };

  const licenseSnapshot = buildOfflineSnapshotFromTenant(tenant, cleanInstallId, cleanDeviceId);

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: Boolean(user.active),
      can_discount: Boolean(
        user.can_discount !== undefined && user.can_discount !== null
          ? user.can_discount
          : user.role === "admin" || user.role === "developer" || user.role === "accountant"
      ),
      tenant_id: tenantId,
    },
    tenant,
    installation,
    deviceSyncToken,
    cloudMaxSeq: Number(seqRow?.max_seq || 0),
    licenseSnapshot,
    licensePolicy: policy,
  };
}

/**
 * Cloud Server Side: Authenticate a sync endpoint request strictly by deviceSyncToken.
 * NEVER trusts client-supplied tenant_id.
 */
export function verifyCloudDeviceToken(rawToken: string):
  | {
      ok: true;
      tenantId: number;
      installationId: string;
      deviceId: string;
      tenant: any;
      installation: any;
    }
  | { ok: false; status: number; code: string; error: string } {
  if (!rawToken || !rawToken.trim()) {
    return { ok: false, status: 401, code: "missing_sync_token", error: "رمز مزامنة الجهاز غير موجود" };
  }
  const tokenHash = hashTokenSha256(rawToken.trim());
  const row = masterDb
    .prepare(
      `SELECT ti.*, ct.id as ct_id, ct.tenant_code, ct.company_name, ct.package_name,
              ct.subscription_status, ct.license_status, ct.license_start_date, ct.license_expires_at,
              ct.max_users, ct.max_devices, ct.allow_local_desktop, ct.offline_grace_hours
       FROM tenant_installations ti
       JOIN cloud_tenants ct ON ct.id = ti.tenant_id
       WHERE ti.sync_token_hash = ?`
    )
    .get(tokenHash) as any;

  if (!row) {
    return {
      ok: false,
      status: 401,
      code: "invalid_sync_token",
      error: "جلسة الجهاز غير صالحة أو تم إلغاء ربطها. يرجى إعادة تسجيل الدخول.",
    };
  }

  if (row.status === "blocked" || row.status === "revoked") {
    return {
      ok: false,
      status: 403,
      code: "device_revoked",
      error: "تم حظر أو إلغاء تفويض هذا الجهاز من لوحة تحكم المطور. تم رفض المزامنة.",
    };
  }

  const policy = getTenantPolicyStatus(row);
  if (!policy.allowed) {
    return {
      ok: false,
      status: 403,
      code: policy.code || "license_expired",
      error: policy.reason || "انتهت صلاحية الترخيص السحابي أو تم تعليقه.",
    };
  }

  if (!row.allow_local_desktop) {
    return {
      ok: false,
      status: 403,
      code: "local_disabled",
      error: "تم إيقاف المزامنة المكتبية لهذه المؤسسة.",
    };
  }

  try {
    masterDb
      .prepare("UPDATE tenant_installations SET last_seen_at = datetime('now', 'localtime'), license_status = ? WHERE id = ?")
      .run(row.license_status || "active", row.id);
  } catch {}

  return {
    ok: true,
    tenantId: Number(row.tenant_id),
    installationId: String(row.installation_id),
    deviceId: String(row.device_id),
    tenant: {
      id: row.ct_id,
      tenant_code: row.tenant_code,
      company_name: row.company_name,
      package_name: row.package_name,
      subscription_status: row.subscription_status,
      license_status: row.license_status,
      license_start_date: row.license_start_date,
      license_expires_at: row.license_expires_at,
      max_users: row.max_users,
      max_devices: row.max_devices,
      allow_local_desktop: row.allow_local_desktop,
      offline_grace_hours: row.offline_grace_hours,
    },
    installation: row,
  };
}

function resolveTenantUploadRoot(tenantId: number): string {
  const base = path.resolve(process.cwd(), "public/uploads");
  if (tenantId <= 1) return base;
  return path.join(base, "tenants", String(tenantId));
}

function collectUploadFilesForTables(
  tablesData: Record<string, any[]>,
  tenantId: number
): { fileUuid: string; relativePath: string; checksumSha256: string; fileSize: number }[] {
  const foundPaths = new Set<string>();
  const uploadRegex = /\/uploads\/[^\s"'<>]+/g;

  for (const rows of Object.values(tablesData)) {
    for (const row of rows) {
      for (const val of Object.values(row)) {
        if (typeof val === "string" && val.includes("/uploads/")) {
          const matches = val.match(uploadRegex);
          if (matches) {
            for (const m of matches) foundPaths.add(m);
          }
        }
      }
    }
  }

  const baseRoot = path.resolve(process.cwd(), "public/uploads");
  const tenantRoot = resolveTenantUploadRoot(tenantId);
  const manifest: { fileUuid: string; relativePath: string; checksumSha256: string; fileSize: number }[] = [];

  for (const urlPath of foundPaths) {
    const cleanRel = urlPath.replace(/^\/uploads\//, "").replace(/\.\./g, "");
    let diskPath = path.join(tenantRoot, cleanRel);
    if (!fs.existsSync(diskPath)) {
      diskPath = path.join(baseRoot, cleanRel);
    }
    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
      const sha = computeFileSha256(diskPath);
      if (sha) {
        const st = fs.statSync(diskPath);
        manifest.push({
          fileUuid: crypto.createHash("sha256").update(`${tenantId}:${cleanRel}`).digest("hex").slice(0, 32),
          relativePath: cleanRel,
          checksumSha256: sha,
          fileSize: st.size,
        });
      }
    }
  }

  return manifest;
}

/**
 * Cloud Server Side: Export complete ordered snapshot for Tenant bootstrap
 */
export function exportTenantBootstrapSnapshot(tenantId: number): {
  tenantId: number;
  cloudMaxSeq: number;
  dbVersion: string;
  tables: Record<string, any[]>;
  files: { fileUuid: string; relativePath: string; checksumSha256: string; fileSize: number }[];
} {
  const tDb = getTenantDb(tenantId);
  ensureSyncMetadataAndTriggers(tDb, tenantId, true);

  const tables: Record<string, any[]> = {};
  for (const cfg of SYNC_TABLES_ORDERED) {
    if (!tableExists(tDb, cfg.table)) continue;
    const cols = getTableColumns(tDb, cfg.table);
    let rows: any[] = [];
    if (cols.includes("tenant_id")) {
      rows = tDb
        .prepare(`SELECT * FROM "${cfg.table}" WHERE COALESCE(tenant_id, ?) = ?`)
        .all(tenantId, tenantId);
    } else {
      rows = tDb.prepare(`SELECT * FROM "${cfg.table}"`).all();
    }
    // Never include developer account inside tenant > 1 export
    if (cfg.table === "users" && tenantId > 1) {
      rows = rows.filter((u) => u.username?.toLowerCase() !== "developer" && u.role !== "developer");
    }
    tables[cfg.table] = rows;
  }

  const seqRow = tDb
    .prepare("SELECT COALESCE(MAX(seq), 0) as max_seq FROM sync_change_log WHERE tenant_id = ?")
    .get(tenantId) as { max_seq: number };

  const files = collectUploadFilesForTables(tables, tenantId);

  return {
    tenantId,
    cloudMaxSeq: Number(seqRow?.max_seq || 0),
    dbVersion: HYBRID_DB_VERSION,
    tables,
    files,
  };
}

/**
 * Helper: Attach foreign key sync_uuid map to an outbound change row
 */
function buildFkUuidsForRow(targetDb: any, tableName: string, payload: Record<string, any>): Record<string, string> {
  const cfg = SYNC_TABLE_MAP.get(tableName);
  const fkMap = cfg?.fkMap;
  const out: Record<string, string> = {};
  if (!fkMap || !payload) return out;

  for (const [col, parentTable] of Object.entries(fkMap)) {
    const rawId = payload[col];
    if (rawId !== null && rawId !== undefined && rawId !== "") {
      try {
        const parentRow = targetDb
          .prepare(`SELECT sync_uuid FROM "${parentTable}" WHERE id = ?`)
          .get(rawId) as { sync_uuid?: string } | undefined;
        if (parentRow?.sync_uuid) {
          out[col] = parentRow.sync_uuid;
        }
      } catch {}
    }
  }
  return out;
}

/**
 * Helper: Remap incoming foreign keys from *_sync_uuid -> local target auto-increment id
 */
function remapIncomingForeignKeys(
  targetDb: any,
  tableName: string,
  payload: Record<string, any>,
  fkUuids?: Record<string, string>
): void {
  const cfg = SYNC_TABLE_MAP.get(tableName);
  const fkMap = cfg?.fkMap;
  if (!fkMap || !fkUuids) return;

  for (const [col, parentTable] of Object.entries(fkMap)) {
    const parentUuid = fkUuids[col];
    if (parentUuid) {
      try {
        const row = targetDb
          .prepare(`SELECT id FROM "${parentTable}" WHERE sync_uuid = ?`)
          .get(parentUuid) as { id?: number } | undefined;
        if (row?.id !== undefined) {
          payload[col] = row.id;
        }
      } catch {}
    }
  }
}

/**
 * Helper: Locate record on destination DB using sync_uuid first, then natural unique keys
 */
function findTargetRecord(
  targetDb: any,
  cfg: SyncTableConfig,
  syncUuid: string,
  payload: Record<string, any>
): any {
  const cols = getTableColumns(targetDb, cfg.table);
  if (cols.includes("sync_uuid") && syncUuid) {
    const byUuid = targetDb
      .prepare(`SELECT * FROM "${cfg.table}" WHERE sync_uuid = ? LIMIT 1`)
      .get(syncUuid);
    if (byUuid) return byUuid;
  }

  if (cfg.naturalKey) {
    const keys = Array.isArray(cfg.naturalKey) ? cfg.naturalKey : [cfg.naturalKey];
    const hasAll = keys.every((k) => cols.includes(k) && payload?.[k] !== undefined && payload?.[k] !== null && payload?.[k] !== "");
    if (hasAll) {
      const whereClause = keys.map((k) => `"${k}" = ?`).join(" AND ");
      const vals = keys.map((k) => payload[k]);
      const byNat = targetDb.prepare(`SELECT * FROM "${cfg.table}" WHERE ${whereClause} LIMIT 1`).get(...vals);
      if (byNat) return byNat;
    }
  }

  return undefined;
}

function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  return String(a ?? "") === String(b ?? "");
}

function recordConflictRow(
  targetDb: any,
  params: {
    tenantId: number;
    tableName: string;
    recordId: string;
    syncUuid: string;
    conflictReason: string;
    localVersion: number;
    cloudVersion: number;
    localPayload: any;
    cloudPayload: any;
    basePayload: any;
    conflictFields: string[];
    autoMergedFields?: string[];
  }
): number {
  const res = targetDb
    .prepare(
      `INSERT INTO sync_conflicts (
        tenant_id, table_name, record_id, sync_uuid, conflict_reason,
        local_version, cloud_version, local_payload_json, cloud_payload_json,
        base_payload_json, conflict_fields_json, auto_merged_fields_json, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(
      params.tenantId,
      params.tableName,
      String(params.recordId || ""),
      params.syncUuid,
      params.conflictReason,
      params.localVersion,
      params.cloudVersion,
      JSON.stringify(params.localPayload || {}),
      JSON.stringify(params.cloudPayload || {}),
      JSON.stringify(params.basePayload || {}),
      JSON.stringify(params.conflictFields || []),
      JSON.stringify(params.autoMergedFields || [])
    );
  return Number(res.lastInsertRowid);
}

/**
 * Apply a single incoming operation (used both by Cloud Push receiver AND Local Pull receiver).
 * Executes safely inside an active transaction with sync_internal_guard suppressed!
 */
export function applyIncomingOperation(
  targetDb: any,
  tenantId: number,
  op: {
    sync_op_id: string;
    table_name: string;
    record_id: string;
    sync_uuid: string;
    operation: "INSERT" | "UPDATE" | "DELETE";
    record_version: number;
    payload: Record<string, any>;
    previous?: Record<string, any> | null;
    fk_uuids?: Record<string, string>;
  },
  contextSide: "cloud" | "local"
): {
  op_id: string;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  server_version?: number;
  conflict?: any;
  reason?: string;
} {
  // 1. Strict Idempotency Check
  const already = targetDb
    .prepare("SELECT sync_op_id FROM sync_applied_ops WHERE sync_op_id = ?")
    .get(op.sync_op_id);
  if (already) {
    return { op_id: op.sync_op_id, status: "duplicate" };
  }

  const cfg = SYNC_TABLE_MAP.get(op.table_name);
  if (!cfg || !tableExists(targetDb, op.table_name)) {
    targetDb
      .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
      .run(op.sync_op_id, tenantId, op.table_name, op.sync_uuid);
    return { op_id: op.sync_op_id, status: "rejected", reason: `جدول غير معروف للمزامنة: ${op.table_name}` };
  }

  const cols = getTableColumns(targetDb, cfg.table);
  const payload: Record<string, any> = { ...(op.payload || {}) };
  payload.tenant_id = tenantId;
  if (op.sync_uuid) payload.sync_uuid = op.sync_uuid;

  // Remap foreign keys using canonical parent sync_uuid
  remapIncomingForeignKeys(targetDb, cfg.table, payload, op.fk_uuids);

  const existing = findTargetRecord(targetDb, cfg, op.sync_uuid, payload);

  // Guard: Unsynced DELETE protection & Strict Financial Immutability
  if (op.operation === "DELETE") {
    if (cfg.immutableFinancial) {
      if (existing) {
        const conflictId = recordConflictRow(targetDb, {
          tenantId,
          tableName: cfg.table,
          recordId: String(existing[cfg.pk] || op.record_id),
          syncUuid: op.sync_uuid,
          conflictReason: "financial_immutability_guard",
          localVersion: op.record_version,
          cloudVersion: Number(existing.record_version || 1),
          localPayload: contextSide === "cloud" ? { deleted: 1, ...op.previous } : existing,
          cloudPayload: contextSide === "cloud" ? existing : { deleted: 1, ...op.previous },
          basePayload: op.previous || {},
          conflictFields: ["__financial_delete_blocked__"],
        });
        targetDb
          .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
          .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
        const conflictRow = targetDb.prepare("SELECT * FROM sync_conflicts WHERE id = ?").get(conflictId);
        return {
          op_id: op.sync_op_id,
          status: "conflict",
          server_version: Number(existing.record_version || 1),
          conflict: conflictRow,
          reason: "السجلات والقيود المالية محمية ضد الحذف الصامت — يتطلب مراجعة أو قيد عكسي.",
        };
      }
      targetDb
        .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
        .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
      return { op_id: op.sync_op_id, status: "applied" };
    }

    if (existing) {
      const pkVal = existing[cfg.pk];
      targetDb.prepare(`DELETE FROM "${cfg.table}" WHERE "${cfg.pk}" = ?`).run(pkVal);
    }
    targetDb
      .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
      .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
    return { op_id: op.sync_op_id, status: "applied" };
  }

  // Filter payload strictly to valid destination columns
  const validCols = cols.filter((c) => Object.prototype.hasOwnProperty.call(payload, c));

  if (!existing) {
    // INSERT path
    let insertCols = validCols;
    if (cfg.pk === "id" && insertCols.includes("id") && payload.id !== undefined) {
      // Check if auto-increment id collides with another record having a different sync_uuid
      const occupant = targetDb
        .prepare(`SELECT id, sync_uuid FROM "${cfg.table}" WHERE id = ?`)
        .get(payload.id) as { id: number; sync_uuid?: string } | undefined;
      if (occupant && occupant.sync_uuid !== op.sync_uuid) {
        insertCols = insertCols.filter((c) => c !== "id");
      }
    }

    const colSql = insertCols.map((c) => `"${c}"`).join(", ");
    const placeholders = insertCols.map(() => "?").join(", ");
    const values = insertCols.map((c) => payload[c]);

    targetDb.prepare(`INSERT INTO "${cfg.table}" (${colSql}) VALUES (${placeholders})`).run(...values);
    targetDb
      .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
      .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);

    // Mirror user inserts into masterDb directory if running on Cloud Tenant > 1
    if (contextSide === "cloud" && cfg.table === "users" && tenantId > 1 && payload.username) {
      try {
        const cleanU = String(payload.username).trim();
        const existingMaster = masterDb
          .prepare("SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND tenant_id = ?")
          .get(cleanU.toLowerCase(), tenantId) as { id: number } | undefined;
        if (existingMaster) {
          masterDb
            .prepare(
              `UPDATE users SET password_hash = COALESCE(?, password_hash), name = ?, role = ?, active = ?, can_discount = ?
               WHERE id = ?`
            )
            .run(
              payload.password_hash || null,
              payload.name || cleanU,
              payload.role || "sales",
              payload.active ?? 1,
              payload.can_discount ?? 0,
              existingMaster.id
            );
        } else {
          masterDb
            .prepare(
              `INSERT OR IGNORE INTO users (username, password_hash, name, role, active, can_discount, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              cleanU,
              payload.password_hash,
              payload.name || cleanU,
              payload.role || "sales",
              payload.active ?? 1,
              payload.can_discount ?? 0,
              tenantId
            );
        }
      } catch {}
    }

    return { op_id: op.sync_op_id, status: "applied", server_version: Number(payload.record_version || 1) };
  }

  // UPDATE path (existing record found)
  const existingVer = Number(existing.record_version || 1);
  const incomingVer = Number(op.record_version || 1);
  const previousObj = op.previous || {};
  const baseVersion =
    previousObj && previousObj.record_version !== undefined
      ? Number(previousObj.record_version)
      : Math.max(0, incomingVer - 1);

  // Check if there are pending local un-synced changes on this same sync_uuid when pulling on Local
  const localPendingForRecord =
    contextSide === "local"
      ? (targetDb
          .prepare("SELECT COUNT(*) as c FROM sync_change_log WHERE sync_uuid = ? AND synced = 0")
          .get(op.sync_uuid) as { c: number })?.c || 0
      : 0;

  const isConcurrentConflict =
    contextSide === "cloud"
      ? existingVer > baseVersion
      : localPendingForRecord > 0 || existingVer > baseVersion;

  if (cfg.immutableFinancial && isConcurrentConflict) {
    const conflictId = recordConflictRow(targetDb, {
      tenantId,
      tableName: cfg.table,
      recordId: String(existing[cfg.pk]),
      syncUuid: op.sync_uuid,
      conflictReason: "financial_immutability_guard",
      localVersion: contextSide === "cloud" ? incomingVer : existingVer,
      cloudVersion: contextSide === "cloud" ? existingVer : incomingVer,
      localPayload: contextSide === "cloud" ? payload : existing,
      cloudPayload: contextSide === "cloud" ? existing : payload,
      basePayload: previousObj,
      conflictFields: ["__financial_immutable__"],
    });
    targetDb
      .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
      .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
    const conflictRow = targetDb.prepare("SELECT * FROM sync_conflicts WHERE id = ?").get(conflictId);
    return {
      op_id: op.sync_op_id,
      status: "conflict",
      server_version: existingVer,
      conflict: conflictRow,
      reason: "السجل المالي محمي ضد التعديل المتزامن ويتطلب مراجعة.",
    };
  }

  if (isConcurrentConflict) {
    // 3-Way Field-Level Diff & Safe Non-Conflicting Merge
    const changedByIncoming: string[] = [];
    const changedByExisting: string[] = [];
    const conflictFields: string[] = [];
    const hasPreviousSnapshot = previousObj && Object.keys(previousObj).length > 0;

    for (const col of validCols) {
      if (META_IGNORE_KEYS.has(col)) continue;
      const inVal = payload[col];
      const exVal = existing[col];
      const baseVal = hasPreviousSnapshot ? previousObj[col] : undefined;

      const inChanged = hasPreviousSnapshot ? !valuesEqual(inVal, baseVal) : !valuesEqual(inVal, exVal);
      const exChanged = hasPreviousSnapshot ? !valuesEqual(exVal, baseVal) : true;

      if (inChanged) changedByIncoming.push(col);
      if (exChanged) changedByExisting.push(col);

      if (inChanged && exChanged && !valuesEqual(inVal, exVal)) {
        conflictFields.push(col);
      }
    }

    if (conflictFields.length > 0) {
      const conflictId = recordConflictRow(targetDb, {
        tenantId,
        tableName: cfg.table,
        recordId: String(existing[cfg.pk]),
        syncUuid: op.sync_uuid,
        conflictReason: "concurrent_field_conflict",
        localVersion: contextSide === "cloud" ? incomingVer : existingVer,
        cloudVersion: contextSide === "cloud" ? existingVer : incomingVer,
        localPayload: contextSide === "cloud" ? payload : existing,
        cloudPayload: contextSide === "cloud" ? existing : payload,
        basePayload: previousObj,
        conflictFields,
      });
      targetDb
        .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
        .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
      const conflictRow = targetDb.prepare("SELECT * FROM sync_conflicts WHERE id = ?").get(conflictId);
      return {
        op_id: op.sync_op_id,
        status: "conflict",
        server_version: existingVer,
        conflict: conflictRow,
        reason: `تضارب متزامن في الحقول: ${conflictFields.join(", ")}`,
      };
    }

    // Disjoint safe field merge
    const updateCols = changedByIncoming.filter((c) => cols.includes(c));
    if (updateCols.length > 0) {
      const nextVer = Math.max(existingVer, incomingVer) + 1;
      const setSql = [
        ...updateCols.map((c) => `"${c}" = ?`),
        "record_version = ?",
        "sync_updated_at = ?",
      ].join(", ");
      const vals = [
        ...updateCols.map((c) => payload[c]),
        nextVer,
        new Date().toISOString(),
        existing[cfg.pk],
      ];
      targetDb.prepare(`UPDATE "${cfg.table}" SET ${setSql} WHERE "${cfg.pk}" = ?`).run(...vals);
      targetDb
        .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
        .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);
      return { op_id: op.sync_op_id, status: "applied", server_version: nextVer };
    }
  }

  // Standard clean fast-forward UPDATE (preserve destination PK id)
  const updateCols = validCols.filter((c) => c !== cfg.pk && c !== "id");
  const nextVer = Math.max(existingVer + 1, incomingVer);
  if (updateCols.length > 0) {
    const setSql = updateCols.map((c) => `"${c}" = ?`).join(", ");
    const vals = updateCols.map((c) => (c === "record_version" ? nextVer : payload[c]));
    targetDb
      .prepare(`UPDATE "${cfg.table}" SET ${setSql} WHERE "${cfg.pk}" = ?`)
      .run(...vals, existing[cfg.pk]);
  }

  targetDb
    .prepare("INSERT OR IGNORE INTO sync_applied_ops (sync_op_id, tenant_id, table_name, sync_uuid) VALUES (?, ?, ?, ?)")
    .run(op.sync_op_id, tenantId, cfg.table, op.sync_uuid);

  // Mirror user updates into masterDb directory when Cloud Tenant > 1 receives local user edits
  if (contextSide === "cloud" && cfg.table === "users" && tenantId > 1 && (payload.username || existing.username)) {
    try {
      const cleanU = String(payload.username || existing.username).trim();
      const masterU = masterDb
        .prepare("SELECT id FROM users WHERE LOWER(TRIM(username)) = ? AND tenant_id = ?")
        .get(cleanU.toLowerCase(), tenantId) as { id: number } | undefined;
      if (masterU) {
        masterDb
          .prepare(
            `UPDATE users SET password_hash = COALESCE(?, password_hash), name = ?, role = ?, active = ?, can_discount = ? WHERE id = ?`
          )
          .run(
            payload.password_hash ?? null,
            payload.name ?? existing.name ?? cleanU,
            payload.role ?? existing.role ?? "sales",
            payload.active ?? existing.active ?? 1,
            payload.can_discount ?? existing.can_discount ?? 0,
            masterU.id
          );
      } else if (payload.password_hash || existing.password_hash) {
        masterDb
          .prepare(
            `INSERT OR IGNORE INTO users (username, password_hash, name, role, active, can_discount, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            cleanU,
            payload.password_hash || existing.password_hash,
            payload.name ?? existing.name ?? cleanU,
            payload.role ?? existing.role ?? "sales",
            payload.active ?? existing.active ?? 1,
            payload.can_discount ?? existing.can_discount ?? 0,
            tenantId
          );
      }
    } catch {}
  }

  return { op_id: op.sync_op_id, status: "applied", server_version: nextVer };
}

/**
 * Cloud Server Side: Ingest pushed batch from Local Electron
 */
export function processCloudPushBatch(
  tenantId: number,
  installationId: string,
  ops: any[]
): {
  results: any[];
  cloudMaxSeq: number;
  appliedCount: number;
  conflictCount: number;
} {
  const tDb = getTenantDb(tenantId);
  ensureSyncMetadataAndTriggers(tDb, tenantId, true);

  const results: any[] = [];
  let appliedCount = 0;
  let conflictCount = 0;

  const execBatch = tDb.transaction(() => {
    // IMPORTANT: On Cloud, we want incoming applied records NOT to re-queue to sync_applied_ops as loop,
    // wait: SHOULD incoming changes from Installation 1 be logged in Cloud sync_change_log so Installation 2 can pull them?
    // Keeping suppress = 1 avoids re-generating duplicate ops back to the SAME installation; instead,
    // we record remote ops cleanly with source_env='local', installation_id=installationId so the originating
    // installation skips its own pushed ops by sync_op_id / seq, AND Cloud sync_change_log advances cleanly!
    tDb.prepare("UPDATE sync_internal_guard SET suppress = 1 WHERE id = 1").run();
    try {
      for (const rawOp of ops) {
        const res = applyIncomingOperation(tDb, tenantId, rawOp, "cloud");
        results.push(res);
        if (res.status === "applied") {
          appliedCount++;
          // Append acknowledged op into Cloud change_log with originating installation_id for multi-device propagation
          tDb
            .prepare(
              `INSERT OR IGNORE INTO sync_change_log (
                sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
                payload_json, previous_json, fk_uuids_json, source_env, installation_id, synced
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?, 1)`
            )
            .run(
              rawOp.sync_op_id,
              tenantId,
              rawOp.table_name,
              String(rawOp.record_id || ""),
              rawOp.sync_uuid,
              rawOp.operation,
              res.server_version || rawOp.record_version || 1,
              JSON.stringify(rawOp.payload || {}),
              rawOp.previous ? JSON.stringify(rawOp.previous) : null,
              rawOp.fk_uuids ? JSON.stringify(rawOp.fk_uuids) : null,
              installationId
            );
        } else if (res.status === "conflict") {
          conflictCount++;
        }
      }
    } finally {
      tDb.prepare("UPDATE sync_internal_guard SET suppress = 0 WHERE id = 1").run();
    }
  });

  execBatch();

  const maxSeqRow = tDb
    .prepare("SELECT COALESCE(MAX(seq), 0) as max_seq FROM sync_change_log WHERE tenant_id = ?")
    .get(tenantId) as { max_seq: number };
  const cloudMaxSeq = Number(maxSeqRow?.max_seq || 0);

  try {
    masterDb
      .prepare(
        `UPDATE tenant_installations
         SET last_successful_sync = datetime('now', 'localtime'),
             last_uploaded_seq = ?,
             sync_status = ?,
             last_seen_at = datetime('now', 'localtime')
         WHERE tenant_id = ? AND installation_id = ?`
      )
      .run(
        cloudMaxSeq,
        conflictCount > 0 ? "Conflict Detected" : "Synced",
        tenantId,
        installationId
      );

    tDb
      .prepare(
        `INSERT INTO sync_logs (tenant_id, installation_id, direction, status, uploaded_count, conflicts_count)
         VALUES (?, ?, 'push', ?, ?, ?)`
      )
      .run(
        tenantId,
        installationId,
        conflictCount > 0 ? "conflict" : "success",
        appliedCount,
        conflictCount
      );
  } catch {}

  return { results, cloudMaxSeq, appliedCount, conflictCount };
}

/**
 * Cloud Server Side: Pull incremental deltas since_seq for a specific tenant
 */
export function pullCloudDeltasForTenant(
  tenantId: number,
  installationId: string,
  sinceSeq = 0,
  limit = 250
): {
  changes: any[];
  cloudMaxSeq: number;
  hasMore: boolean;
} {
  const tDb = getTenantDb(tenantId);
  const safeLimit = Math.min(500, Math.max(1, Number(limit) || 250));
  const safeSince = Math.max(0, Number(sinceSeq) || 0);

  const rows = tDb
    .prepare(
      `SELECT * FROM sync_change_log
       WHERE tenant_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`
    )
    .all(tenantId, safeSince, safeLimit + 1) as any[];

  const hasMore = rows.length > safeLimit;
  const slice = rows.slice(0, safeLimit);

  // Exclude changes that originated from THIS exact installation_id (already applied locally & marked synced)
  const changes = slice
    .filter((r) => !(r.source_env === "local" && r.installation_id === installationId))
    .map((r) => {
      let payload = {};
      let previous = null;
      let fkUuids = {};
      try { payload = JSON.parse(r.payload_json || "{}"); } catch {}
      try { previous = r.previous_json ? JSON.parse(r.previous_json) : null; } catch {}
      try { fkUuids = r.fk_uuids_json ? JSON.parse(r.fk_uuids_json) : buildFkUuidsForRow(tDb, r.table_name, payload); } catch {}
      return {
        seq: r.seq,
        sync_op_id: r.sync_op_id,
        table_name: r.table_name,
        record_id: r.record_id,
        sync_uuid: r.sync_uuid,
        operation: r.operation,
        record_version: r.record_version,
        payload,
        previous,
        fk_uuids: fkUuids,
        source_env: r.source_env,
        created_at: r.created_at,
      };
    });

  const maxRow = tDb
    .prepare("SELECT COALESCE(MAX(seq), 0) as max_seq FROM sync_change_log WHERE tenant_id = ?")
    .get(tenantId) as { max_seq: number };
  const cloudMaxSeq = Number(maxRow?.max_seq || 0);
  const ackSeq = slice.length > 0 ? Number(slice[slice.length - 1].seq) : safeSince;

  try {
    masterDb
      .prepare(
        `UPDATE tenant_installations
         SET last_downloaded_seq = MAX(last_downloaded_seq, ?),
             last_seen_at = datetime('now', 'localtime')
         WHERE tenant_id = ? AND installation_id = ?`
      )
      .run(ackSeq, tenantId, installationId);
  } catch {}

  return { changes, cloudMaxSeq, hasMore };
}

/**
 * Local Client Side: Hydrate fresh Local DB from Cloud Tenant Bootstrap snapshot
 */
export function applyBootstrapSnapshotLocally(params: {
  snapshot: {
    tenantId: number;
    cloudMaxSeq: number;
    dbVersion: string;
    tables: Record<string, any[]>;
    files?: { fileUuid: string; relativePath: string; checksumSha256: string; fileSize: number }[];
  };
  cloudUrl: string;
  deviceSyncToken: string;
  licenseSnapshot: OfflineLicenseSnapshot;
  tenant: any;
  user: any;
}): void {
  const { snapshot, cloudUrl, deviceSyncToken, licenseSnapshot, tenant, user } = params;
  const tenantId = Number(snapshot.tenantId);

  // Create safe backup before mutating local DB
  createSafeDatabaseBackup("pre-bootstrap", getActiveDatabasePath());

  // Preserve any pre-existing unsynced offline local operations created before cloud linking so ZERO data is ever lost
  const preExistingLocalOps: any[] = [];
  try {
    const rawPending = masterDb
      .prepare(
        `SELECT * FROM sync_change_log
         WHERE synced = 0 AND COALESCE(source_env, 'local') = 'local'
         ORDER BY seq ASC`
      )
      .all() as any[];
    for (const r of rawPending) {
      let payload: any = {};
      try { payload = JSON.parse(r.payload_json || "{}"); } catch {}
      const fkUuids = buildFkUuidsForRow(masterDb, r.table_name, payload);
      preExistingLocalOps.push({ ...r, payloadObj: payload, fkUuidsObj: fkUuids });
    }
  } catch {}

  // Build lookup set of sync_uuids already present in the authoritative Cloud snapshot
  const snapshotUuidSet = new Set<string>();
  for (const tbl of Object.keys(snapshot.tables || {})) {
    for (const row of snapshot.tables[tbl] || []) {
      if (row?.sync_uuid) snapshotUuidSet.add(`${tbl}:${row.sync_uuid}`);
    }
  }

  const execHydration = masterDb.transaction(() => {
    masterDb.prepare("UPDATE sync_internal_guard SET suppress = 1 WHERE id = 1").run();

    try {
      // Clear local operational tables in reverse dependency order before hydrating Cloud snapshot
      for (const cfg of [...SYNC_TABLES_ORDERED].reverse()) {
        if (!tableExists(masterDb, cfg.table)) continue;
        masterDb.exec(`DELETE FROM "${cfg.table}"`);
        if (cfg.pk === "id") {
          try {
            masterDb.exec(`DELETE FROM sqlite_sequence WHERE name='${cfg.table}'`);
          } catch {}
        }
      }

      // Clear previous sync metadata before hydrating authoritative baseline
      masterDb.exec("DELETE FROM sync_change_log");
      masterDb.exec("DELETE FROM sync_applied_ops");
      masterDb.exec("DELETE FROM sync_conflicts");
      masterDb.exec("DELETE FROM sync_file_queue");

      // Insert hydrated Cloud rows in topological dependency order
      for (const cfg of SYNC_TABLES_ORDERED) {
        if (!tableExists(masterDb, cfg.table)) continue;
        const rows = snapshot.tables[cfg.table] || [];
        if (rows.length === 0) continue;

        const destCols = getTableColumns(masterDb, cfg.table);
        for (const row of rows) {
          const validCols = destCols.filter((c) => Object.prototype.hasOwnProperty.call(row, c));
          if (validCols.length === 0) continue;
          const colSql = validCols.map((c) => `"${c}"`).join(", ");
          const placeholders = validCols.map(() => "?").join(", ");
          const vals = validCols.map((c) => (c === "tenant_id" ? tenantId : row[c]));
          masterDb.prepare(`INSERT OR REPLACE INTO "${cfg.table}" (${colSql}) VALUES (${placeholders})`).run(...vals);
        }
      }

      // Re-apply and re-queue any pre-existing unsynced local operations created while offline before cloud link
      // Skip only pure seed/config tables so system defaults from Cloud aren't duplicated, while all business records (bookings, visas, customers, suppliers, invoices, vouchers, WhatsApp config, users) are safely preserved & queued for immediate upload!
      const SAFE_MERGE_SKIP_TABLES = new Set(["settings", "roles_permissions", "payment_methods", "loyalty_settings", "pos_themes", "branches", "warehouses", "accounts", "cost_centers", "safes", "bank_accounts"]);
      for (const opRow of preExistingLocalOps) {
        const tbl = String(opRow.table_name || "");
        if (SAFE_MERGE_SKIP_TABLES.has(tbl)) continue;
        const cfg = SYNC_TABLE_MAP.get(tbl);
        if (!cfg || !tableExists(masterDb, tbl)) continue;

        const payload: Record<string, any> = { ...(opRow.payloadObj || {}), tenant_id: tenantId };
        if (opRow.sync_uuid) payload.sync_uuid = opRow.sync_uuid;
        const alreadyInCloud = snapshotUuidSet.has(`${tbl}:${opRow.sync_uuid}`);

        if (opRow.operation === "INSERT" && !alreadyInCloud) {
          remapIncomingForeignKeys(masterDb, tbl, payload, opRow.fkUuidsObj);
          const cols = getTableColumns(masterDb, tbl);
          let validCols = cols.filter((c) => Object.prototype.hasOwnProperty.call(payload, c));
          if (cfg.pk === "id" && validCols.includes("id")) {
            validCols = validCols.filter((c) => c !== "id");
          }
          if (validCols.length > 0) {
            const colSql = validCols.map((c) => `"${c}"`).join(", ");
            const placeholders = validCols.map(() => "?").join(", ");
            const vals = validCols.map((c) => payload[c]);
            try {
              const info = masterDb.prepare(`INSERT OR IGNORE INTO "${tbl}" (${colSql}) VALUES (${placeholders})`).run(...vals);
              const newId = info?.lastInsertRowid ? String(info.lastInsertRowid) : String(opRow.record_id || "");
              masterDb
                .prepare(
                  `INSERT OR IGNORE INTO sync_change_log (
                    sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
                    payload_json, previous_json, fk_uuids_json, source_env, installation_id, synced
                  ) VALUES (?, ?, ?, ?, ?, 'INSERT', ?, ?, ?, ?, 'local', ?, 0)`
                )
                .run(
                  opRow.sync_op_id || crypto.randomUUID(),
                  tenantId,
                  tbl,
                  newId,
                  opRow.sync_uuid,
                  Number(opRow.record_version || 1),
                  JSON.stringify(payload),
                  opRow.previous_json || null,
                  JSON.stringify(opRow.fkUuidsObj || {}),
                  licenseSnapshot.installationId || ""
                );
            } catch {}
          }
        } else if (alreadyInCloud && opRow.operation === "UPDATE") {
          // Preserve offline modification for normal bidirectional conflict/merge upload
          masterDb
            .prepare(
              `INSERT OR IGNORE INTO sync_change_log (
                sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
                payload_json, previous_json, fk_uuids_json, source_env, installation_id, synced
              ) VALUES (?, ?, ?, ?, ?, 'UPDATE', ?, ?, ?, ?, 'local', ?, 0)`
            )
            .run(
              opRow.sync_op_id || crypto.randomUUID(),
              tenantId,
              tbl,
              String(opRow.record_id || ""),
              opRow.sync_uuid,
              Number(opRow.record_version || 1),
              JSON.stringify(payload),
              opRow.previous_json || null,
              JSON.stringify(opRow.fkUuidsObj || {}),
              licenseSnapshot.installationId || ""
            );
        }
      }

      // Queue any missing files for background/sync download
      for (const f of snapshot.files || []) {
        masterDb
          .prepare(
            `INSERT OR IGNORE INTO sync_file_queue (tenant_id, file_uuid, relative_path, checksum_sha256, file_size, direction, status)
             VALUES (?, ?, ?, ?, ?, 'download', 'pending')`
          )
          .run(tenantId, f.fileUuid, f.relativePath, f.checksumSha256 || "", Number(f.fileSize || 0));
      }

      const encSyncToken = encryptHybridSecret(deviceSyncToken);
      const encLicense = encryptJsonPayload(licenseSnapshot);

      masterDb
        .prepare(
          `UPDATE sync_runtime_config
           SET mode = 'local',
               cloud_server_url = ?,
               device_id = ?,
               installation_id = ?,
               tenant_id = ?,
               tenant_code = ?,
               company_name = ?,
               cloud_account_id = ?,
               encrypted_sync_token = ?,
               encrypted_license_snapshot = ?,
               is_bootstrapped = 1,
               last_successful_sync = datetime('now', 'localtime'),
               last_downloaded_seq = ?,
               last_uploaded_seq = ?,
               sync_status = 'Synced',
               last_error = '',
               updated_at = datetime('now', 'localtime')
           WHERE id = 1`
        )
        .run(
          cloudUrl,
          licenseSnapshot.deviceId || "",
          licenseSnapshot.installationId || "",
          tenantId,
          String(tenant.tenant_code || ""),
          String(tenant.company_name || ""),
          String(user?.id || ""),
          encSyncToken,
          encLicense,
          snapshot.cloudMaxSeq || 0,
          snapshot.cloudMaxSeq || 0
        );

      masterDb
        .prepare(
          `INSERT INTO sync_logs (tenant_id, installation_id, direction, status, downloaded_count, uploaded_count, files_synced)
           VALUES (?, ?, 'bootstrap', 'success', ?, 0, 0)`
        )
        .run(
          tenantId,
          licenseSnapshot.installationId,
          Object.values(snapshot.tables).reduce((acc, arr) => acc + arr.length, 0)
        );
    } finally {
      masterDb.prepare("UPDATE sync_internal_guard SET suppress = 0 WHERE id = 1").run();
    }
  });

  masterDb.pragma("foreign_keys = OFF");
  try {
    execHydration();
  } finally {
    masterDb.pragma("foreign_keys = ON");
  }

  // Persist installation binding metadata outside session storage too
  persistInstallationFileMetadata(getDbDir(), {
    installationId: licenseSnapshot.installationId,
    cloudUrl,
    tenantId,
    tenantCode: String(tenant.tenant_code || ""),
    encryptedSyncToken: encryptHybridSecret(deviceSyncToken),
  });
}

/**
 * Local Client Side: Get current Sync Center full dashboard state
 */
export function getLocalSyncStatusSummary(overrideTenantId?: number): {
  mode: "cloud" | "local";
  status: SyncLifecycleStatus;
  connectionOnline: boolean;
  cloudServerUrl: string;
  installationId: string;
  deviceId: string;
  tenantId: number;
  tenantCode: string;
  companyName: string;
  isBootstrapped: boolean;
  localDbVersion: string;
  cloudDbVersion: string;
  appVersion: string;
  lastSuccessfulSync: string | null;
  lastDownloadedSeq: number;
  lastUploadedSeq: number;
  pendingUploadsCount: number;
  syncedRecordsCount: number;
  pendingFilesCount: number;
  unresolvedConflictsCount: number;
  autoSyncEnabled: boolean;
  autoSyncIntervalSec: number;
  lastError: string;
  licensePolicy: {
    allowed: boolean;
    code?: string;
    reason?: string;
    expiresAt?: string;
    remainingDays?: number;
    offlineGraceHours?: number;
    isGracePeriod?: boolean;
    isWarning?: boolean;
    isRetentionWarning?: boolean;
    retentionDaysLeft?: number;
    warningMessage?: string;
  };
  recentLogs: any[];
} {
  const cfg = (masterDb.prepare("SELECT * FROM sync_runtime_config WHERE id = 1").get() as any) || {};
  const mode = isLocalDesktopMode() ? "local" : "cloud";
  const tenantId = mode === "cloud" && overrideTenantId ? Number(overrideTenantId) : Number(cfg.tenant_id || 1);
  const statsDb = mode === "local" ? masterDb : getTenantDb(tenantId);

  let pendingUploadsCount = 0;
  let syncedRecordsCount = 0;
  let pendingFilesCount = 0;
  let unresolvedConflictsCount = 0;
  let recentLogs: any[] = [];

  try {
    pendingUploadsCount =
      mode === "local"
        ? (statsDb.prepare("SELECT COUNT(*) as c FROM sync_change_log WHERE synced = 0 AND COALESCE(source_env, 'local') = 'local'").get() as any)?.c || 0
        : 0;
    syncedRecordsCount =
      (statsDb.prepare("SELECT COUNT(*) as c FROM sync_change_log WHERE synced = 1").get() as any)?.c || 0;
    pendingFilesCount =
      (statsDb.prepare("SELECT COUNT(*) as c FROM sync_file_queue WHERE status != 'synced'").get() as any)?.c || 0;
    unresolvedConflictsCount =
      (statsDb.prepare("SELECT COUNT(*) as c FROM sync_conflicts WHERE status = 'pending'").get() as any)?.c || 0;
    recentLogs = statsDb
      .prepare("SELECT * FROM sync_logs ORDER BY id DESC LIMIT 25")
      .all() as any[];
  } catch {}

  let tenantCode = cfg.tenant_code || "OMNI-MAIN";
  let companyName = cfg.company_name || "";
  let licensePolicy: any = { allowed: true };

  if (mode === "local" && cfg.encrypted_license_snapshot) {
    const snap = decryptJsonPayload<OfflineLicenseSnapshot>(cfg.encrypted_license_snapshot);
    const ver = verifyOfflineLicensePolicy(snap);
    licensePolicy = {
      allowed: ver.allowed,
      code: ver.code,
      reason: ver.reason,
      expiresAt: snap?.licenseExpiresAt,
      remainingDays: ver.remainingDays,
      offlineGraceHours: snap?.offlineGraceHours,
      isGracePeriod: ver.isGracePeriod,
      isRetentionWarning: ver.isRetentionWarning,
      retentionDaysLeft: ver.retentionDaysLeft,
      warningMessage: ver.isGracePeriod ? ver.reason : undefined,
    };
  } else {
    const tRow = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
    if (tRow) {
      tenantCode = tRow.tenant_code || tenantCode;
      companyName = tRow.company_name || companyName;
      const p = getTenantPolicyStatus(tRow);
      licensePolicy = {
        allowed: p.allowed,
        code: p.code,
        reason: p.reason,
        expiresAt: tRow.license_expires_at,
        remainingDays: p.remainingDays,
        offlineGraceHours: tRow.offline_grace_hours,
        isGracePeriod: p.isGracePeriod,
        isWarning: p.isWarning,
        isRetentionWarning: p.isRetentionWarning,
        retentionDaysLeft: p.retentionDaysLeft,
        warningMessage: p.warningMessage,
      };
    }
  }

  let status: SyncLifecycleStatus = (cfg.sync_status as SyncLifecycleStatus) || "Connected";
  if (!licensePolicy.allowed) {
    status = "License Expired";
  } else if (activeSyncPromise) {
    status = "Syncing";
  } else if (unresolvedConflictsCount > 0) {
    status = "Conflict Detected";
  } else if (pendingUploadsCount > 0 && status !== "Offline" && status !== "Sync Failed") {
    status = "Pending Changes";
  } else if (mode === "cloud") {
    status = "Connected";
  }

  return {
    mode,
    status,
    connectionOnline: status !== "Offline",
    cloudServerUrl: cfg.cloud_server_url || "",
    installationId: cfg.installation_id || getOrCreatePersistentInstallationId(getDbDir()),
    deviceId: cfg.device_id || "",
    tenantId,
    tenantCode,
    companyName,
    isBootstrapped: mode === "cloud" ? true : Boolean(cfg.is_bootstrapped),
    localDbVersion: HYBRID_DB_VERSION,
    cloudDbVersion: cfg.db_version || HYBRID_DB_VERSION,
    appVersion: APP_VERSION,
    lastSuccessfulSync: cfg.last_successful_sync || null,
    lastDownloadedSeq: Number(cfg.last_downloaded_seq || 0),
    lastUploadedSeq: Number(cfg.last_uploaded_seq || 0),
    pendingUploadsCount,
    syncedRecordsCount,
    pendingFilesCount,
    unresolvedConflictsCount,
    autoSyncEnabled: Boolean(cfg.auto_sync_enabled ?? 1),
    autoSyncIntervalSec: Number(cfg.auto_sync_interval_sec || 30),
    lastError: cfg.last_error || "",
    licensePolicy,
    recentLogs,
  };
}

/**
 * Local Client Side: Full Bidirectional Sync Execution (Push -> Pull -> File Sync -> License Heartbeat)
 */
export async function runBidirectionalSync(reason: "manual" | "auto" = "manual"): Promise<{
  ok: boolean;
  status: SyncLifecycleStatus;
  uploadedCount: number;
  downloadedCount: number;
  filesSynced: number;
  conflictsCount: number;
  error?: string;
  summary: ReturnType<typeof getLocalSyncStatusSummary>;
}> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const startedAt = Date.now();
    const cfg = masterDb.prepare("SELECT * FROM sync_runtime_config WHERE id = 1").get() as any;

    if (!cfg || !isLocalDesktopMode()) {
      return {
        ok: true,
        status: "Connected" as SyncLifecycleStatus,
        uploadedCount: 0,
        downloadedCount: 0,
        filesSynced: 0,
        conflictsCount: 0,
        summary: getLocalSyncStatusSummary(),
      };
    }

    const cloudUrl = String(cfg.cloud_server_url || "").trim().replace(/\/+$/, "");
    const rawSyncToken = decryptHybridSecret(cfg.encrypted_sync_token);
    const tenantId = Number(cfg.tenant_id || 1);

    if (!cloudUrl || !rawSyncToken || !cfg.is_bootstrapped) {
      return {
        ok: false,
        status: "Offline" as SyncLifecycleStatus,
        uploadedCount: 0,
        downloadedCount: 0,
        filesSynced: 0,
        conflictsCount: 0,
        error: "التطبيق غير مرتبط بخادم سحابي حتى الآن.",
        summary: getLocalSyncStatusSummary(),
      };
    }

    // Backoff auto-sync when offline unless triggered manually
    if (reason === "auto" && Date.now() < lastOfflineBackoffUntil) {
      return {
        ok: false,
        status: "Offline" as SyncLifecycleStatus,
        uploadedCount: 0,
        downloadedCount: 0,
        filesSynced: 0,
        conflictsCount: 0,
        summary: getLocalSyncStatusSummary(),
      };
    }

    masterDb.prepare("UPDATE sync_runtime_config SET sync_status = 'Syncing' WHERE id = 1").run();

    let uploadedCount = 0;
    let downloadedCount = 0;
    let filesSynced = 0;
    let conflictsCount = 0;

    try {
      // Step 1: Online Health & Cloud License / Device Verification Ping
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let pingRes: Response;
      try {
        pingRes = await fetch(`${cloudUrl}/api/cloud/ping`, {
          method: "GET",
          headers: { "x-sync-token": rawSyncToken },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (pingRes.status === 403 || pingRes.status === 401) {
        const errBody = await pingRes.json().catch(() => ({}));
        const code = errBody?.code || "";
        const errMsg = errBody?.error || "تم رفض المزامنة من الخادم السحابي";
        const newStatus: SyncLifecycleStatus =
          code === "license_expired" || code === "license_suspended"
            ? "License Expired"
            : "Sync Failed";

        if (code === "license_expired" || code === "license_suspended") {
          const oldSnap = decryptJsonPayload<OfflineLicenseSnapshot>(cfg.encrypted_license_snapshot);
          if (oldSnap) {
            oldSnap.licenseStatus = code === "license_expired" ? "expired" : "suspended";
            oldSnap.subscriptionStatus = oldSnap.licenseStatus;
            oldSnap.lastServerContactMs = Date.now();
            masterDb
              .prepare("UPDATE sync_runtime_config SET encrypted_license_snapshot = ? WHERE id = 1")
              .run(encryptJsonPayload(oldSnap));
          }
        }

        masterDb
          .prepare("UPDATE sync_runtime_config SET sync_status = ?, last_error = ? WHERE id = 1")
          .run(newStatus, errMsg);
        masterDb
          .prepare(
            `INSERT INTO sync_logs (tenant_id, installation_id, direction, status, error_message, duration_ms)
             VALUES (?, ?, 'bidirectional', 'blocked', ?, ?)`
          )
          .run(tenantId, cfg.installation_id || "", errMsg, Date.now() - startedAt);

        return {
          ok: false,
          status: newStatus,
          uploadedCount: 0,
          downloadedCount: 0,
          filesSynced: 0,
          conflictsCount: 0,
          error: errMsg,
          summary: getLocalSyncStatusSummary(),
        };
      }

      if (!pingRes.ok) {
        throw new Error(`Cloud ping failed with HTTP ${pingRes.status}`);
      }

      const pingData = await pingRes.json();
      lastOfflineBackoffUntil = 0;

      // Refresh encrypted offline license snapshot from Cloud heartbeat
      if (pingData?.tenant) {
        const refreshedSnap = buildOfflineSnapshotFromTenant(
          pingData.tenant,
          cfg.installation_id,
          cfg.device_id
        );
        masterDb
          .prepare("UPDATE sync_runtime_config SET encrypted_license_snapshot = ?, company_name = ? WHERE id = 1")
          .run(encryptJsonPayload(refreshedSnap), pingData.tenant.company_name || cfg.company_name);
      }

      // Step 2: Push Pending Local Mutations -> Cloud
      const pendingRows = masterDb
        .prepare("SELECT * FROM sync_change_log WHERE synced = 0 ORDER BY seq ASC LIMIT 300")
        .all() as any[];

      if (pendingRows.length > 0) {
        const opsToPush = pendingRows.map((r) => {
          let payload: any = {};
          let previous: any = null;
          try { payload = JSON.parse(r.payload_json || "{}"); } catch {}
          try { previous = r.previous_json ? JSON.parse(r.previous_json) : null; } catch {}
          const fkUuids = buildFkUuidsForRow(masterDb, r.table_name, payload);
          return {
            seq: r.seq,
            sync_op_id: r.sync_op_id,
            table_name: r.table_name,
            record_id: r.record_id,
            sync_uuid: r.sync_uuid,
            operation: r.operation,
            record_version: r.record_version,
            payload,
            previous,
            fk_uuids: fkUuids,
          };
        });

        // Auto-queue any local /uploads/... files referenced in outbound records
        try {
          const uploadRegex = /\/uploads\/[^\s"'<>]+/g;
          const baseRoot = path.resolve(process.cwd(), "public/uploads");
          for (const opItem of opsToPush) {
            if (!opItem.payload || opItem.operation === "DELETE") continue;
            for (const val of Object.values(opItem.payload)) {
              if (typeof val === "string" && val.includes("/uploads/")) {
                const matches = val.match(uploadRegex);
                if (matches) {
                  for (const m of matches) {
                    const cleanRel = m.replace(/^\/uploads\//, "").replace(/\.\./g, "");
                    const diskPath = path.join(baseRoot, cleanRel);
                    if (fs.existsSync(diskPath) && fs.statSync(diskPath).isFile()) {
                      const sha = computeFileSha256(diskPath);
                      const fileUuid = crypto.createHash("sha256").update(`${tenantId}:${cleanRel}`).digest("hex").slice(0, 32);
                      const existingQ = masterDb.prepare("SELECT id, checksum_sha256, status FROM sync_file_queue WHERE file_uuid = ? AND direction = 'upload'").get(fileUuid) as any;
                      if (!existingQ) {
                        const st = fs.statSync(diskPath);
                        masterDb.prepare(
                          `INSERT OR IGNORE INTO sync_file_queue (tenant_id, file_uuid, relative_path, checksum_sha256, file_size, direction, status)
                           VALUES (?, ?, ?, ?, ?, 'upload', 'pending')`
                        ).run(tenantId, fileUuid, cleanRel, sha, st.size);
                      } else if (existingQ.checksum_sha256 !== sha) {
                        masterDb.prepare("UPDATE sync_file_queue SET checksum_sha256 = ?, status = 'pending', updated_at = datetime('now','localtime') WHERE id = ?").run(sha, existingQ.id);
                      }
                    }
                  }
                }
              }
            }
          }
        } catch {}

        const pushRes = await fetch(`${cloudUrl}/api/cloud/sync/push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-token": rawSyncToken,
          },
          body: JSON.stringify({ ops: opsToPush }),
        });

        const pushJson = await pushRes.json();
        if (!pushRes.ok) {
          throw new Error(pushJson?.error || `Push failed HTTP ${pushRes.status}`);
        }

        const resultMap = new Map<string, any>();
        for (const r of pushJson.results || []) {
          resultMap.set(r.op_id, r);
        }

        masterDb.transaction(() => {
          for (const row of pendingRows) {
            const res = resultMap.get(row.sync_op_id);
            if (!res) continue;
            if (res.status === "applied" || res.status === "duplicate") {
              masterDb.prepare("UPDATE sync_change_log SET synced = 1, last_error = NULL WHERE seq = ?").run(row.seq);
              if (res.status === "applied") uploadedCount++;
            } else if (res.status === "conflict") {
              masterDb.prepare("UPDATE sync_change_log SET synced = 1, last_error = ? WHERE seq = ?").run(res.reason || "conflict", row.seq);
              conflictsCount++;
              if (res.conflict) {
                masterDb
                  .prepare(
                    `INSERT INTO sync_conflicts (
                      tenant_id, table_name, record_id, sync_uuid, conflict_reason,
                      local_version, cloud_version, local_payload_json, cloud_payload_json,
                      base_payload_json, conflict_fields_json, auto_merged_fields_json, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
                  )
                  .run(
                    tenantId,
                    res.conflict.table_name,
                    res.conflict.record_id,
                    res.conflict.sync_uuid,
                    res.conflict.conflict_reason,
                    res.conflict.local_version,
                    res.conflict.cloud_version,
                    res.conflict.local_payload_json,
                    res.conflict.cloud_payload_json,
                    res.conflict.base_payload_json,
                    res.conflict.conflict_fields_json,
                    res.conflict.auto_merged_fields_json || "[]"
                  );
              }
            }
          }
          if (pushJson.cloudMaxSeq) {
            masterDb
              .prepare("UPDATE sync_runtime_config SET last_uploaded_seq = ? WHERE id = 1")
              .run(pushJson.cloudMaxSeq);
          }
        })();
      }

      // Step 3: Pull Incremental Cloud Deltas -> Local
      let sinceSeq = Number(cfg.last_downloaded_seq || 0);
      let keepPulling = true;
      let loops = 0;

      while (keepPulling && loops < 20) {
        loops++;
        const pullRes = await fetch(
          `${cloudUrl}/api/cloud/sync/pull?since_seq=${sinceSeq}&limit=250`,
          {
            method: "GET",
            headers: { "x-sync-token": rawSyncToken },
          }
        );
        const pullJson = await pullRes.json();
        if (!pullRes.ok) {
          throw new Error(pullJson?.error || `Pull failed HTTP ${pullRes.status}`);
        }

        const changes = pullJson.changes || [];
        if (changes.length > 0) {
          const applyTx = masterDb.transaction(() => {
            masterDb.prepare("UPDATE sync_internal_guard SET suppress = 1 WHERE id = 1").run();
            try {
              for (const ch of changes) {
                const appRes = applyIncomingOperation(masterDb, tenantId, ch, "local");
                if (appRes.status === "applied") {
                  downloadedCount++;
                  // Auto-queue any /uploads/... paths from Cloud changes for local download
                  if (ch.payload && ch.operation !== "DELETE") {
                    const uploadRegex = /\/uploads\/[^\s"'<>]+/g;
                    for (const val of Object.values(ch.payload)) {
                      if (typeof val === "string" && val.includes("/uploads/")) {
                        const matches = val.match(uploadRegex);
                        if (matches) {
                          for (const m of matches) {
                            const cleanRel = m.replace(/^\/uploads\//, "").replace(/\.\./g, "");
                            const fileUuid = crypto.createHash("sha256").update(`${tenantId}:${cleanRel}`).digest("hex").slice(0, 32);
                            const diskPath = path.join(path.resolve(process.cwd(), "public/uploads"), cleanRel);
                            if (!fs.existsSync(diskPath)) {
                              masterDb.prepare(
                                `INSERT OR IGNORE INTO sync_file_queue (tenant_id, file_uuid, relative_path, direction, status)
                                 VALUES (?, ?, ?, 'download', 'pending')`
                              ).run(tenantId, fileUuid, cleanRel);
                            }
                          }
                        }
                      }
                    }
                  }
                } else if (appRes.status === "conflict") {
                  conflictsCount++;
                }
                if (ch.seq > sinceSeq) sinceSeq = ch.seq;
              }
            } finally {
              masterDb.prepare("UPDATE sync_internal_guard SET suppress = 0 WHERE id = 1").run();
            }
          });
          masterDb.pragma("foreign_keys = OFF");
          try {
            applyTx();
          } finally {
            masterDb.pragma("foreign_keys = ON");
          }
        }

        if (pullJson.cloudMaxSeq && pullJson.cloudMaxSeq > sinceSeq && changes.length === 0) {
          sinceSeq = pullJson.cloudMaxSeq;
        }
        keepPulling = Boolean(pullJson.hasMore);
      }

      // Step 4: Sync Pending Files with SHA-256 verification
      const pendingFiles = masterDb
        .prepare("SELECT * FROM sync_file_queue WHERE status != 'synced' LIMIT 20")
        .all() as any[];

      for (const f of pendingFiles) {
        try {
          const baseRoot = path.resolve(process.cwd(), "public/uploads");
          const diskTarget = path.join(baseRoot, String(f.relative_path || "").replace(/\.\./g, ""));
          if (f.direction === "download") {
            const fRes = await fetch(
              `${cloudUrl}/api/cloud/files/download?path=${encodeURIComponent(f.relative_path)}`,
              { headers: { "x-sync-token": rawSyncToken } }
            );
            if (fRes.ok) {
              const arrBuf = await fRes.arrayBuffer();
              const buf = Buffer.from(arrBuf);
              const actualSha = computeBufferSha256(buf);
              if (!f.checksum_sha256 || actualSha === f.checksum_sha256) {
                fs.mkdirSync(path.dirname(diskTarget), { recursive: true });
                fs.writeFileSync(diskTarget, buf);
                masterDb
                  .prepare("UPDATE sync_file_queue SET status = 'synced', updated_at = datetime('now','localtime') WHERE id = ?")
                  .run(f.id);
                filesSynced++;
              } else {
                masterDb
                  .prepare("UPDATE sync_file_queue SET status = 'failed', error_message = 'Checksum mismatch' WHERE id = ?")
                  .run(f.id);
              }
            }
          } else if (f.direction === "upload" && fs.existsSync(diskTarget)) {
            const buf = fs.readFileSync(diskTarget);
            const sha = computeBufferSha256(buf);
            const upRes = await fetch(`${cloudUrl}/api/cloud/files/upload`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-sync-token": rawSyncToken,
              },
              body: JSON.stringify({
                fileUuid: f.file_uuid,
                relativePath: f.relative_path,
                checksumSha256: sha,
                contentBase64: buf.toString("base64"),
              }),
            });
            if (upRes.ok) {
              masterDb
                .prepare("UPDATE sync_file_queue SET status = 'synced', checksum_sha256 = ?, updated_at = datetime('now','localtime') WHERE id = ?")
                .run(sha, f.id);
              filesSynced++;
            }
          }
        } catch (fileErr: any) {
          masterDb
            .prepare("UPDATE sync_file_queue SET status = 'failed', error_message = ? WHERE id = ?")
            .run(fileErr?.message || "File sync error", f.id);
        }
      }

      const finalPendingConflicts =
        (masterDb.prepare("SELECT COUNT(*) as c FROM sync_conflicts WHERE status = 'pending'").get() as any)?.c || 0;
      const finalStatus: SyncLifecycleStatus =
        finalPendingConflicts > 0 ? "Conflict Detected" : "Synced";

      masterDb
        .prepare(
          `UPDATE sync_runtime_config
           SET sync_status = ?,
               last_downloaded_seq = MAX(last_downloaded_seq, ?),
               last_successful_sync = datetime('now', 'localtime'),
               last_error = '',
               updated_at = datetime('now', 'localtime')
           WHERE id = 1`
        )
        .run(finalStatus, sinceSeq);

      masterDb
        .prepare(
          `INSERT INTO sync_logs (tenant_id, installation_id, direction, status, downloaded_count, uploaded_count, files_synced, conflicts_count, duration_ms)
           VALUES (?, ?, 'bidirectional', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          tenantId,
          cfg.installation_id || "",
          finalPendingConflicts > 0 ? "conflict" : "success",
          downloadedCount,
          uploadedCount,
          filesSynced,
          conflictsCount,
          Date.now() - startedAt
        );

      return {
        ok: true,
        status: finalStatus,
        uploadedCount,
        downloadedCount,
        filesSynced,
        conflictsCount,
        summary: getLocalSyncStatusSummary(),
      };
    } catch (err: any) {
      const msg = err?.name === "AbortError" ? "تعذر الوصول للخادم السحابي (انتهت مهلة الاتصال)" : (err?.message || "فشل الاتصال بالسحابة");
      const isNet =
        err?.name === "AbortError" ||
        String(err?.message || "").toLowerCase().includes("fetch") ||
        String(err?.code || "").includes("ECONN");

      if (isNet) {
        lastOfflineBackoffUntil = Date.now() + 30_000;
      }

      const errStatus: SyncLifecycleStatus = isNet ? "Offline" : "Sync Failed";
      masterDb
        .prepare("UPDATE sync_runtime_config SET sync_status = ?, last_error = ? WHERE id = 1")
        .run(errStatus, msg);

      try {
        masterDb
          .prepare(
            `INSERT INTO sync_logs (tenant_id, installation_id, direction, status, error_message, duration_ms)
             VALUES (?, ?, 'bidirectional', 'failed', ?, ?)`
          )
          .run(tenantId, cfg.installation_id || "", msg, Date.now() - startedAt);
      } catch {}

      return {
        ok: false,
        status: errStatus,
        uploadedCount,
        downloadedCount,
        filesSynced,
        conflictsCount,
        error: msg,
        summary: getLocalSyncStatusSummary(),
      };
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/**
 * Resolve a sync conflict safely (`cloud` | `local` | `merge`)
 */
export function resolveSyncConflictRecord(params: {
  targetDb: any;
  tenantId: number;
  conflictId: number;
  strategy: "cloud" | "local" | "merge";
  mergedFields?: Record<string, any>;
  resolvedBy: string;
  note?: string;
}): { ok: boolean; error?: string; conflict?: any } {
  const { targetDb, tenantId, conflictId, strategy, mergedFields, resolvedBy, note } = params;
  const conflict = targetDb
    .prepare("SELECT * FROM sync_conflicts WHERE id = ? AND tenant_id = ?")
    .get(conflictId, tenantId) as any;

  if (!conflict) {
    return { ok: false, error: "سجل التضارب غير موجود" };
  }
  if (conflict.status !== "pending") {
    return { ok: false, error: "تمت معالجة هذا التضارب مسبقاً" };
  }

  const cfg = SYNC_TABLE_MAP.get(conflict.table_name);
  if (!cfg || !tableExists(targetDb, conflict.table_name)) {
    return { ok: false, error: "الجدول المرتبط بالتضارب غير موجود" };
  }

  let localObj: Record<string, any> = {};
  let cloudObj: Record<string, any> = {};
  try { localObj = JSON.parse(conflict.local_payload_json || "{}"); } catch {}
  try { cloudObj = JSON.parse(conflict.cloud_payload_json || "{}"); } catch {}

  let chosenPayload: Record<string, any> = cloudObj;
  let newStatus = "resolved_cloud";

  if (strategy === "local") {
    chosenPayload = localObj;
    newStatus = "resolved_local";
  } else if (strategy === "merge") {
    chosenPayload = { ...cloudObj, ...(mergedFields || {}) };
    newStatus = "resolved_merged";
  }

  const cols = getTableColumns(targetDb, cfg.table);
  const existing = findTargetRecord(targetDb, cfg, conflict.sync_uuid, chosenPayload);

  targetDb.transaction(() => {
    targetDb.prepare("UPDATE sync_internal_guard SET suppress = 1 WHERE id = 1").run();
    try {
      if (existing && !chosenPayload.deleted) {
        const baselineVer = Math.max(
          Number(existing.record_version || 1),
          Number(conflict.cloud_version || 1),
          Number(conflict.local_version || 1)
        );
        const nextVer = baselineVer + 1;
        const updateCols = cols.filter(
          (c) => c !== cfg.pk && c !== "id" && Object.prototype.hasOwnProperty.call(chosenPayload, c)
        );
        if (updateCols.length > 0) {
          const setSql = [
            ...updateCols.filter((c) => c !== "record_version" && c !== "sync_updated_at").map((c) => `"${c}" = ?`),
            "record_version = ?",
            "sync_updated_at = ?",
          ].join(", ");
          const vals = [
            ...updateCols.filter((c) => c !== "record_version" && c !== "sync_updated_at").map((c) => chosenPayload[c]),
            nextVer,
            new Date().toISOString(),
            existing[cfg.pk],
          ];
          targetDb.prepare(`UPDATE "${cfg.table}" SET ${setSql} WHERE "${cfg.pk}" = ?`).run(...vals);

          // Record explicit conflict resolution into sync_change_log using baselineVer as previous record_version
          // so Cloud accepts the resolution monotonically without re-conflict
          targetDb
            .prepare(
              `INSERT INTO sync_change_log (
                sync_op_id, tenant_id, table_name, record_id, sync_uuid, operation, record_version,
                payload_json, previous_json, source_env, installation_id, synced
              ) VALUES (?, ?, ?, ?, ?, 'UPDATE', ?, ?, ?, ?, ?, ?)`
            )
            .run(
              crypto.randomUUID(),
              tenantId,
              cfg.table,
              String(existing[cfg.pk]),
              conflict.sync_uuid,
              nextVer,
              JSON.stringify({ ...chosenPayload, record_version: nextVer }),
              JSON.stringify({ ...existing, record_version: baselineVer }),
              isLocalDesktopMode() ? "local" : "cloud",
              "",
              isLocalDesktopMode() ? 0 : 1
            );
        }
      }

      targetDb
        .prepare(
          `UPDATE sync_conflicts
           SET status = ?, resolved_by = ?, resolution_note = ?, resolved_at = datetime('now', 'localtime')
           WHERE id = ?`
        )
        .run(newStatus, resolvedBy, note || "", conflictId);
    } finally {
      targetDb.prepare("UPDATE sync_internal_guard SET suppress = 0 WHERE id = 1").run();
    }
  })();

  const updated = targetDb.prepare("SELECT * FROM sync_conflicts WHERE id = ?").get(conflictId);
  return { ok: true, conflict: updated };
}

export function startHybridSyncScheduler(): void {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    try {
      if (!isLocalDesktopMode()) return;
      const cfg = masterDb.prepare("SELECT auto_sync_enabled, is_bootstrapped FROM sync_runtime_config WHERE id = 1").get() as any;
      if (!cfg?.is_bootstrapped || !cfg?.auto_sync_enabled) return;
      runBidirectionalSync("auto").catch(() => {});
    } catch {}
  }, 30_000);
}

export function stopHybridSyncScheduler(): void {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
