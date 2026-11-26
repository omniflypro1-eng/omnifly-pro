import { Router } from "express";
import { getSessionInfo, getTenantDb, isLocalDesktopMode, masterDb } from "../lib/sqlite";
import { runWithTenant } from "../lib/tenant-context";
import { startHybridSyncScheduler } from "../lib/sync-engine";
import accountingRouter from "./accounting";
import adminRouter from "./admin";
import auditRouter from "./audit";
import authRouter from "./auth";
import backupRouter from "./backup";
import branchesRouter from "./branches";
import cashierStatementRouter from "./cashier-statement";
import categoriesRouter from "./categories";
import customersRouter from "./customers";
import dashboardRouter from "./dashboard";
import documentPrintSettingsRouter from "./document-print-settings";
import employeesRouter from "./employees";
import esaalatRouter from "./esaalat";
import expensesRouter from "./expenses";
import healthRouter from "./health";
import hrRouter from "./hr";
import hybridSyncRouter from "./hybrid-sync";
import inventoryRouter from "./inventory";
import kdsRouter from "./kds";
import licensesRouter from "./licenses";
import onyxRouter from "./onyx";
import ordersRouter from "./orders";
import printConfigRouter from "./print-config";
import printLogRouter from "./print-log";
import printerSettingsRouter from "./printer-settings";
import printersRouter from "./printers";
import productsRouter from "./products";
import purchasesRouter from "./purchases";
import recipesRouter from "./recipes";
import reportsRouter from "./reports";
import returnsRouter from "./returns";
import safesRouter from "./safes";
import settingsRouter from "./settings";
import shiftsRouter from "./shifts";
import suppliersRouter from "./suppliers";
import systemRouter from "./system";
import tablesRouter from "./tables";
import travelAdvancedRouter from "./travel-advanced";
import travelAtbRouter from "./travel-atb";
import travelBspRouter from "./travel-bsp";
import travelExtendedRouter from "./travel-extended";
import travelGdsRouter from "./travel-gds";
import travelNotificationsRouter from "./travel-notifications";
import travelPortalsRouter from "./travel-portals";
import travelRouter from "./travel";
import usersRouter from "./users";
import whatsappServiceRouter from "./whatsapp-service";

const router = Router();

function resolvePublicWebsiteTenantId(req: any): number {
  try {
    const rawTenant =
      req.query?.tenant ||
      req.query?.t ||
      req.headers?.["x-tenant-id"] ||
      req.headers?.["x-tenant-code"];

    if (rawTenant) {
      const val = String(rawTenant).trim();
      if (/^\d+$/.test(val)) {
        const numId = Number(val);
        if (numId > 1) {
          const found = masterDb.prepare("SELECT id FROM cloud_tenants WHERE id = ?").get(numId) as { id: number } | undefined;
          if (found?.id) return found.id;
        }
        return 1;
      }
      if (val.length >= 2) {
        const found = masterDb
          .prepare("SELECT id FROM cloud_tenants WHERE UPPER(tenant_code) = UPPER(?)")
          .get(val) as { id: number } | undefined;
        if (found?.id) return found.id;
      }
    }

    // Match custom domain or subdomain configured for a tenant
    const rawHost = String(req.headers?.["x-forwarded-host"] || req.headers?.host || "").split(":")[0].toLowerCase().trim();
    if (rawHost && rawHost.includes(".")) {
      const firstLabel = rawHost.split(".")[0];
      const isPlatformHost = ["localhost", "127", "ais-dev", "ais-pre"].some((p) => rawHost.startsWith(p));

      if (firstLabel && !["www", "localhost", "127", "ais-dev", "ais-pre"].some((p) => firstLabel.startsWith(p))) {
        const found = masterDb
          .prepare("SELECT id FROM cloud_tenants WHERE LOWER(tenant_code) = LOWER(?)")
          .get(firstLabel) as { id: number } | undefined;
        if (found?.id) return found.id;
      }

      if (!isPlatformHost) {
        const allTenants = masterDb
          .prepare("SELECT id FROM cloud_tenants WHERE id > 1")
          .all() as Array<{ id: number }>;
        for (const t of allTenants) {
          try {
            const tDb = getTenantDb(t.id, true);
            const row = tDb
              .prepare("SELECT custom_domain, subdomain FROM website_settings WHERE id = 1")
              .get() as { custom_domain?: string; subdomain?: string } | undefined;
            const cd = String(row?.custom_domain || "").trim().toLowerCase();
            const sd = String(row?.subdomain || "").trim().toLowerCase();
            if ((cd && (rawHost === cd || rawHost === `www.${cd}`)) || (sd && firstLabel === sd)) {
              return t.id;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return 1;
}

// Route multi-tenant web requests transparently into the authenticated or public tenant's isolated database
router.use((req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const sInfo = getSessionInfo(token);
      if (sInfo && !isLocalDesktopMode()) {
        if (sInfo.tenantId > 1) {
          runWithTenant(sInfo.tenantId, () => next(), { userId: sInfo.userId, username: sInfo.username });
          return;
        }
        // Authenticated Tenant-1 sessions remain bound to Tenant 1 unless explicitly calling public website preview
        if (!req.path.startsWith("/public/website") && !req.path.startsWith("/public/esaalat")) {
          runWithTenant(1, () => next(), { userId: sInfo.userId, username: sInfo.username });
          return;
        }
      }
    }
  }

  // Public website endpoints resolve tenant explicitly by query/header/subdomain/custom_domain
  if (!isLocalDesktopMode() && (req.path.startsWith("/public/website") || req.path.startsWith("/public/esaalat"))) {
    const publicTenantId = resolvePublicWebsiteTenantId(req);
    if (publicTenantId > 1) {
      runWithTenant(publicTenantId, () => next());
      return;
    }
  }

  next();
});

router.use(hybridSyncRouter);
router.use(accountingRouter);
router.use(adminRouter);
router.use(auditRouter);
router.use(authRouter);
router.use(backupRouter);
router.use(branchesRouter);
router.use(cashierStatementRouter);
router.use(categoriesRouter);
router.use(customersRouter);
router.use(dashboardRouter);
router.use(documentPrintSettingsRouter);
router.use(employeesRouter);

router.use(expensesRouter);
router.use(healthRouter);
router.use(hrRouter);
router.use(inventoryRouter);
router.use(kdsRouter);
router.use(licensesRouter);
router.use(onyxRouter);
router.use(ordersRouter);
router.use(printConfigRouter);
router.use(printLogRouter);
router.use(printerSettingsRouter);
router.use(printersRouter);
router.use(productsRouter);
router.use(purchasesRouter);
router.use(recipesRouter);
router.use(reportsRouter);
router.use(returnsRouter);
router.use(safesRouter);
router.use(settingsRouter);
router.use(shiftsRouter);
router.use(suppliersRouter);
router.use(systemRouter);
router.use(tablesRouter);
router.use(travelAdvancedRouter);
router.use(travelAtbRouter);
router.use(travelBspRouter);
router.use(travelExtendedRouter);
router.use(travelGdsRouter);
router.use(travelNotificationsRouter);
router.use(travelPortalsRouter);
router.use(travelRouter);
router.use(usersRouter);
router.use("/whatsapp-service", whatsappServiceRouter);

startHybridSyncScheduler();

export default router;
