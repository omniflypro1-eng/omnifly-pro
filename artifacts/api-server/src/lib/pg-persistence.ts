import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { Pool } from "pg";
import {
  getTenantSqlitePath,
  getUploadsRootPath,
  isPostgresConfigured,
  resolveLocalSqlitePath,
} from "./db-paths";

export type BackupFn = (destPath: string) => Promise<void>;

interface RegisteredDbSource {
  dbKey: string;
  dbPath: string;
  backupFn: BackupFn;
}

interface SyncStateFile {
  syncedHashes: Record<string, string>;
  syncedMediaHashes: Record<string, string>;
  updatedAt: string;
}

const VALID_DB_KEY_RE = /^(master|tenant_[1-9]\d*)$/;
const SQLITE_MAGIC = Buffer.from("SQLite format 3\0", "utf8");
const MAX_MEDIA_BYTES = 15 * 1024 * 1024; // 15 MB per uploaded file guard

let pgPool: Pool | null = null;
let pgConnected = false;
let pgLastError: string | null = null;
let pgLastSyncAt: string | null = null;
let tablesEnsured = false;
let activeDbDir: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let safetyInterval: ReturnType<typeof setInterval> | null = null;
let firstDirtyAt = 0;
let isFlushing = false;
let rerunFlushRequested = false;

const registeredSources = new Map<string, RegisteredDbSource>();
const dirtyDbKeys = new Set<string>();
const lastSyncedDbHashes = new Map<string, string>();
const lastSyncedMediaHashes = new Map<string, string>();
const mediaStatCache = new Map<string, { mtimeMs: number; size: number; sha256: string }>();

function getSyncStateFilePath(dbDir: string): string {
  return path.join(dbDir, ".pg-sync-state.json");
}

function readSyncState(dbDir: string): SyncStateFile {
  const filePath = getSyncStateFilePath(dbDir);
  try {
    if (fs.existsSync(filePath)) {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return {
        syncedHashes: parsed?.syncedHashes && typeof parsed.syncedHashes === "object" ? parsed.syncedHashes : {},
        syncedMediaHashes: parsed?.syncedMediaHashes && typeof parsed.syncedMediaHashes === "object" ? parsed.syncedMediaHashes : {},
        updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
      };
    }
  } catch {}
  return { syncedHashes: {}, syncedMediaHashes: {}, updatedAt: "" };
}

