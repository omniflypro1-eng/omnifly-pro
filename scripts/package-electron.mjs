import { execSync } from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import packager from "@electron/packager";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const ROOT = process.cwd();
const ELECTRON_ABI = "130"; // Electron 33.x uses NODE_MODULE_VERSION 130
const APP_NAME = "OmniFly_Pro";
const OUT_DIR = path.join(ROOT, "dist-desktop");
const TARGET_DIR = path.join(OUT_DIR, `${APP_NAME}-win32-x64`);

function resolveTargetElectronVersion() {
  try {
    const installedPkgPath = path.join(ROOT, "node_modules", "electron", "package.json");
    if (fs.existsSync(installedPkgPath)) {
      const ver = String(JSON.parse(fs.readFileSync(installedPkgPath, "utf8")).version || "").trim();
      if (ver.startsWith("33.")) {
        return ver;
      }
    }
  } catch {}
  return "33.2.1";
}

const ELECTRON_VERSION = resolveTargetElectronVersion();

const IGNORE_PATTERNS = [
  /^\/\.git($|\/)/,
  /^\/\.aistudio($|\/)/,
  /^\/dist-desktop($|\/)/,
  /^\/artifacts\/pos-system($|\/)/,
  /^\/artifacts\/api-server\/src($|\/)/,
  /^\/artifacts\/mockup-sandbox($|\/)/,
  /^\/artifacts\/desktop-binaries($|\/)/,
  /^\/WhatsApp-Source-And-Run($|\/)/,
  /^\/app($|\/)/,
  /^\/src($|\/)/,
  /^\/scripts($|\/)/,
  /^\/node_modules\/electron($|\/)/,
  /^\/node_modules\/@electron($|\/)/,
  /^\/node_modules\/electron-builder($|\/)/,
  /^\/node_modules\/app-builder-bin($|\/)/,
  /^\/node_modules\/7zip-bin($|\/)/,
  /^\/node_modules\/esbuild($|\/)/,
  /^\/node_modules\/@esbuild($|\/)/,
  /^\/node_modules\/vite($|\/)/,
  /^\/node_modules\/@vitejs($|\/)/,
  /^\/node_modules\/typescript($|\/)/,
  /^\/node_modules\/\.vite($|\/)/,
  /^\/node_modules\/\.cache($|\/)/,
  /^\/node_modules\/rollup($|\/)/,
  /^\/node_modules\/@rollup($|\/)/,
  /^\/node_modules\/@tailwindcss($|\/)/,
  /^\/node_modules\/tailwindcss($|\/)/,
  /^\/node_modules\/prettier($|\/)/,
  /^\/node_modules\/@babel($|\/)/,
  /^\/node_modules\/lucide-react($|\/)/,
  /^\/node_modules\/pdfjs-dist($|\/)/,
  /^\/node_modules\/jspdf($|\/)/,
  /^\/node_modules\/html2canvas($|\/)/,
  /^\/node_modules\/recharts($|\/)/,
  /^\/node_modules\/framer-motion($|\/)/,
  /^\/node_modules\/motion($|\/)/,
  /^\/node_modules\/react($|\/)/,
  /^\/node_modules\/react-dom($|\/)/,
  /^\/node_modules\/@radix-ui($|\/)/,
  /^\/node_modules\/@tanstack($|\/)/,
  /^\/node_modules\/xlsx($|\/)/,
  /^\/node_modules\/date-fns-jalali($|\/)/,
  /^\/\.npmignore$/,
  /^\/\.gitignore$/,
  /^\/\.npmrc$/,
  /^\/\.env($|\.)/,
  /^\/server\.ts$/,
  /^\/vite\.config\.ts$/,
  /^\/tsconfig.*\.json$/,
  /^\/Dockerfile$/,
  /^\/netlify\.toml$/,
  /^\/render\.yaml$/,
  /^\/replit\.md$/,
  /^\/.*\.mjs$/,
  /^\/.*\.bat$/,
  /^\/.*\.md$/,
  /^\/artifacts\/api-server\/data\/.*(-wal|-shm|\.corrupt\.|sync-backups|\.omni-install\.json|\.pg-sync-state\.json)/,
];

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

function isNetworkError(err) {
  const msg = `${err?.code || ""} ${err?.message || ""} ${err?.cause?.code || ""}`.toLowerCase();
  return (
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("eai_again") ||
    msg.includes("socket") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    msg.includes("request")
  );
}

function shouldIgnoreRelPath(relPathUnix) {
  const withSlash = relPathUnix.startsWith("/") ? relPathUnix : `/${relPathUnix}`;
  return IGNORE_PATTERNS.some((rx) => rx.test(withSlash));
}

