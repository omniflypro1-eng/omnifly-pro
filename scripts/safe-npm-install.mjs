import { spawnSync } from "node:child_process";
import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

const ROOT = process.cwd();
const args = process.argv.slice(2);
const forceInstall = args.includes("--force") || args.includes("-f");

function checkLocalDependenciesReady() {
  const pkgPath = path.join(ROOT, "package.json");
  if (!fs.existsSync(pkgPath)) return { ready: false, missing: ["package.json"], total: 0 };

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };
  const names = Object.keys(allDeps);
  const missing = [];

  for (const name of names) {
    const modPkg = path.join(ROOT, "node_modules", ...name.split("/"), "package.json");
    if (!fs.existsSync(modPkg)) {
      missing.push(name);
    }
  }

  return {
    ready: missing.length === 0,
    missing,
    total: names.length,
  };
}

function runNpmInstall(extraArgs = [], envOverrides = {}) {
  const isWin = process.platform === "win32";
  const npmCmd = isWin ? "npm.cmd" : "npm";

  const existingNodeOpts = process.env.NODE_OPTIONS || "";
  const nodeOpts = existingNodeOpts.includes("--dns-result-order=")
    ? existingNodeOpts
    : `${existingNodeOpts} --dns-result-order=ipv4first`.trim();

  const env = {
    ...process.env,
    NODE_OPTIONS: nodeOpts,
    ...envOverrides,
  };

  const npmArgs = [
    "install",
    "--prefer-offline",
    "--legacy-peer-deps",
    "--no-audit",
    "--no-fund",
    "--maxsockets=3",
    "--fetch-retries=6",
    "--fetch-retry-mintimeout=15000",
    "--fetch-retry-maxtimeout=90000",
    "--fetch-timeout=180000",
    ...extraArgs,
  ];

  const result = spawnSync(npmCmd, npmArgs, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: isWin,
  });

  return result.status === 0;
}

async function main() {
  const status = checkLocalDependenciesReady();

  if (!forceInstall && status.ready) {
    console.log(`✅ جميع مكتبات النظام (${status.total} حزمة) مثبتة وجاهزة محلياً بالفعل — تم تخطي التحميل من الإنترنت بنجاح.`);
    process.exit(0);
  }

  if (status.missing.length > 0) {
    console.log(`[Safe Install] تم رصد ${status.missing.length} حزمة مفقودة (مثل: ${status.missing.slice(0, 5).join(", ")}). جاري التثبيت الآمن...`);
  }

  // Attempt 1: Offline cache only (in case npm cache already holds the missing packages)
  console.log("[1/4] محاولة التثبيت من الذاكرة المحلية (Offline Cache)...");
  if (runNpmInstall(["--offline"])) {
    console.log("✅ تم التثبيت من الذاكرة المحلية بنجاح!");
    process.exit(0);
  }

  // Attempt 2: Standard registry with IPv4-first + low socket concurrency
  console.log("\n[2/4] جاري التثبيت عبر السجل الرسمي (IPv4 + حماية ضد ETIMEDOUT)...");
  if (runNpmInstall([])) {
    console.log("✅ تم تثبيت الحزم بنجاح عبر السجل الرسمي!");
    process.exit(0);
  }

  // Attempt 3: Retry without potentially stale proxy environment variables
  console.log("\n[3/4] تعذر الاتصال بالإعدادات الحالية — إعادة المحاولة مع تجاوز أي Proxy معطّل...");
  const cleanProxyEnv = {
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    npm_config_proxy: "",
    npm_config_https_proxy: "",
  };
  if (runNpmInstall(["--maxsockets=2"], cleanProxyEnv)) {
    console.log("✅ تم تثبيت الحزم بنجاح بعد تنظيف إعدادات البروكسي!");
    process.exit(0);
  }

  // Attempt 4: Fallback to Cloudflare/Alibaba global npm & Electron mirrors
  console.log("\n[4/4] الاتصال بـ registry.npmjs.org يواجه بطئاً/انقطاعاً — التحويل التلقائي إلى المرآة البديلة السريعة (npmmirror)...");
  if (
    runNpmInstall(["--registry=https://registry.npmmirror.com", "--maxsockets=3"], {
      ...cleanProxyEnv,
      ELECTRON_MIRROR: "https://npmmirror.com/mirrors/electron/",
    })
  ) {
    console.log("✅ تم تثبيت الحزم بنجاح عبر السيرفر البديل!");
    process.exit(0);
  }

  console.error("\n❌ تعذر الاتصال بسيرفرات npm من هذا الجهاز.");
  console.error("💡 نصيحة: إذا كانت ملفات node_modules متوفرة لديك مسبقاً، يمكنك تشغيل (npm run electron:package) مباشرة دون الحاجة لتشغيل npm install.");
  process.exit(1);
}

main().catch((err) => {
  console.error("Safe npm install error:", err);
  process.exit(1);
});
