import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import packager from "@electron/packager";

const ROOT = process.cwd();
const ELECTRON_VERSION = "33.2.1";
const ELECTRON_ABI = "130"; // Electron 33.x uses NODE_MODULE_VERSION 130
const APP_NAME = "OmniFly_Pro";
const OUT_DIR = path.join(ROOT, "dist-desktop");
const TARGET_DIR = path.join(OUT_DIR, `${APP_NAME}-win32-x64`);

function extractSingleFileFromTarGz(gzBuffer, targetSuffix) {
  const tar = zlib.gunzipSync(gzBuffer);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;

    const nameRaw = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const prefixRaw = header.subarray(345, 500).toString("utf8").replace(/\0.*$/, "");
    const fullName = (prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw).replace(/\\/g, "/");
    const sizeOctal = header.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
    const size = parseInt(sizeOctal || "0", 8) || 0;
    const typeFlag = String.fromCharCode(header[156] || 48);

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const paddedBlocks = Math.ceil(size / 512) * 512;

    if ((typeFlag === "0" || typeFlag === "\0") && fullName.endsWith(targetSuffix)) {
      return tar.subarray(dataStart, dataEnd);
    }

    offset = dataStart + paddedBlocks;
  }
  return null;
}

async function ensureWindowsBetterSqlite3(appPkgRoot) {
  const targetNodePath = path.join(
    appPkgRoot,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );
  fs.mkdirSync(path.dirname(targetNodePath), { recursive: true });

  // 1. First priority: Use local prebuilt Windows binary from artifacts (offline & zero overhead)
  const localPrebuild = path.join(ROOT, "artifacts", "desktop-binaries", "better_sqlite3-win32-x64-v130.node");
  if (fs.existsSync(localPrebuild)) {
    const localBuf = fs.readFileSync(localPrebuild);
    if (localBuf.length > 10000 && localBuf.subarray(0, 2).toString("ascii") === "MZ") {
      fs.writeFileSync(targetNodePath, localBuf);
      console.log(`[Electron SQLite] Embedded local prebuilt win32-x64 better_sqlite3.node (${(localBuf.length / 1024).toFixed(0)} KB)`);
      return;
    }
  }

  // 2. Second priority: Fetch official prebuild from WiseLibs GitHub releases
  const pkgPath = path.join(ROOT, "node_modules", "better-sqlite3", "package.json");
  const version = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")).version : "11.10.0";
  const prebuildUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${version}/better-sqlite3-v${version}-electron-v${ELECTRON_ABI}-win32-x64.tar.gz`;
  console.log(`[Electron SQLite] Fetching win32-x64 Electron v${ELECTRON_VERSION} (ABI ${ELECTRON_ABI}) prebuild for better-sqlite3 v${version}...`);

  try {
    const res = await fetch(prebuildUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const gzBuffer = Buffer.from(await res.arrayBuffer());
    const nodeBinary = extractSingleFileFromTarGz(gzBuffer, "build/Release/better_sqlite3.node");
    if (!nodeBinary || nodeBinary.length < 10000 || nodeBinary.subarray(0, 2).toString("ascii") !== "MZ") {
      throw new Error("Extracted better_sqlite3.node is missing or not a valid Windows PE binary.");
    }
    fs.writeFileSync(targetNodePath, nodeBinary);
    console.log(`[Electron SQLite] Embedded downloaded win32-x64 better_sqlite3.node (${(nodeBinary.length / 1024).toFixed(0)} KB)`);
    return;
  } catch (err) {
    console.warn(`[Electron SQLite] Prebuild download notice: ${err.message}`);
    if (process.platform === "win32") {
      console.log(`[Electron SQLite] Compiling locally on Windows using @electron/rebuild -v ${ELECTRON_VERSION}...`);
      execSync(`npx --yes @electron/rebuild@^4.2.0 -v ${ELECTRON_VERSION} -f -w better-sqlite3`, {
        cwd: ROOT,
        stdio: "inherit",
      });
      const localBuilt = path.join(ROOT, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
      if (fs.existsSync(localBuilt)) {
        fs.copyFileSync(localBuilt, targetNodePath);
        return;
      }
    }
    throw new Error(`Could not obtain Windows better_sqlite3.node for Electron ${ELECTRON_VERSION}: ${err.message}`);
  }
}

async function ensureCleanSeedDatabase(appPkgRoot) {
  const srcDb = path.join(ROOT, "artifacts", "api-server", "data", "pos.db");
  const destDataDir = path.join(appPkgRoot, "artifacts", "api-server", "data");
  const destDb = path.join(destDataDir, "pos.db");

  fs.mkdirSync(destDataDir, { recursive: true });

  for (const entry of fs.readdirSync(destDataDir)) {
    if (
      entry.endsWith("-wal") ||
      entry.endsWith("-shm") ||
      entry.includes(".corrupt.") ||
      entry === "sync-backups" ||
      entry === ".omni-install.json" ||
      entry === ".pg-sync-state.json"
    ) {
      fs.rmSync(path.join(destDataDir, entry), { recursive: true, force: true });
    }
  }

  if (fs.existsSync(srcDb)) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const BetterSqlite3 = req("better-sqlite3");
    const db = new BetterSqlite3(srcDb, { readonly: false });
    try {
      try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {}
      if (fs.existsSync(destDb)) fs.unlinkSync(destDb);
      await db.backup(destDb);
      console.log(`[Electron SQLite] Created clean standalone seed database at ${destDb}`);
    } finally {
      db.close();
    }
  }
}

async function main() {
  const iconPath = path.join(ROOT, "public", "omnisystem-logo.ico");

  // Clean any chat artifacts from dist
  try {
    fs.rmSync(path.join(ROOT, "dist", "assets", "aistudio"), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, "public", "assets", "aistudio"), { recursive: true, force: true });
  } catch {}

  const ignoreList = [
    /^\/\.git($|\/)/,
    /^\/\.aistudio($|\/)/,
    /^\/dist-desktop($|\/)/,
    /^\/artifacts\/pos-system($|\/)/,
    /^\/artifacts\/api-server\/src($|\/)/,
    /^\/artifacts\/mockup-sandbox($|\/)/,
    /^\/WhatsApp-Source-And-Run($|\/)/,
    /^\/app($|\/)/,
    /^\/\.npmignore$/,
    /^\/\.gitignore$/,
    /^\/.*\.mjs$/,
    /^\/.*\.bat$/,
    /^\/.*\.md$/,
    /^\/artifacts\/api-server\/data\/.*(-wal|-shm|\.corrupt\.|sync-backups|\.omni-install\.json|\.pg-sync-state\.json)/,
  ];

  console.log("[Electron Packager] Packaging OmniFly Pro for Windows x64 using JS API...");

  const packageOptions = {
    dir: ROOT,
    name: APP_NAME,
    out: OUT_DIR,
    platform: "win32",
    arch: "x64",
    electronVersion: ELECTRON_VERSION,
    overwrite: true,
    prune: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    ignore: ignoreList,
  };

  await packager(packageOptions);

  const appPkgRoot = path.join(TARGET_DIR, "resources", "app");
  if (!fs.existsSync(appPkgRoot)) {
    throw new Error(`Packaged app directory not found at ${appPkgRoot}`);
  }

  await ensureWindowsBetterSqlite3(appPkgRoot);
  await ensureCleanSeedDatabase(appPkgRoot);

  console.log(`\n=======================================================`);
  console.log(`✅ تم بناء وتجهيز تطبيق سطح المكتب بنجاح تام!`);
  console.log(`📁 المسار: ${TARGET_DIR}`);
  console.log(`🚀 ملف التشغيل: ${path.join(TARGET_DIR, `${APP_NAME}.exe`)}`);
  console.log(`=======================================================\n`);
}

main().catch((err) => {
  console.error("❌ Electron packaging failed:", err);
  process.exit(1);
});
