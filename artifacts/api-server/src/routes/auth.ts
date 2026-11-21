import { Router } from "express";
import {
  db,
  masterDb,
  getTenantDb,
  verifyPassword,
  hashPassword,
  createSession,
  getSessionUser,
  getSessionInfo,
  deleteSession,
  isLocalDesktopMode,
  getDbDir,
} from "../lib/sqlite";
import { runWithTenant } from "../lib/tenant-context";
import {
  getTenantPolicyStatus,
  applyBootstrapSnapshotLocally,
  runBidirectionalSync,
  getLocalSyncStatusSummary,
} from "../lib/sync-engine";
import {
  decryptJsonPayload,
  encryptHybridSecret,
  encryptJsonPayload,
  getOrCreatePersistentInstallationId,
  verifyOfflineLicensePolicy,
  OfflineLicenseSnapshot,
} from "../lib/hybrid-crypto";
import { logger } from "../lib/logger";
import os from "node:os";
import crypto from "node:crypto";

const router = Router();

export function getSystemDeviceId(): string {
  try {
    const interfaces = os.networkInterfaces();
    const macList: string[] = [];
    for (const name of Object.keys(interfaces).sort()) {
      const iface = interfaces[name];
      if (iface) {
        for (const ip of iface) {
          if (!ip.internal && ip.mac && ip.mac !== "00:00:00:00:00:00" && ip.mac !== "ff:ff:ff:ff:ff:ff") {
            macList.push(ip.mac.toUpperCase());
          }
        }
      }
    }
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || "GENERIC-CPU";
    const cpuCount = cpus.length;
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    const rawId = `HWID|${platform}|${arch}|${hostname}|${cpuModel}|${cpuCount}|${totalMem}GB|${macList.sort().join(",")}`;
    const hash = crypto.createHash("sha256").update(rawId).digest("hex").toUpperCase();
    return `HW-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  } catch (e) {
    return "HW-OMNI-DEV-0001";
  }
}

export const CURRENT_SYSTEM_VERSION = "1.1.0";

export interface LicenseStatusResult {
  blocked: boolean;
  code?: "license_required" | "license_expired" | "license_suspended" | "license_not_started" | "version_upgrade_required" | "device_unauthorized" | "device_blocked";
  deviceId: string;
  licenseType?: "cloud" | "desktop";
  reason?: string;
  clientName?: string;
  expiresAt?: string;
  remainingDays?: number;
  isGracePeriod?: boolean;
  isWarning?: boolean;
  isRetentionWarning?: boolean;
  retentionDaysLeft?: number;
  warningMessage?: string;
  targetVersion?: string;
  currentVersion?: string;
  devicesLimit?: number;
  activeDevicesCount?: number;
}

export function checkLicenseStatus(deviceId?: string, tenantId = 1): LicenseStatusResult {
  try {
    const currentDevice = deviceId || getSystemDeviceId();

    // Multi-tenant policy check for tenants > 1 (or any cloud tenant row)
    if (tenantId > 1) {
      const tRow = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
      if (!tRow) {
        return {
          blocked: true,
          code: "license_required",
          deviceId: currentDevice,
          currentVersion: CURRENT_SYSTEM_VERSION,
          reason: "حساب المؤسسة غير موجود",
        };
      }
      const policy = getTenantPolicyStatus(tRow);
      if (!policy.allowed) {
        return {
          blocked: true,
          code: (policy.code as any) || "license_expired",
          deviceId: currentDevice,
          licenseType: "cloud",
          clientName: tRow.company_name,
          expiresAt: tRow.license_expires_at,
          remainingDays: policy.remainingDays,
          isGracePeriod: policy.isGracePeriod,
          isRetentionWarning: policy.isRetentionWarning,
          retentionDaysLeft: policy.retentionDaysLeft,
          warningMessage: policy.warningMessage,
          currentVersion: CURRENT_SYSTEM_VERSION,
          reason: policy.reason,
        };
      }
      return {
        blocked: false,
        deviceId: currentDevice,
        licenseType: "cloud",
        clientName: tRow.company_name,
        expiresAt: tRow.license_expires_at,
        remainingDays: policy.remainingDays,
        isGracePeriod: policy.isGracePeriod,
        isWarning: policy.isWarning,
        isRetentionWarning: policy.isRetentionWarning,
        retentionDaysLeft: policy.retentionDaysLeft,
        warningMessage: policy.warningMessage,
        currentVersion: CURRENT_SYSTEM_VERSION,
        devicesLimit: tRow.max_devices,
      };
    }

    // If Tenant #1 is explicitly expired/suspended in cloud_tenants, enforce it too
    try {
      const t1 = masterDb.prepare("SELECT * FROM cloud_tenants WHERE id = 1").get() as any;
      if (t1) {
        const p1 = getTenantPolicyStatus(t1);
        if (!p1.allowed) {
          return {
            blocked: true,
            code: (p1.code as any) || "license_expired",
            deviceId: currentDevice,
            licenseType: "cloud",
            clientName: t1.company_name,
            expiresAt: t1.license_expires_at,
            remainingDays: p1.remainingDays,
            isGracePeriod: p1.isGracePeriod,
            isRetentionWarning: p1.isRetentionWarning,
            retentionDaysLeft: p1.retentionDaysLeft,
            warningMessage: p1.warningMessage,
            currentVersion: CURRENT_SYSTEM_VERSION,
            reason: p1.reason,
          };
        }
      }
    } catch {}

    const totalLicensesCount = (masterDb.prepare("SELECT COUNT(*) as c FROM licenses").get() as { c: number })?.c || 0;
    if (totalLicensesCount === 0) {
      return {
        blocked: true,
        code: "license_required",
        deviceId: currentDevice,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: "النظام غير مرخص. يرجى قيام مطور النظام بتسجيل الدخول وإصدار ترخيص السحابة أو ترخيص الجهاز."
      };
    }

    const lic = masterDb.prepare("SELECT * FROM licenses WHERE active=1 AND (status IS NULL OR status='active') ORDER BY id DESC LIMIT 1").get() as any;
    if (!lic) {
      return {
        blocked: true,
        code: "license_suspended",
        deviceId: currentDevice,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: "تم إيقاف أو تعليق ترخيص النظام من قبل المطور. يرجى التواصل مع مطور النظام لتفعيل الترخيص."
      };
    }

    const expireDate = new Date(lic.expires_at);
    const currentDate = new Date();
    
    // Set both to midnight to count full days
    expireDate.setHours(0, 0, 0, 0);
    currentDate.setHours(0, 0, 0, 0);

    const diffTime = expireDate.getTime() - currentDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        blocked: true, 
        code: "license_expired",
        deviceId: currentDevice,
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        licenseType: lic.license_type || "cloud",
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `انتهت فترة صلاحية ترخيص النظام الممنوحة لهذا العميل (${lic.expires_at}). يرجى التواصل مع المطور لتجديد وتمديد الترخيص السحابي.`
      };
    }

    // Version validation check
    if (lic.target_version && lic.target_version !== "*" && lic.target_version !== CURRENT_SYSTEM_VERSION) {
      return {
        blocked: true,
        code: "version_upgrade_required",
        deviceId: currentDevice,
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        licenseType: lic.license_type || "cloud",
        targetVersion: lic.target_version,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `تم تثبيت وتحديث إصدار جديد من النظام (v${CURRENT_SYSTEM_VERSION}) بينما الترخيص السابق مخصص للنسخة (v${lic.target_version}). لا يُسمح بتشغيل النظام بعد التحديث إلا بعد اعتماد وترخيص الإصدار الجديد من قِبل المطور.`
      };
    }

    const activeDevicesCount = (masterDb.prepare("SELECT COUNT(*) as c FROM license_devices WHERE license_id=? AND (status IS NULL OR status='authorized' OR status='active')").get(lic.id) as { c: number })?.c || 1;

    const isWarning = diffDays <= 15 && diffDays > 0;
    const warningMessage = isWarning
      ? `تنبيه: متبقي ${diffDays} يوم فقط على انتهاء ترخيص هذا الجهاز (${lic.expires_at}). يرجى سرعة التواصل مع إدارة ومطور النظام لتجديد الترخيص قبل موعد التوقف.`
      : undefined;

    const isCloudLicense = !lic.license_type || lic.license_type === "cloud" || lic.license_type === "سحابي";
    if (isCloudLicense) {
      return {
        blocked: false,
        deviceId: currentDevice,
        licenseType: "cloud",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        isWarning,
        warningMessage,
        targetVersion: lic.target_version || CURRENT_SYSTEM_VERSION,
        currentVersion: CURRENT_SYSTEM_VERSION,
        devicesLimit: lic.devices_limit || 999,
        activeDevicesCount
      };
    }

    const deviceCheck = masterDb.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, currentDevice) as any;
    
    if (!deviceCheck) {
      return { 
        blocked: true, 
        code: "device_unauthorized",
        deviceId: currentDevice,
        licenseType: "desktop",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `هذا الجهاز (بصمة الجهاز: ${currentDevice}) غير مرخص له بتشغيل النظام. يُمنع منعاً باتاً تشغيل النظام عند نسخ ملفاته إلى جهاز آخر بدون ترخيص معتمد من المطور.`
      };
    }

    if (deviceCheck.status === 'blocked' || deviceCheck.status === 'disabled') {
      return {
        blocked: true,
        code: "device_blocked",
        deviceId: currentDevice,
        licenseType: "desktop",
        clientName: lic.client_name,
        expiresAt: lic.expires_at,
        remainingDays: diffDays,
        currentVersion: CURRENT_SYSTEM_VERSION,
        reason: `تم حظر هذا الجهاز (${currentDevice}) من قِبل المطور. يرجى التواصل مع المطور لفك الحظر.`
      };
    }

    try {
      masterDb.prepare("UPDATE license_devices SET last_active = datetime('now', 'localtime') WHERE id = ?").run(deviceCheck.id);
    } catch (e) {}

    return { 
      blocked: false,
      deviceId: currentDevice,
      licenseType: "desktop",
      clientName: lic.client_name,
      expiresAt: lic.expires_at,
      remainingDays: diffDays,
      isWarning,
      warningMessage,
      targetVersion: lic.target_version || CURRENT_SYSTEM_VERSION,
      currentVersion: CURRENT_SYSTEM_VERSION,
      devicesLimit: lic.devices_limit,
      activeDevicesCount
    };
  } catch (e) {
    return {
      blocked: true,
      code: "license_required",
      deviceId: getSystemDeviceId(),
      currentVersion: CURRENT_SYSTEM_VERSION,
      reason: "خطأ في فحص ترخيص النظام. يرجى التواصل مع مطور النظام."
    };
  }
}

export function getAuthUser(req: any) {
  try {
    const auth = req.headers?.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      if (token) {
        const sInfo = getSessionInfo(token);
        if (sInfo?.userId) {
          const user = masterDb
            .prepare("SELECT id, username, name, role, active, can_discount, COALESCE(tenant_id, 1) as tenant_id FROM users WHERE id=?")
            .get(sInfo.userId) as any;
          if (user && user.active) {
            const effectiveTenantId = Number(sInfo.tenantId || user.tenant_id || 1);
            if (effectiveTenantId > 1 && !isLocalDesktopMode()) {
              try {
                const tDb = getTenantDb(effectiveTenantId);
                const tUser = tDb
                  .prepare("SELECT id, username, name, role, active, can_discount FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
                  .get(user.username) as any;
                if (tUser) {
                  if (!tUser.active) return null;
                  return { ...tUser, tenant_id: effectiveTenantId, master_user_id: user.id };
                }
              } catch {}
            }
            return { ...user, tenant_id: effectiveTenantId };
          }
        }
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

router.post("/auth/login", async (req, res) => {
  const { username, password, cloud_url, device_id, installation_id, force_offline } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور" });
    return;
  }

  const cleanUsername = String(username).trim();
  const isDeveloperUser = cleanUsername.toLowerCase() === "developer";
  const localMode = isLocalDesktopMode();

  // ── HYBRID LOCAL DESKTOP MODE LOGIN ──
  if (localMode && !isDeveloperUser) {
    const cfg = (masterDb.prepare("SELECT * FROM sync_runtime_config WHERE id = 1").get() as any) || {};
    const effectiveCloudUrl = String(
      cloud_url || cfg.cloud_server_url || process.env.OMNIFLY_CLOUD_URL || ""
    )
      .trim()
      .replace(/\/+$/, "");
    const effectiveInstallId =
      installation_id || cfg.installation_id || getOrCreatePersistentInstallationId(getDbDir());
    const effectiveDeviceId = device_id || cfg.device_id || getSystemDeviceId();

    // 1. Try Online Cloud Verification first (if cloud URL configured & not forced offline)
    if (effectiveCloudUrl && !force_offline) {
      let cloudRes: Response | null = null;
      let cloudJson: any = null;
      try {
        const ctrl = new AbortController();
        const tm = setTimeout(() => ctrl.abort(), 8000);
        try {
          cloudRes = await fetch(`${effectiveCloudUrl}/api/cloud/auth/desktop-login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: cleanUsername,
              password,
              installation_id: effectiveInstallId,
              device_id: effectiveDeviceId,
              device_name: req.body.device_name || os.hostname(),
              os_info: `${os.platform()} ${os.arch()}`,
              app_version: CURRENT_SYSTEM_VERSION,
            }),
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(tm);
        }
        cloudJson = await cloudRes.json().catch(() => ({}));
      } catch (netErr: any) {
        logger.warn({ err: netErr?.message }, "Cloud unreachable during local login, using offline verification");
        cloudRes = null;
      }

      if (cloudRes) {
        if (!cloudRes.ok) {
          // Persist expired/suspended revocation locally too so offline cache stays authoritative
          if (cloudJson?.code === "license_expired" || cloudJson?.code === "license_suspended") {
            const oldSnap = decryptJsonPayload<OfflineLicenseSnapshot>(cfg.encrypted_license_snapshot);
            if (oldSnap) {
              oldSnap.licenseStatus = cloudJson.code === "license_expired" ? "expired" : "suspended";
              oldSnap.subscriptionStatus = oldSnap.licenseStatus;
              oldSnap.lastServerContactMs = Date.now();
              masterDb
                .prepare("UPDATE sync_runtime_config SET encrypted_license_snapshot = ?, sync_status = 'License Expired' WHERE id = 1")
                .run(encryptJsonPayload(oldSnap));
            }
          }
          res.status(cloudRes.status).json({
            error: cloudJson.code || cloudJson.error || "auth_failed",
            code: cloudJson.code || "auth_failed",
            message: cloudJson.error || "تعذر تسجيل الدخول من الخادم السحابي",
          });
          return;
        }

        const cloudTenant = cloudJson.tenant;
        const cloudTenantId = Number(cloudTenant?.id || 1);

        // Tenant Isolation Guard: Prevent mixing Tenant A and Tenant B in one populated Local DB
        if (cfg.is_bootstrapped && Number(cfg.tenant_id) > 0 && Number(cfg.tenant_id) !== cloudTenantId) {
          res.status(409).json({
            error: "tenant_mismatch",
            code: "tenant_mismatch",
            message: `هذا التثبيت المحلي مرتبط بمؤسسة أخرى (${cfg.company_name || cfg.tenant_code}). يُمنع خلط بيانات مؤسستين في نفس قاعدة البيانات المحلية.`,
          });
          return;
        }

        let bootstrappedNow = false;
        if (!cfg.is_bootstrapped || Number(cfg.tenant_id) !== cloudTenantId) {
          let bootRes: Response;
          let bootJson: any = {};
          try {
            const bootCtrl = new AbortController();
            const bootTm = setTimeout(() => bootCtrl.abort(), 20000);
            try {
              bootRes = await fetch(`${effectiveCloudUrl}/api/cloud/sync/bootstrap`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-sync-token": cloudJson.deviceSyncToken,
                },
                signal: bootCtrl.signal,
              });
            } finally {
              clearTimeout(bootTm);
            }
            bootJson = await bootRes.json().catch(() => ({}));
          } catch (bootNetErr: any) {
            logger.warn({ err: bootNetErr?.message }, "Cloud unreachable while downloading bootstrap snapshot");
            res.status(503).json({
              error: "cloud_connection_required",
              code: "cloud_connection_required",
              message: "تعذر تنزيل بيانات المؤسسة الأولية من الخادم السحابي.",
            });
            return;
          }

          if (!bootRes.ok) {
            res.status(bootRes.status).json({
              error: bootJson.code || "bootstrap_failed",
              message: bootJson.error || "فشل تنزيل بيانات المؤسسة الأولية من السحابة",
            });
            return;
          }

          try {
            applyBootstrapSnapshotLocally({
              snapshot: bootJson,
              cloudUrl: effectiveCloudUrl,
              deviceSyncToken: cloudJson.deviceSyncToken,
              licenseSnapshot: cloudJson.licenseSnapshot,
              tenant: cloudTenant,
              user: cloudJson.user,
            });
            bootstrappedNow = true;
            // Immediately push any preserved offline local transactions created before first cloud link
            await runBidirectionalSync("manual").catch(() => {});
          } catch (applyErr: any) {
            logger.error({ err: applyErr?.message, stack: applyErr?.stack }, "Failed applying bootstrap snapshot locally");
            res.status(500).json({
              error: "bootstrap_apply_failed",
              code: "bootstrap_apply_failed",
              message: applyErr?.message || "فشل تطبيق بيانات المؤسسة في قاعدة البيانات المحلية",
            });
            return;
          }
        } else {
          // Already bootstrapped for the same tenant: update tokens & trigger delta sync
          masterDb
            .prepare(
              `UPDATE sync_runtime_config
               SET cloud_server_url = ?, device_id = ?, encrypted_sync_token = ?, encrypted_license_snapshot = ?,
                   company_name = ?, updated_at = datetime('now', 'localtime')
               WHERE id = 1`
            )
            .run(
              effectiveCloudUrl,
              effectiveDeviceId,
              encryptHybridSecret(cloudJson.deviceSyncToken),
              encryptJsonPayload(cloudJson.licenseSnapshot),
              cloudTenant.company_name || cfg.company_name
            );
          await runBidirectionalSync("manual").catch(() => {});
        }

        // Resolve local synced user record and create local session
        let localUser = masterDb
          .prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
          .get(cleanUsername) as any;

        if (!localUser) {
          const tmpHash = hashPassword(String(password));
          const ins = masterDb
            .prepare("INSERT INTO users (username, password_hash, name, role, active, can_discount, tenant_id) VALUES (?, ?, ?, ?, 1, 1, ?)")
            .run(cloudJson.user.username, tmpHash, cloudJson.user.name, cloudJson.user.role, cloudTenantId);
          localUser = masterDb.prepare("SELECT * FROM users WHERE id=?").get(ins.lastInsertRowid);
        }

        const token = createSession(localUser.id, cloudTenantId, localUser.username);
        res.json({
          token,
          user: {
            id: localUser.id,
            username: localUser.username,
            name: localUser.name,
            role: localUser.role,
            active: Boolean(localUser.active),
            can_discount: Boolean(localUser.can_discount ?? true),
            tenant_id: cloudTenantId,
          },
          tenant: cloudTenant,
          bootstrapped: bootstrappedNow,
          offline: false,
          syncStatus: getLocalSyncStatusSummary(),
        });
        return;
      }
    }

    // 2. Offline Verification Path
    if (!cfg.is_bootstrapped) {
      res.status(503).json({
        error: "cloud_connection_required",
        code: "cloud_connection_required",
        message: "يتطلب أول تسجيل دخول للنسخة المحلية الاتصال بالخادم السحابي للتحقق من الاشتراك وتنزيل بيانات المؤسسة.",
      });
      return;
    }

    const offlineSnap = decryptJsonPayload<OfflineLicenseSnapshot>(cfg.encrypted_license_snapshot);
    const offlineCheck = verifyOfflineLicensePolicy(offlineSnap);
    if (offlineCheck.updatedSnapshot) {
      try {
        masterDb
          .prepare("UPDATE sync_runtime_config SET encrypted_license_snapshot = ? WHERE id = 1")
          .run(encryptJsonPayload(offlineCheck.updatedSnapshot));
      } catch {}
    }

    if (!offlineCheck.allowed) {
      res.status(403).json({
        error: offlineCheck.code || "license_expired",
        code: offlineCheck.code || "license_expired",
        message: offlineCheck.reason || "انتهى الترخيص أو تجاوز مهلة العمل دون اتصال.",
      });
      return;
    }

    const localUser = masterDb
      .prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
      .get(cleanUsername) as any;

    if (!localUser || !localUser.active || !verifyPassword(password, localUser.password_hash)) {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      return;
    }

    const token = createSession(localUser.id, Number(cfg.tenant_id || 1), localUser.username);
    masterDb.prepare("UPDATE sync_runtime_config SET sync_status = 'Offline' WHERE id = 1").run();

    res.json({
      token,
      user: {
        id: localUser.id,
        username: localUser.username,
        name: localUser.name,
        role: localUser.role,
        active: Boolean(localUser.active),
        can_discount: Boolean(localUser.can_discount ?? true),
        tenant_id: Number(cfg.tenant_id || 1),
      },
      offline: true,
      bootstrapped: false,
      syncStatus: getLocalSyncStatusSummary(),
    });
    return;
  }

  // ── CLOUD / WEB MODE OR DEVELOPER LOGIN ──
  const user = masterDb.prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))").get(cleanUsername) as any;
  if (!user || !user.active) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة أو الحساب معطل" });
    return;
  }
  const ok = verifyPassword(password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const userTenantId = Number(user.tenant_id) || 1;

  let loginLicenseInfo: LicenseStatusResult | null = null;
  if (!isDeveloperUser) {
    const licenseStatus = checkLicenseStatus(undefined, userTenantId);
    loginLicenseInfo = licenseStatus;
    if (licenseStatus.blocked) {
      res.status(403).json({
        error: licenseStatus.code || "license_blocked",
        code: licenseStatus.code || "license_blocked",
        deviceId: licenseStatus.deviceId,
        isRetentionWarning: licenseStatus.isRetentionWarning,
        retentionDaysLeft: licenseStatus.retentionDaysLeft,
        expiresAt: licenseStatus.expiresAt,
        message: licenseStatus.reason || "تم إيقاف أو انتهاء ترخيص النظام أو أن هذا الجهاز غير مرخص. يرجى التواصل مع المطور."
      });
      return;
    }
  }

  // If developer logs in, ensure this current device is authorized in the active license
  if (user.role === "developer" || user.username?.toLowerCase() === "developer") {
    try {
      let lic = masterDb.prepare("SELECT * FROM licenses WHERE active=1 ORDER BY id DESC LIMIT 1").get() as any;
      if (lic) {
        const currentDevice = getSystemDeviceId();
        const deviceCheck = masterDb.prepare("SELECT * FROM license_devices WHERE license_id=? AND device_id=?").get(lic.id, currentDevice);
        if (!deviceCheck) {
          masterDb.prepare(`
            INSERT INTO license_devices (license_id, device_id, device_name, authorized_by, status, last_active)
            VALUES (?, ?, ?, 'مطور النظام (تسجيل مباشر)', 'authorized', datetime('now', 'localtime'))
          `).run(lic.id, currentDevice, `جهاز المطور الرئيسي (${os.hostname()})`);
        } else {
          masterDb.prepare("UPDATE license_devices SET status='authorized', last_active=datetime('now', 'localtime') WHERE id=?").run(deviceCheck.id);
        }
      }
    } catch (e) {
      console.error("Developer device auto-auth error:", e);
    }
  }

  const token = createSession(user.id, userTenantId, user.username);

  // Log active session in erp_sessions inside tenant scope
  const deviceName = req.body.device_name || (req.headers["user-agent"] ? req.headers["user-agent"].split(" ")[0] : "متصفح الويب");
  runWithTenant(userTenantId, () => {
    try {
      db.prepare(`
        INSERT INTO erp_sessions (username, device_name, login_time, status, branch_id, language)
        VALUES (?, ?, datetime('now', 'localtime'), 'نشط', 1, 'عربي')
      `).run(user.name, deviceName);
    } catch (err) {
      console.error("Failed to log erp session:", err);
    }
  });

  const tenantRow = masterDb.prepare("SELECT id, tenant_code, company_name, package_name, license_expires_at FROM cloud_tenants WHERE id = ?").get(userTenantId);

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      active: Boolean(user.active),
      can_discount: Boolean(user.can_discount !== undefined && user.can_discount !== null ? user.can_discount : (user.role === "admin" || user.role === "developer" || user.role === "accountant")),
      tenant_id: userTenantId,
    },
    tenant: tenantRow || null,
    licenseStatus: loginLicenseInfo,
  });
});

