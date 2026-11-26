import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HYBRID_MASTER_SECRET =
  process.env.OMNIFLY_SYNC_SECRET || "OMNIFLY-HYBRID-CLOUD-LOCAL-SYNC-AES256-KEY-2027";
const SYNC_AES_KEY = crypto.createHash("sha256").update(HYBRID_MASTER_SECRET).digest();

export interface InstallationFileConfig {
  installationId: string;
  createdAt: string;
  cloudUrl?: string;
  tenantId?: number;
  tenantCode?: string;
  encryptedSyncToken?: string;
}

export interface OfflineLicenseSnapshot {
  tenantId: number;
  tenantCode: string;
  companyName: string;
  packageName: string;
  subscriptionStatus: string;
  licenseStatus: string;
  licenseStartDate: string;
  licenseExpiresAt: string;
  maxUsers: number;
  maxDevices: number;
  allowLocalDesktop: boolean;
  offlineGraceHours: number;
  graceDays?: number;
  retentionDaysAfterExpiry?: number;
  lastServerContactMs: number;
  maxMonotonicEpochMs: number;
  installationId: string;
  deviceId: string;
  appVersion: string;
}

export function encryptHybridSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", SYNC_AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `OMNI-ENC.${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

export function decryptHybridSecret(token: string | null | undefined): string | null {
  if (!token || typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed.startsWith("OMNI-ENC.")) return trimmed;
  try {
    const buf = Buffer.from(trimmed.slice(9), "base64url");
    if (buf.length <= 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", SYNC_AES_KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function encryptJsonPayload<T>(data: T): string {
  return encryptHybridSecret(JSON.stringify(data));
}

export function decryptJsonPayload<T>(token: string | null | undefined): T | null {
  const raw = decryptHybridSecret(token);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function hashTokenSha256(rawToken: string): string {
  return crypto.createHash("sha256").update(String(rawToken || "")).digest("hex");
}

export function computeBufferSha256(buf: Buffer | Uint8Array): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export function computeFileSha256(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const data = fs.readFileSync(filePath);
    return computeBufferSha256(data);
  } catch {
    return null;
  }
}

export function generateOpaqueToken(prefix = "OMNI-SYNC"): string {
  return `${prefix}-${crypto.randomBytes(24).toString("base64url")}`;
}

export function getOrCreatePersistentInstallationId(dbDir: string): string {
  try {
    if (process.env.OMNIFLY_INSTALLATION_ID && process.env.OMNIFLY_INSTALLATION_ID.trim()) {
      return process.env.OMNIFLY_INSTALLATION_ID.trim();
    }
    const configPath = path.join(dbDir, ".omni-install.json");
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<InstallationFileConfig>;
      if (parsed?.installationId && typeof parsed.installationId === "string" && parsed.installationId.length >= 8) {
        return parsed.installationId;
      }
    }
    const newId = `INST-${crypto.randomUUID().toUpperCase()}`;
    const payload: InstallationFileConfig = {
      installationId: newId,
      createdAt: new Date().toISOString(),
    };
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(payload, null, 2), "utf8");
    return newId;
  } catch {
    const fallbackSeed = `${os.hostname()}|${os.platform()}|${os.arch()}|${dbDir}`;
    const hash = crypto.createHash("sha256").update(fallbackSeed).digest("hex").toUpperCase();
    return `INST-${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}`;
  }
}

