import path from "node:path";
import { existsSync, mkdirSync, copyFileSync, accessSync, constants as fsConstants } from "node:fs";

const moduleDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

export const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

export function isPostgresDatabaseUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) return false;
  const cleaned = String(rawUrl).trim().toLowerCase();
  return cleaned.startsWith("postgres://") || cleaned.startsWith("postgresql://");
}

export function isPostgresConfigured(): boolean {
  if (process.env.OMNIFLY_DISABLE_PG === "1") return false;
  return isPostgresDatabaseUrl(process.env.DATABASE_URL);
}

export function parseSqliteDatabaseUrl(rawUrl: string): string {
  let cleaned = rawUrl.trim();
  if (cleaned.startsWith("file://")) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith("file:")) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith("sqlite://")) cleaned = cleaned.slice(9);
  else if (cleaned.startsWith("sqlite:")) cleaned = cleaned.slice(7);
  return path.resolve(cleaned);
}

function isPathWritable(targetPath: string): boolean {
  try {
    const dir = path.dirname(targetPath);
    mkdirSync(dir, { recursive: true });
    accessSync(dir, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export function getCandidateSeedPaths(): string[] {
  return [
    path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db"),
    path.resolve(process.cwd(), "artifacts/api-server/data/pos.db"),
    path.resolve(process.cwd(), "data/pos.db"),
    path.resolve(moduleDir, "data/pos.db"),
    path.resolve(moduleDir, "../data/pos.db"),
    path.resolve(moduleDir, "../../artifacts/api-server/data/pos.db"),
    path.resolve(moduleDir, "../../../artifacts/api-server/data/pos.db"),
    path.resolve(moduleDir, "artifacts/api-server/data/pos.db"),
  ];
}

export function resolveLocalSqlitePath(options?: { seedIfMissing?: boolean }): string {
  const seedIfMissing = options?.seedIfMissing !== false;
  let customPath: string | null = null;

  if (process.env.OMNIFLY_DB_PATH && process.env.OMNIFLY_DB_PATH.trim()) {
    customPath = path.resolve(process.env.OMNIFLY_DB_PATH);
  } else if (process.env.DATABASE_PATH && process.env.DATABASE_PATH.trim()) {
    customPath = path.resolve(process.env.DATABASE_PATH);
  } else if (process.env.OMNISYSTEM_DB_PATH && process.env.OMNISYSTEM_DB_PATH.trim()) {
    customPath = path.resolve(process.env.OMNISYSTEM_DB_PATH);
  } else if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    customPath = path.resolve(process.env.DB_PATH);
  } else if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.trim() &&
    !isPostgresDatabaseUrl(process.env.DATABASE_URL)
  ) {
    customPath = parseSqliteDatabaseUrl(process.env.DATABASE_URL);
  }

  const candidatePaths = getCandidateSeedPaths();

  if (customPath) {
    if (isPathWritable(customPath)) {
      if (
        seedIfMissing &&
        !existsSync(customPath) &&
        process.env.OMNIFLY_MODE !== "local" &&
        process.env.OMNIFLY_NO_SEED !== "1"
      ) {
        const seedCandidate = candidatePaths.find((p) => existsSync(p));
        if (seedCandidate && path.resolve(seedCandidate) !== path.resolve(customPath)) {
          try {
            copyFileSync(seedCandidate, customPath);
            console.log(`[Database Setup] Seeded initial SQLite database from ${seedCandidate} to ${customPath}`);
          } catch (copyErr) {
            console.warn(`[Database Setup] Could not copy seed database:`, copyErr);
          }
        }
      }
      return customPath;
    } else {
      console.warn(`[Database Setup] Warning: Custom path "${customPath}" is not writable. Falling back to project data path.`);
    }
  }

  for (const candidate of candidatePaths) {
    if (existsSync(candidate) && isPathWritable(candidate)) {
      return candidate;
    }
  }

  const defaultPath = path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db");
  if (isPathWritable(defaultPath)) {
    return defaultPath;
  }

  const cwdFallback = path.resolve(process.cwd(), "data/pos.db");
  mkdirSync(path.dirname(cwdFallback), { recursive: true });
  return cwdFallback;
}

export function getTenantSqlitePath(dbDir: string, tenantId: number): string {
  return path.join(dbDir, "tenants", `tenant_${tenantId}.db`);
}

export function getUploadsRootPath(): string {
  if (process.env.OMNIFLY_UPLOADS_DIR && process.env.OMNIFLY_UPLOADS_DIR.trim()) {
    const customUploads = path.resolve(process.env.OMNIFLY_UPLOADS_DIR);
    try {
      mkdirSync(customUploads, { recursive: true });
      return customUploads;
    } catch {}
  }
  const candidates = [
    path.resolve(workspaceRoot, "public/uploads"),
    path.resolve(process.cwd(), "public/uploads"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  const preferred = candidates[0];
  try {
    mkdirSync(preferred, { recursive: true });
  } catch {}
  return preferred;
}