router.get("/auth/me", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const isDev = user.username?.toLowerCase() === "developer" || user.role === "developer";
  const tenantId = Number(user.tenant_id || 1);

  if (!isDev) {
    if (isLocalDesktopMode()) {
      const cfg = (masterDb.prepare("SELECT encrypted_license_snapshot FROM sync_runtime_config WHERE id = 1").get() as any) || {};
      if (cfg.encrypted_license_snapshot) {
        const snap = decryptJsonPayload<OfflineLicenseSnapshot>(cfg.encrypted_license_snapshot);
        const ver = verifyOfflineLicensePolicy(snap);
        if (!ver.allowed) {
          res.status(403).json({
            error: ver.code || "license_blocked",
            code: ver.code || "license_blocked",
            message: ver.reason || "تم انتهاء فترة ترخيص استخدام النظام.",
          });
          return;
        }
      }
    } else {
      const licenseStatus = checkLicenseStatus(undefined, tenantId);
      if (licenseStatus.blocked) {
        res.status(403).json({
          error: licenseStatus.code || "license_blocked",
          code: licenseStatus.code || "license_blocked",
          message: licenseStatus.reason || "تم انتهاء فترة ترخيص استخدام النظام أو الجهاز غير مرخص. يرجى التواصل مع المطور لتمديد الترخيص."
        });
        return;
      }
    }
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    active: Boolean(user.active),
    can_discount: Boolean(user.can_discount !== undefined && user.can_discount !== null ? user.can_discount : (user.role === "admin" || user.role === "developer" || user.role === "accountant")),
    tenant_id: tenantId,
  });
});

