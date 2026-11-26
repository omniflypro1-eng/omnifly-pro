// @ts-nocheck
import dns from "node:dns";
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}
import express from "express";
import fs from "fs";
import path from "path";
import {
  closePostgresPersistence,
  hydrateFromPostgresBeforeBoot,
} from "./artifacts/api-server/src/lib/pg-persistence";

export async function startServer(customPort?: number): Promise<{ port: number }> {
  // Hydrate internal WAL-SQLite & media uploads from external PostgreSQL (omniflydbs) BEFORE opening SQLite
  await hydrateFromPostgresBeforeBoot();

  const [{ default: apiApp }, { closeDatabaseSafely }] = await Promise.all([
    import("./artifacts/api-server/src/app"),
    import("./artifacts/api-server/src/lib/sqlite"),
  ]);

  const app = express();
  let cliPort: number | undefined;
  const portArgIdx = process.argv.indexOf("--port");
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const parsed = Number(process.argv[portArgIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) cliPort = parsed;
  }
  const port = Number(customPort || cliPort || process.env.PORT || 3000);

  // Mount API routes from api-server
  app.use(apiApp);

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const runtimeDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
    const distPath = fs.existsSync(path.join(runtimeDir, "index.html"))
      ? runtimeDir
      : path.resolve(runtimeDir, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(distPath, "index.html"), (err) => {
        if (err) next(err);
      });
    });
  }

  return new Promise((resolve) => {
    const srv = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
      resolve({ port });
    });

    let shuttingDown = false;
    const shutdown = async (_sig: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      setTimeout(() => process.exit(0), 5000).unref();
      try {
        await Promise.race([
          closePostgresPersistence(),
          new Promise((r) => setTimeout(r, 3500)),
        ]);
      } catch {}
      try {
        closeDatabaseSafely();
      } catch {}
      try {
        srv.close(() => process.exit(0));
      } catch {
        process.exit(0);
      }
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
  });
}

const isDirectRun =
  typeof require !== "undefined"
    ? require.main === module
    : true;

if (isDirectRun) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