function writeSyncState(dbDir: string): void {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    const payload: SyncStateFile = {
      syncedHashes: Object.fromEntries(lastSyncedDbHashes.entries()),
      syncedMediaHashes: Object.fromEntries(lastSyncedMediaHashes.entries()),
      updatedAt: new Date().toISOString(),
    };
    const statePath = getSyncStateFilePath(dbDir);
    const tmpPath = `${statePath}.tmp-${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
    fs.renameSync(tmpPath, statePath);
  } catch (err: any) {
    console.warn("[PostgreSQL Sync] Could not persist local sync state:", err?.message || err);
  }
}

function getPool(): Pool | null {
  if (!isPostgresConfigured()) return null;
  if (pgPool) return pgPool;

  const rawUrl = (process.env.DATABASE_URL || "").trim();
  const lower = rawUrl.toLowerCase();
  const disableSsl =
    lower.includes("sslmode=disable") ||
    lower.includes("@localhost") ||
    lower.includes("@127.0.0.1") ||
    lower.includes("@postgres:") ||
    process.env.PG_SSL === "false";

  pgPool = new Pool({
    connectionString: rawUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    ssl: disableSsl ? false : { rejectUnauthorized: false },
  });

  pgPool.on("error", (err) => {
    pgConnected = false;
    pgLastError = err?.message || "PostgreSQL background connection error";
    console.warn("[PostgreSQL Pool] Connection notice:", pgLastError);
  });

  return pgPool;
}

async function ensurePgTables(pool: Pool): Promise<void> {
  if (tablesEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS omnifly_db_snapshots (
      db_key TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL,
      byte_size INTEGER NOT NULL DEFAULT 0,
      snapshot_seq BIGINT NOT NULL DEFAULT 1,
      payload_gzip BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS omnifly_media_blobs (
      rel_path TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL,
      byte_size INTEGER NOT NULL DEFAULT 0,
      payload_gzip BYTEA NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  tablesEnsured = true;
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function isSafeDbKey(dbKey: string): boolean {
  return VALID_DB_KEY_RE.test(dbKey);
}

function resolveDbPathForKey(masterDbPath: string, dbKey: string): string | null {
  if (!isSafeDbKey(dbKey)) return null;
  if (dbKey === "master") return masterDbPath;
  const idMatch = dbKey.match(/^tenant_([1-9]\d*)$/);
  if (!idMatch) return null;
  const tenantId = Number(idMatch[1]);
  return getTenantSqlitePath(path.dirname(masterDbPath), tenantId);
}

function cleanupWalSidecars(sqlitePath: string): void {
  for (const suffix of ["-wal", "-shm"]) {
    const f = `${sqlitePath}${suffix}`;
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  }
}

function listFilesRecursively(rootDir: string, currentDir = rootDir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(currentDir)) return results;
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursively(rootDir, full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function isConfinedPath(baseDir: string, candidatePath: string): boolean {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(candidatePath);
  return resolvedTarget.startsWith(resolvedBase + path.sep);
}

export async function hydrateFromPostgresBeforeBoot(): Promise<void> {
  if (!isPostgresConfigured()) return;

  const pool = getPool();
  if (!pool) return;

  const targetMasterPath = resolveLocalSqlitePath({ seedIfMissing: false });
  const dbDir = path.dirname(targetMasterPath);
  activeDbDir = dbDir;
  fs.mkdirSync(dbDir, { recursive: true });

  const localState = readSyncState(dbDir);
  for (const [k, v] of Object.entries(localState.syncedHashes)) {
    lastSyncedDbHashes.set(k, v);
  }
  for (const [k, v] of Object.entries(localState.syncedMediaHashes)) {
    lastSyncedMediaHashes.set(k, v);
  }

  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    try {
      await pool.query("SELECT 1");
      await ensurePgTables(pool);
      pgConnected = true;
      pgLastError = null;
      break;
    } catch (err: any) {
      pgConnected = false;
      pgLastError = err?.message || String(err);
      console.warn(
        `[PostgreSQL Sync] Connection attempt ${attempt}/3 failed: ${pgLastError}`
      );
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      } else {
        console.warn("[PostgreSQL Sync] Continuing boot with local internal SQLite cache; background sync will retry.");
        return;
      }
    }
  }

  try {
    const res = await pool.query<{
      db_key: string;
      sha256: string;
      byte_size: number;
      payload_gzip: Buffer;
    }>("SELECT db_key, sha256, byte_size, payload_gzip FROM omnifly_db_snapshots ORDER BY db_key ASC");

    let restoredCount = 0;
    for (const row of res.rows) {
      if (!isSafeDbKey(row.db_key) || !row.payload_gzip) continue;
      const destPath = resolveDbPathForKey(targetMasterPath, row.db_key);
      if (!destPath) continue;

      let shouldRestore = !fs.existsSync(destPath);
      let currentLocalSha: string | null = null;
      if (!shouldRestore) {
        try {
          const existingBuf = fs.readFileSync(destPath);
          currentLocalSha = sha256Hex(existingBuf);
          const previouslyRecordedSha = localState.syncedHashes[row.db_key];
          // If this container lacks sync state metadata (fresh Render deploy with git-seeded pos.db),
          // or if PostgreSQL holds a newer snapshot than what we previously synced: PostgreSQL wins.
          if (!previouslyRecordedSha || (currentLocalSha !== row.sha256 && previouslyRecordedSha === currentLocalSha)) {
            shouldRestore = currentLocalSha !== row.sha256;
          }
        } catch {
          shouldRestore = true;
        }
      }

      if (shouldRestore) {
        try {
          const decompressed = zlib.gunzipSync(row.payload_gzip);
          if (decompressed.length < 100 || !decompressed.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
            console.warn(`[PostgreSQL Sync] Skipping invalid SQLite payload for "${row.db_key}"`);
            continue;
          }
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          cleanupWalSidecars(destPath);
          const tmpPath = `${destPath}.pg-restore-${process.pid}`;
          fs.writeFileSync(tmpPath, decompressed);
          fs.renameSync(tmpPath, destPath);
          lastSyncedDbHashes.set(row.db_key, sha256Hex(decompressed));
          restoredCount++;
        } catch (restoreErr: any) {
          console.warn(`[PostgreSQL Sync] Failed restoring "${row.db_key}":`, restoreErr?.message || restoreErr);
        }
      } else {
        lastSyncedDbHashes.set(row.db_key, row.sha256);
      }
    }

    // Restore uploaded files (logos, passports, PDFs, website assets)
    const uploadsRoot = getUploadsRootPath();
    fs.mkdirSync(uploadsRoot, { recursive: true });
    const mediaRes = await pool.query<{
      rel_path: string;
      sha256: string;
      payload_gzip: Buffer;
    }>("SELECT rel_path, sha256, payload_gzip FROM omnifly_media_blobs");

    let restoredMedia = 0;
    for (const mRow of mediaRes.rows) {
      if (!mRow.rel_path || !mRow.payload_gzip) continue;
      const safeRel = mRow.rel_path.replace(/\\/g, "/").replace(/^\/+/, "");
      const destFile = path.resolve(uploadsRoot, safeRel);
      if (!isConfinedPath(uploadsRoot, destFile)) continue;

      let needMedia = !fs.existsSync(destFile);
      if (!needMedia) {
        const recordedMediaSha = localState.syncedMediaHashes[safeRel];
        if (!recordedMediaSha) {
          try {
            const localSha = sha256Hex(fs.readFileSync(destFile));
            needMedia = localSha !== mRow.sha256;
          } catch {
            needMedia = true;
          }
        }
      }

      if (needMedia) {
        try {
          const buf = zlib.gunzipSync(mRow.payload_gzip);
          fs.mkdirSync(path.dirname(destFile), { recursive: true });
          const tmpFile = `${destFile}.pg-tmp-${process.pid}`;
          fs.writeFileSync(tmpFile, buf);
          fs.renameSync(tmpFile, destFile);
          lastSyncedMediaHashes.set(safeRel, mRow.sha256);
          restoredMedia++;
        } catch {}
      } else {
        lastSyncedMediaHashes.set(safeRel, mRow.sha256);
      }
    }

    writeSyncState(dbDir);
    console.log(
      `[PostgreSQL Sync] External database ready (omniflydbs). Restored ${restoredCount} DB snapshot(s) and ${restoredMedia} media file(s).`
    );
  } catch (err: any) {
    pgLastError = err?.message || String(err);
    console.warn("[PostgreSQL Sync] Startup hydration warning:", pgLastError);
  }
}

export function registerDbSnapshotSource(dbKey: string, dbPath: string, backupFn: BackupFn): void {
  if (!isSafeDbKey(dbKey)) return;
  if (!activeDbDir && dbKey === "master") {
    activeDbDir = path.dirname(dbPath);
  }
  registeredSources.set(dbKey, { dbKey, dbPath, backupFn });

  if (!isPostgresConfigured()) return;

  // Ensure safety periodic sync interval is running once
  if (!safetyInterval) {
    safetyInterval = setInterval(() => {
      void syncAllRegisteredToPostgres(false).catch(() => {});
    }, 45_000);
    if (typeof safetyInterval.unref === "function") {
      safetyInterval.unref();
    }
  }

  // If this DB hasn't been recorded in PostgreSQL yet (first boot or newly created tenant), queue sync
  if (!lastSyncedDbHashes.has(dbKey)) {
    markPostgresDbDirty(dbKey, 300);
  }
}

export function markPostgresDbDirty(dbKey = "master", delayMs = 700): void {
  if (!isPostgresConfigured() || !isSafeDbKey(dbKey)) return;
  dirtyDbKeys.add(dbKey);

  const now = Date.now();
  if (!firstDirtyAt) firstDirtyAt = now;
  const elapsed = now - firstDirtyAt;

  // Cap max debounce under heavy write bursts at 3.5 seconds
  const effectiveDelay = elapsed >= 3500 ? 50 : Math.min(delayMs, 3500 - elapsed);

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    firstDirtyAt = 0;
    void flushPostgresPersistenceNow();
  }, Math.max(20, effectiveDelay));

  if (typeof syncTimer.unref === "function") {
    syncTimer.unref();
  }
}

export async function removePostgresTenantSnapshot(tenantId: number): Promise<void> {
  if (!isPostgresConfigured() || !tenantId || tenantId <= 1) return;
  const dbKey = `tenant_${tenantId}`;
  registeredSources.delete(dbKey);
  dirtyDbKeys.delete(dbKey);
  lastSyncedDbHashes.delete(dbKey);
  const pool = getPool();
  if (!pool) return;
  try {
    await ensurePgTables(pool);
    await pool.query("DELETE FROM omnifly_db_snapshots WHERE db_key = $1", [dbKey]);
    if (activeDbDir) writeSyncState(activeDbDir);
  } catch (err: any) {
    console.warn(`[PostgreSQL Sync] Could not delete tenant snapshot ${dbKey}:`, err?.message || err);
  }
}

async function syncSingleDbSource(pool: Pool, source: RegisteredDbSource): Promise<boolean> {
  const tmpSnapPath = `${source.dbPath}.pg-snap-${process.pid}-${Date.now()}`;
  try {
    await source.backupFn(tmpSnapPath);
    if (!fs.existsSync(tmpSnapPath)) return false;
    const raw = fs.readFileSync(tmpSnapPath);
    if (raw.length < 100 || !raw.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)) {
      return false;
    }
    const sha = sha256Hex(raw);
    if (lastSyncedDbHashes.get(source.dbKey) === sha) {
      return false; // Zero changes, zero network transfer
    }
    const compressed = zlib.gzipSync(raw, { level: 6 });
    await pool.query(
      `
      INSERT INTO omnifly_db_snapshots (db_key, sha256, byte_size, snapshot_seq, payload_gzip, updated_at)
      VALUES ($1, $2, $3, 1, $4, NOW())
      ON CONFLICT (db_key) DO UPDATE SET
        sha256 = EXCLUDED.sha256,
        byte_size = EXCLUDED.byte_size,
        snapshot_seq = omnifly_db_snapshots.snapshot_seq + 1,
        payload_gzip = EXCLUDED.payload_gzip,
        updated_at = NOW()
      `,
      [source.dbKey, sha, raw.length, compressed]
    );
    lastSyncedDbHashes.set(source.dbKey, sha);
    pgConnected = true;
    pgLastError = null;
    pgLastSyncAt = new Date().toISOString();
    return true;
  } finally {
    try {
      if (fs.existsSync(tmpSnapPath)) fs.unlinkSync(tmpSnapPath);
    } catch {}
  }
}

async function syncMediaDirectory(pool: Pool): Promise<number> {
  const uploadsRoot = getUploadsRootPath();
  if (!fs.existsSync(uploadsRoot)) return 0;

  const files = listFilesRecursively(uploadsRoot);
  let uploadedCount = 0;

  for (const absPath of files) {
    if (!isConfinedPath(uploadsRoot, absPath)) continue;
    const baseName = path.basename(absPath);
    if (baseName.includes(".pg-tmp-")) continue;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(absPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_MEDIA_BYTES) continue;

    const relPath = path.relative(uploadsRoot, absPath).replace(/\\/g, "/");
    const cached = mediaStatCache.get(relPath);
    let sha: string;
    let rawBuf: Buffer | null = null;

    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
      sha = cached.sha256;
    } else {
      try {
        rawBuf = fs.readFileSync(absPath);
      } catch {
        continue;
      }
      sha = sha256Hex(rawBuf);
      mediaStatCache.set(relPath, { mtimeMs: stat.mtimeMs, size: stat.size, sha256: sha });
    }

    if (lastSyncedMediaHashes.get(relPath) === sha) continue;

    try {
      const buf = rawBuf || fs.readFileSync(absPath);
      const gz = zlib.gzipSync(buf, { level: 6 });
      await pool.query(
        `
        INSERT INTO omnifly_media_blobs (rel_path, sha256, byte_size, payload_gzip, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (rel_path) DO UPDATE SET
          sha256 = EXCLUDED.sha256,
          byte_size = EXCLUDED.byte_size,
          payload_gzip = EXCLUDED.payload_gzip,
          updated_at = NOW()
        `,
        [relPath, sha, buf.length, gz]
      );
      lastSyncedMediaHashes.set(relPath, sha);
      uploadedCount++;
    } catch {}
  }

  return uploadedCount;
}

async function syncAllRegisteredToPostgres(onlyDirty: boolean): Promise<void> {
  if (!isPostgresConfigured()) return;
  const pool = getPool();
  if (!pool) return;

  await ensurePgTables(pool);

  const keysToSync = onlyDirty
    ? Array.from(dirtyDbKeys)
    : Array.from(registeredSources.keys());

  let changedAny = false;
  for (const key of keysToSync) {
    const source = registeredSources.get(key);
    if (!source) {
      dirtyDbKeys.delete(key);
      continue;
    }
    try {
      dirtyDbKeys.delete(key);
      const uploaded = await syncSingleDbSource(pool, source);
      if (uploaded) changedAny = true;
    } catch (err: any) {
      dirtyDbKeys.add(key); // retry next cycle
      pgConnected = false;
      pgLastError = err?.message || String(err);
      console.warn(`[PostgreSQL Sync] Snapshot push failed for "${key}":`, pgLastError);
    }
  }

  try {
    const mediaUploaded = await syncMediaDirectory(pool);
    if (mediaUploaded > 0) changedAny = true;
  } catch {}

  if (changedAny && activeDbDir) {
    writeSyncState(activeDbDir);
  }
}

export async function flushPostgresPersistenceNow(includeCleanCheck = false): Promise<void> {
  if (!isPostgresConfigured()) return;

  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
    firstDirtyAt = 0;
  }

  if (isFlushing) {
    rerunFlushRequested = true;
    return;
  }

  isFlushing = true;
  try {
    await syncAllRegisteredToPostgres(!includeCleanCheck);
    while (rerunFlushRequested) {
      rerunFlushRequested = false;
      await syncAllRegisteredToPostgres(true);
    }
  } finally {
    isFlushing = false;
  }
}

export async function closePostgresPersistence(): Promise<void> {
  if (safetyInterval) {
    clearInterval(safetyInterval);
    safetyInterval = null;
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
    syncTimer = null;
  }
  try {
    await flushPostgresPersistenceNow(true);
  } catch {}
  if (pgPool) {
    try {
      await pgPool.end();
    } catch {}
    pgPool = null;
  }
}

export function getPostgresPersistenceStatus() {
  return {
    configured: isPostgresConfigured(),
    connected: pgConnected,
    registeredDatabases: Array.from(registeredSources.keys()),
    pendingDirtyDatabases: Array.from(dirtyDbKeys),
    lastSyncAt: pgLastSyncAt,
    lastError: pgLastError ? "connection_warning" : null,
  };
}