router.post("/auth/logout", (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const userId = getSessionUser(token);
    if (userId) {
      const user = masterDb.prepare("SELECT name FROM users WHERE id=?").get(userId) as any;
      if (user) {
        try {
          db.prepare(`
            UPDATE erp_sessions 
            SET status = 'خروج', logout_time = datetime('now', 'localtime') 
            WHERE username = ? AND status = 'نشط'
          `).run(user.name);
        } catch (err) {
          console.error("Failed to log erp session logout:", err);
        }
      }
    }
    deleteSession(token);
  }
  res.json({ ok: true });
});

router.post("/auth/change-password", (req, res) => {
  logger.info({ body: { ...req.body, oldPassword: "***", currentPassword: "***", newPassword: "***" } }, "Password change request received");
  try {
    const { username, oldPassword, currentPassword, newPassword } = req.body;
    const passwordToCheck = currentPassword || oldPassword;
    
    if (!passwordToCheck || !newPassword) {
      return res.status(400).json({ error: "الرجاء إدخال كلمة المرور الحالية وكلمة المرور الجديدة" });
    }

    if (String(newPassword).trim().length < 3) {
      return res.status(400).json({ error: "كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل" });
    }

    let fullUser: any = null;

    // Prioritize username specified in request body (especially from /login interface)
    if (username && String(username).trim().length > 0) {
      const cleanUsername = String(username).trim();
      fullUser = masterDb.prepare("SELECT * FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))").get(cleanUsername) as any;
      if (!fullUser) {
        return res.status(404).json({ error: `اسم المستخدم (${cleanUsername}) غير موجود بالنظام` });
      }
    } else {
      const user = getAuthUser(req) as any;
      if (user?.id) {
        fullUser = masterDb.prepare("SELECT * FROM users WHERE id=?").get(user.master_user_id || user.id) as any;
      }
    }

    if (!fullUser) {
      return res.status(401).json({ error: "يرجى تحديد اسم المستخدم أو تسجيل الدخول أولاً" });
    }

    if (!fullUser.active) {
      return res.status(403).json({ error: "هذا الحساب معطل حالياً. يرجى التواصل مع مسؤول النظام." });
    }

    const ok = verifyPassword(String(passwordToCheck), fullUser.password_hash);
    if (!ok) {
      return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    const newHash = hashPassword(String(newPassword).trim());
    masterDb.prepare("UPDATE users SET password_hash=? WHERE id=?").run(newHash, fullUser.id);
    const tId = Number(fullUser.tenant_id || 1);
    if (!isLocalDesktopMode() && tId > 1) {
      runWithTenant(tId, () => {
        try {
          db.prepare("UPDATE users SET password_hash=? WHERE LOWER(TRIM(username))=LOWER(TRIM(?))").run(newHash, fullUser.username);
        } catch {}
      });
    }

    logger.info({ userId: fullUser.id, username: fullUser.username }, "Password changed successfully");
    res.json({ ok: true, message: "تم تغيير كلمة السر بنجاح. يمكنك الآن تسجيل الدخول بها." });
  } catch (error: any) {
    logger.error({ err: error, stack: error.stack }, "Critical error during password change");
    if (!res.headersSent) {
      res.status(500).json({ error: "حدث خطأ داخلي أثناء تغيير كلمة السر: " + error.message });
    }
  }
});

router.post("/auth/verify-supervisor", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "يرجى إدخال اسم المستخدم وكلمة المرور للمدير / المشرف" });
    }
    const user = db.prepare("SELECT * FROM users WHERE (username=? OR name=?) AND active=1").get(username, username) as any;
    if (!user || (user.role !== "admin" && user.role !== "developer" && user.role !== "accountant")) {
      return res.status(403).json({ error: "المستخدم ليس لديه صلاحية مدير أو مشرف لمنح إذن الخصم" });
    }
    const ok = verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "كلمة المرور غير صحيحة" });
    }
    res.json({ ok: true, name: user.name, role: user.role });
  } catch (error: any) {
    res.status(500).json({ error: "حدث خطأ أثناء التحقق من الصلاحية: " + error.message });
  }
});

export default router;
