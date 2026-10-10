import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

// ── Auto-bootstrap TypeScript Execution (for Render / Docker / production running "node server.ts") ──
// Plain Node.js cannot resolve extensionless TypeScript imports in ESM without a loader.
// If not already running under tsx, bun, or a bootstrapped child process, respawn with `--import tsx`.
const isTsxActive = Boolean(
  process.env.__TSX_BOOTSTRAPPED__ === "1" ||
  process.execArgv.some((a) => a.includes("tsx")) ||
  (process as any).versions?.bun
);

if (!isTsxActive) {
  const child = spawn(process.execPath, ["--import", "tsx", ...process.argv.slice(1)], {
    stdio: "inherit",
    env: { ...process.env, __TSX_BOOTSTRAPPED__: "1" }
  });

  const forwardSignal = (sig: NodeJS.Signals) => {
    try {
      if (!child.killed) child.kill(sig);
    } catch {}
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  child.on("exit", (code, signal) => {
    if (signal) {
      try { process.kill(process.pid, signal); } catch { process.exit(1); }
    } else {
      process.exit(code ?? 0);
    }
  });

  // Keep parent waiting for child process to finish
  await new Promise(() => {});
}

// Global error handlers to prevent unhandled rejections or uncaught exceptions from crashing Node
// This eliminates Cloudflare Error 520 ("Web server is returning an unknown error")
process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Uncaught Exception thrown:", err);
});

// Dynamically import app & express once TSX or Bun loader is guaranteed
const { default: app } = await import("./artifacts/api-server/src/app");
const { default: express } = await import("express");

// Add top-level health checks for Render, Railway, Fly.io, and Cloudflare
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

const _dirname = typeof __dirname !== "undefined" ? __dirname : process.cwd();

const DEFAULT_PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : (process.env.ELECTRON_WORKER_PORT
    ? parseInt(process.env.ELECTRON_WORKER_PORT, 10)
    : 3000);

export async function startServer(portOverride?: number) {
  const PORT = portOverride || DEFAULT_PORT;

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
      configFile: path.resolve(process.cwd(), "vite.config.ts")
    });
    app.use(vite.middlewares);
  } else {
    // التحقق من مجلدات حزمة الإنتاج المجمعة (dist) فقط
    // تجنب اختيار المجلد الجذري للمشروع لأن index.html المصدري يحتوي على /src/main.tsx
    // مما يتسبب في خطأ MIME type "application/octet-stream" وظهور شاشة بيضاء
    const possibleDistDirs = [
      process.env.APP_ROOT ? path.resolve(process.env.APP_ROOT, "dist") : "",
      path.resolve(process.cwd(), "dist"),
      path.resolve(_dirname, "dist"),
      path.resolve(process.cwd(), "artifacts/pos-system/dist"),
      path.resolve(_dirname, "artifacts/pos-system/dist"),
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "app", "dist") : "",
      (process as any).resourcesPath ? path.join((process as any).resourcesPath, "dist") : "",
      path.resolve(process.cwd(), "dist/public"),
      path.resolve(_dirname, "../dist"),
      path.resolve(_dirname, "../../dist"),
    ].filter(Boolean) as string[];
    
    // التحقق من أن المجلد يحتوي على index.html مبني فعلياً (لا يحتوي على إشارة إلى /src/main.tsx)
    let distPath = possibleDistDirs.find((p) => {
      const indexPath = path.join(p, "index.html");
      if (!fs.existsSync(indexPath)) return false;
      try {
        const content = fs.readFileSync(indexPath, "utf-8");
        // حزمة الإنتاج تحتوي على سكربت مبني ولا تشير إلى ملف tsx المصدري
        return !content.includes("/src/main.tsx");
      } catch {
        return false;
      }
    });

    if (!distPath) {
      // احتياطي: أول مجلد يحتوي على index.html
      distPath = possibleDistDirs.find((p) => fs.existsSync(path.join(p, "index.html"))) || path.resolve(process.cwd(), "dist");
    }
    
    process.env.FRONTEND_DIST = distPath;
    console.log(`✅ Frontend static files served from: ${distPath}`);

    // إعداد خدمة الملفات الثابتة مع تحديد نوع MIME صريح لملفات JavaScript وCSS
    // لمنع خطأ: "Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of application/octet-stream"
    const staticOptions = {
      index: false,
      setHeaders: (res: any, filePath: string) => {
        if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        } else if (filePath.endsWith(".json")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
        } else if (filePath.endsWith(".svg")) {
          res.setHeader("Content-Type", "image/svg+xml");
        } else if (filePath.endsWith(".woff2")) {
          res.setHeader("Content-Type", "font/woff2");
        } else if (filePath.endsWith(".woff")) {
          res.setHeader("Content-Type", "font/woff");
        }
      }
    };
    
    app.use(express.static(distPath, staticOptions));
    app.use(express.static(path.resolve(process.cwd(), "public"), staticOptions));
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        res.status(404).json({ error: `API route not found: ${req.path}` });
        return;
      }

      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath, (err) => {
          if (err) next(err);
        });
      } else {
        res.status(503).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head><meta charset="utf-8"><title>OmniFly Pro - جاري التهيئة</title></head>
          <body style="font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center;">
            <div style="background: white; padding: 2rem 3rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h2>جاري تجهيز النظام...</h2>
              <p>يرجى التأكد من تنفيذ أمر البناء <code>npm run build</code> قبل تشغيل وضع الإنتاج.</p>
            </div>
          </body>
          </html>
        `);
      }
    });
  }

  return new Promise((resolve, reject) => {
    const HOST = process.env.HOST || "0.0.0.0";
    const server = app.listen(PORT, HOST, () => {
      const actualPort = typeof server.address() === "object" && server.address() !== null ? (server.address() as any).port : PORT;
      console.log(`🚀 OmniFly Pro Server running on http://${HOST}:${actualPort}`);
      resolve({ server, port: actualPort });
    });
    server.on("error", (err) => {
      console.error(`Failed to start server on port ${PORT}:`, err);
      reject(err);
    });

    const gracefulShutdown = () => {
      console.log('Received kill signal, shutting down gracefully');
      server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  });
}

if (process.env.NO_SERVER_AUTOSTART !== "true") {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}

export default app;