export function persistInstallationFileMetadata(
  dbDir: string,
  patch: Partial<InstallationFileConfig>
): void {
  try {
    const configPath = path.join(dbDir, ".omni-install.json");
    let current: Partial<InstallationFileConfig> = {};
    if (fs.existsSync(configPath)) {
      try {
        current = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch {}
    }
    const next = { ...current, ...patch };
    fs.mkdirSync(dbDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(next, null, 2), "utf8");
  } catch {}
}

function diffOfflineCalendarDays(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const targetUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

export function verifyOfflineLicensePolicy(snapshot: OfflineLicenseSnapshot | null): {
  allowed: boolean;
  reason?: string;
  code?: "license_expired" | "license_suspended" | "license_not_started" | "offline_grace_exceeded" | "clock_tampered" | "local_disabled" | "license_required";
  remainingDays?: number;
  isGracePeriod?: boolean;
  isRetentionWarning?: boolean;
  retentionDaysLeft?: number;
  clockTampered?: boolean;
  updatedSnapshot?: OfflineLicenseSnapshot;
} {
  if (!snapshot) {
    return {
      allowed: false,
      code: "license_required",
      reason: "لا توجد بيانات ترخيص مخزنة محلياً. يرجى الاتصال بالسحابة لتسجيل الدخول والتحقق الأولي."
    };
  }

  if (!snapshot.allowLocalDesktop) {
    return {
      allowed: false,
      code: "local_disabled",
      reason: "تم تعطيل تشغيل النسخة المحلية لهذه المؤسسة من لوحة تحكم المطور."
    };
  }

  if (snapshot.subscriptionStatus === "suspended" || snapshot.licenseStatus === "suspended") {
    const retentionDays = Math.max(1, Number(snapshot.retentionDaysAfterExpiry ?? 30));
    return {
      allowed: false,
      code: "license_suspended",
      isRetentionWarning: true,
      retentionDaysLeft: retentionDays,
      reason: "تم تعليق اشتراك المؤسسة من قِبل المطور. جميع بياناتك محفوظة بأمان، يرجى التواصل مع المطور لإعادة التفعيل."
    };
  }

  const nowMs = Date.now();
  // Anti-clock rollback tampering guard (5 min jitter tolerance)
  if (snapshot.maxMonotonicEpochMs && nowMs < snapshot.maxMonotonicEpochMs - 300_000) {
    return {
      allowed: false,
      clockTampered: true,
      code: "clock_tampered",
      reason: "تم رصد تغيير وتراجع غير طبيعي في تاريخ/ساعة الجهاز المحلي. يرجى ضبط الساعة والاتصال بالسحابة للتحقق من الترخيص."
    };
  }

  const updatedSnapshot: OfflineLicenseSnapshot = {
    ...snapshot,
    maxMonotonicEpochMs: Math.max(snapshot.maxMonotonicEpochMs || 0, nowMs),
  };

  const startDiff = diffOfflineCalendarDays(snapshot.licenseStartDate);
  if (startDiff !== null && startDiff > 0) {
    return {
      allowed: false,
      code: "license_not_started",
      updatedSnapshot,
      reason: `لم يبدأ سريان ترخيص هذه المؤسسة بعد (تاريخ البداية: ${snapshot.licenseStartDate}). يرجى التواصل مع المطور أو مراجعة تاريخ البداية.`
    };
  }

  const graceDays = Math.max(0, Number(snapshot.graceDays ?? 0));
  const retentionDays = Math.max(1, Number(snapshot.retentionDaysAfterExpiry ?? 30));

  if (snapshot.subscriptionStatus === "expired" || snapshot.licenseStatus === "expired") {
    return {
      allowed: false,
      code: "license_expired",
      isRetentionWarning: true,
      retentionDaysLeft: retentionDays,
      updatedSnapshot,
      reason: `انتهى اشتراك وترخيص المؤسسة بتاريخ (${snapshot.licenseExpiresAt}). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDays} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة حالياً بأمان، يرجى التواصل مع المطور للتجديد.`
    };
  }

  const expDiff = diffOfflineCalendarDays(snapshot.licenseExpiresAt);
  if (expDiff !== null) {
    if (expDiff < 0) {
      const daysSinceExpiry = Math.abs(expDiff);
      const retentionDaysLeft = Math.max(0, retentionDays - daysSinceExpiry);
      if (graceDays > 0 && daysSinceExpiry <= graceDays) {
        return {
          allowed: true,
          updatedSnapshot,
          remainingDays: expDiff,
          isGracePeriod: true,
          isRetentionWarning: true,
          retentionDaysLeft,
          reason: `تنبيه هام: انتهت صلاحية الترخيص بتاريخ (${snapshot.licenseExpiresAt}) والنظام يعمل ضمن فترة السماح (${graceDays} يوم). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDaysLeft} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة بأمان حالياً.`
        };
      }
      return {
        allowed: false,
        code: "license_expired",
        updatedSnapshot,
        remainingDays: expDiff,
        isRetentionWarning: true,
        retentionDaysLeft,
        reason: `انتهت فترة صلاحية الترخيص بتاريخ (${snapshot.licenseExpiresAt}). سوف يتم حذف بيانات هذا الحساب بعد ${retentionDaysLeft} يوم إذا لم يتم التجديد — جميع بياناتك محفوظة بأمان حالياً ولن يُحذف أي سجل، يرجى التواصل مع المطور لتجديد الاشتراك.`
      };
    }

    // Check offline grace window
    const graceHours = Math.max(1, Number(snapshot.offlineGraceHours) || 72);
    const elapsedHours = (nowMs - (snapshot.lastServerContactMs || nowMs)) / (1000 * 60 * 60);
    if (elapsedHours > graceHours) {
      return {
        allowed: false,
        code: "offline_grace_exceeded",
        updatedSnapshot,
        remainingDays: expDiff,
        reason: `تجاوز العمل دون إنترنت الحد الأقصى المسموح به (${graceHours} ساعة). يرجى الاتصال بالإنترنت للتحقق السحابي من حالة الاشتراك والمزامنة.`
      };
    }

    return { allowed: true, remainingDays: expDiff, updatedSnapshot };
  }

  return { allowed: true, updatedSnapshot };
}