function copyAppFilteredSync(srcRoot, destRoot) {
  fs.mkdirSync(destRoot, { recursive: true });
  const stack = [""];
  while (stack.length > 0) {
    const relDir = stack.pop();
    const absDir = relDir ? path.join(srcRoot, relDir) : srcRoot;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      const relUnix = rel.replace(/\\/g, "/");
      if (shouldIgnoreRelPath(relUnix)) continue;

      const srcPath = path.join(srcRoot, rel);
      const destPath = path.join(destRoot, rel);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        stack.push(rel);
      } else if (entry.isSymbolicLink()) {
        try {
          const realStat = fs.statSync(srcPath);
          if (realStat.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            stack.push(rel);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        } catch {}
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

async function packageOfflineFromLocalElectronDist(iconPath) {
  const localDist = path.join(ROOT, "node_modules", "electron", "dist");
  const localExe = path.join(localDist, "electron.exe");
  if (process.platform !== "win32" || !fs.existsSync(localExe)) {
    return false;
  }

  console.log("[Electron Packager] Using 100% offline local Electron dist fallback (node_modules/electron/dist)...");
  if (fs.existsSync(TARGET_DIR)) {
    fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.cpSync(localDist, TARGET_DIR, { recursive: true });

  const copiedElectronExe = path.join(TARGET_DIR, "electron.exe");
  const targetExe = path.join(TARGET_DIR, `${APP_NAME}.exe`);
  if (fs.existsSync(copiedElectronExe)) {
    fs.renameSync(copiedElectronExe, targetExe);
  }

  const resourcesDir = path.join(TARGET_DIR, "resources");
  const defaultAppAsar = path.join(resourcesDir, "default_app.asar");
  if (fs.existsSync(defaultAppAsar)) {
    try { fs.rmSync(defaultAppAsar, { force: true }); } catch {}
  }

  const appPkgRoot = path.join(resourcesDir, "app");
  copyAppFilteredSync(ROOT, appPkgRoot);

  if (fs.existsSync(iconPath) && fs.existsSync(targetExe)) {
    try {
      const { createRequire } = await import("node:module");
      const req = createRequire(import.meta.url);
      const ResEdit = req("resedit");
      const exeData = fs.readFileSync(targetExe);
      const exe = ResEdit.NtExecutable.from(exeData);
      const res = ResEdit.NtExecutableResource.from(exe);
      const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1,
        1033,
        iconFile.icons.map((item) => item.data)
      );
      res.outputResource(exe);
      fs.writeFileSync(targetExe, Buffer.from(exe.generate()));
    } catch (iconErr) {
      console.warn(`[Electron Packager] Offline icon notice: ${iconErr.message}`);
    }
  }

  return true;
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
    const res = await fetch(prebuildUrl, { redirect: "follow", signal: AbortSignal.timeout(20000) });
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

  if (!fs.existsSync(srcDb)) return;

  // 1. Primary: use better-sqlite3 backup API
  try {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const BetterSqlite3 = req("better-sqlite3");
    const db = new BetterSqlite3(srcDb, { readonly: false });
    try {
      try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch {}
      if (fs.existsSync(destDb)) fs.unlinkSync(destDb);
      await db.backup(destDb);
      console.log(`[Electron SQLite] Created clean standalone seed database at ${destDb}`);
      return;
    } finally {
      db.close();
    }
  } catch (bsErr) {
    console.warn(`[Electron SQLite] better-sqlite3 host backup fallback: ${bsErr.message}`);
  }

  // 2. Secondary: Node built-in node:sqlite (Node 22.5+)
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(srcDb);
    try {
      try { db.exec("PRAGMA wal_checkpoint(TRUNCATE);"); } catch {}
      if (fs.existsSync(destDb)) fs.unlinkSync(destDb);
      const escapedDest = destDb.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedDest}';`);
      console.log(`[Electron SQLite] Created clean standalone seed database via node:sqlite at ${destDb}`);
      return;
    } finally {
      db.close();
    }
  } catch (nsErr) {
    console.warn(`[Electron SQLite] node:sqlite fallback notice: ${nsErr.message}`);
  }

  // 3. Last resort: clean file copy
  fs.copyFileSync(srcDb, destDb);
  console.log(`[Electron SQLite] Copied seed database to ${destDb}`);
}

async function main() {
  const iconPath = path.join(ROOT, "public", "omnisystem-logo.ico");

  // Ensure built files exist
  const requiredBuildOutputs = [
    path.join(ROOT, "dist", "server.cjs"),
    path.join(ROOT, "dist", "index.html"),
    path.join(ROOT, "electron-main.cjs"),
    path.join(ROOT, "preload.cjs"),
  ];
  if (requiredBuildOutputs.some((f) => !fs.existsSync(f))) {
    console.log("[Electron Packager] Build outputs missing — running npm run build first...");
    execSync("npm run build", { cwd: ROOT, stdio: "inherit" });
  }

  // Clean any chat artifacts from dist
  try {
    fs.rmSync(path.join(ROOT, "dist", "assets", "aistudio"), { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, "public", "assets", "aistudio"), { recursive: true, force: true });
  } catch {}

  console.log(`[Electron Packager] Packaging OmniFly Pro (Electron v${ELECTRON_VERSION}) for Windows x64...`);

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
    ignore: IGNORE_PATTERNS,
  };

  try {
    await packager(packageOptions);
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`[Electron Packager] Primary Electron download timed out (${err.message}). Retrying via mirror...`);
      try {
        await packager({
          ...packageOptions,
          download: {
            mirrorOptions: {
              mirror: "https://npmmirror.com/mirrors/electron/",
            },
          },
        });
      } catch (mirrorErr) {
        console.warn(`[Electron Packager] Mirror download notice: ${mirrorErr.message}`);
        const ok = await packageOfflineFromLocalElectronDist(iconPath);
        if (!ok) {
          throw mirrorErr;
        }
      }
    } else {
      throw err;
    }
  }

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

