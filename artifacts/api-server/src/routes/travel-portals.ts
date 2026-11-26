import { Router } from "express";
import fs from "node:fs";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import path from "node:path";
import { db, masterDb, createDoubleEntryJournal, logAudit, hashPassword, verifyPassword } from "../lib/sqlite";
import { getCurrentTenantId } from "../lib/tenant-context";
import { getAuthUser } from "./auth";
import { scheduleOrDispatchWebsiteBookingWhatsApp, dispatchViaActiveGateways, verify4WhatsAppFullCredentials, send4WhatsAppOtpDirect, ensure4WhatsAppConfigTable } from "./travel-notifications";

const router = Router();

// ============================================================================
// AUTOMATIC & TENANT-ISOLATED WEBSITE SYNC & EXPORT HELPERS
// ============================================================================

let gitSyncTimeout: NodeJS.Timeout | null = null;
let isGitSyncRunning = false;
let hasPendingGitSync = false;

export function exportWebsiteDataToFile(explicitTenantId?: number) {
  try {
    const tenantId = explicitTenantId || getCurrentTenantId() || 1;
    const settings = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
    const services = db.prepare("SELECT * FROM website_custom_services WHERE is_active = 1 ORDER BY sort_order ASC, id DESC").all();
    let promotions: any[] = [];
    try {
      promotions = db.prepare("SELECT * FROM website_promotions WHERE is_active = 1 ORDER BY sort_order ASC, id DESC").all();
    } catch {}

    let ndcOffers: any[] = [];
    try {
      ndcOffers = db.prepare("SELECT * FROM travel_ndc_offers WHERE status = 'available' LIMIT 20").all();
    } catch {}

    // Never leak unpublished draft JSON into public static exports
    const cleanSettings = settings ? { ...settings } : {};
    delete cleanSettings.draft_config_json;

    const data = {
      tenant_id: tenantId,
      settings: cleanSettings,
      services,
      promotions,
      ndcOffers,
      last_sync: new Date().toISOString()
    };

    const dataJson = JSON.stringify(data, null, 2);
    const publicDir = path.resolve(process.cwd(), "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, `website-data-tenant-${tenantId}.json`), dataJson);
    if (tenantId === 1) {
      fs.writeFileSync(path.join(publicDir, "website-data.json"), dataJson);
    }

    const distDir = path.resolve(process.cwd(), "dist");
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, `website-data-tenant-${tenantId}.json`), dataJson);
      if (tenantId === 1) {
        fs.writeFileSync(path.join(distDir, "website-data.json"), dataJson);
      }
    }

    return data;
  } catch (err: any) {
    console.error("[Auto-Sync] Error exporting website data:", err.message);
    return null;
  }
}

async function pushToLiveRender(data: any) {
  const syncSecret = process.env.OMNIFLY_SYNC_SECRET;
  if (process.env.ENABLE_REMOTE_RENDER_SYNC !== "1" || !syncSecret) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const renderUrl = "https://omnifly-pro-jdpf.onrender.com/api/public/website/sync-push";

    await fetch(renderUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: syncSecret,
        settings: data?.settings,
        services: data?.services
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
  } catch {}
}

async function executeGitPushWorker(userId?: number, userName?: string) {
  if (process.env.ENABLE_AUTO_GIT_SYNC !== "1") return;
  if (isGitSyncRunning) {
    hasPendingGitSync = true;
    return;
  }

  isGitSyncRunning = true;
  hasPendingGitSync = false;

  try {
    const lockPath = path.resolve(process.cwd(), ".git/index.lock");
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch {}
    }

    const gitCmd = 'git add . && git commit --allow-empty -m "Auto-Sync: Website content update" && git push origin HEAD:main';
    execSync(gitCmd, { encoding: "utf8", stdio: "pipe", timeout: 35000 });

    if (userId && userName) {
      logAudit(userId, userName, "WEBSITE_AUTO_SYNC", "تزامن سحابي تلقائي مع مستودع النشر");
    }
  } catch (err: any) {
    console.warn("[Auto-Sync] Git Push notice:", err.message);
  } finally {
    isGitSyncRunning = false;
    if (hasPendingGitSync) {
      hasPendingGitSync = false;
      setTimeout(() => executeGitPushWorker(userId, userName), 1000);
    }
  }
}

export function scheduleAutoSync(userId?: number, userName?: string) {
  const tenantId = getCurrentTenantId() || 1;
  const data = exportWebsiteDataToFile(tenantId);
  if (data) {
    pushToLiveRender(data);
  }
  if (process.env.ENABLE_AUTO_GIT_SYNC === "1") {
    if (gitSyncTimeout) clearTimeout(gitSyncTimeout);
    gitSyncTimeout = setTimeout(() => {
      executeGitPushWorker(userId, userName);
    }, 2000);
  }
}

export async function triggerNetlifySync(userId: number, userName: string) {
  scheduleAutoSync(userId, userName);
  return { success: true, message: "تم تحديث ملفات الموقع وتصدير الإعدادات المنشورة بنجاح." };
}

function requireWebsiteAdmin(req: any, res: any) {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح: يرجى تسجيل الدخول" });
    return null;
  }
  const role = String(user.role || "").toLowerCase();
  const uname = String(user.username || "").toLowerCase();
  const allowedRoles = ["developer", "admin", "manager", "general_manager", "website_manager", "مدير", "مدير عام", "مدير عام الشركة"];
  if (allowedRoles.includes(role) || uname === "admin" || uname === "developer") {
    return user;
  }
  if (Array.isArray(user.allowed_modules) && user.allowed_modules.includes("sys_website")) {
    return user;
  }
  try {
    const dbUser = db.prepare("SELECT perm_edit_entries, allowed_modules FROM users WHERE id = ?").get(user.id) as any;
    if (dbUser?.perm_edit_entries === 1) {
      return user;
    }
    if (dbUser?.allowed_modules && String(dbUser.allowed_modules).includes("sys_website")) {
      return user;
    }
  } catch {}
  res.status(403).json({ error: "ليس لديك صلاحية إدارية لتعديل إعدادات الموقع والهوية البصرية" });
  return null;
}

const WEBSITE_WRITABLE_COLUMNS = new Set([
  "site_name", "site_slogan", "phone", "secondary_phone", "whatsapp", "email", "address", "geo_location",
  "hero_title", "hero_title_2", "hero_title_3", "hero_subtitle", "hero_image_url", "hero_slides_json",
  "hero_cta_primary_text", "hero_cta_primary_link", "hero_cta_secondary_text", "hero_cta_secondary_link",
  "rides_enabled", "flight_enabled", "hotel_enabled", "packages_enabled", "visas_enabled", "bus_enabled", "insurance_enabled",
  "flight_markup_val", "flight_markup_type", "hotel_markup_val", "hotel_markup_type", "package_markup_val", "package_markup_type",
  "payment_card_enabled", "payment_bank_enabled", "payment_cash_enabled", "bank_name", "bank_iban", "bank_account_name",
  "promo_code", "promo_discount_percent", "currency",
  "require_id_upload", "show_id_upload", "team_notification_phone",
  "enable_whatsapp_otp", "require_whatsapp_otp", "show_website_images", "show_hero_image", "show_services_images", "show_site_logos",
  "topbar_announcement", "topbar_text", "customer_service_name", "announcement_badge_1", "announcement_badge_2", "nav_subtitle",
  "logo_url", "system_logo_url", "itqan_logo_url", "header_logo_type", "footer_logo_type", "favicon_url",
  "rides_image_url", "flight_image_url", "hotel_image_url", "packages_image_url", "visas_image_url",
  "social_handle", "facebook_url", "x_url", "instagram_url", "show_social_links", "show_login_btn", "show_register_btn",
  "primary_color", "secondary_color", "button_color", "button_hover_color", "background_color", "card_bg_color",
  "text_primary_color", "text_secondary_color", "link_color", "border_color", "navbar_bg_color", "footer_bg_color",
  "design_style", "theme_mode", "button_radius", "card_radius", "shadow_level", "font_family", "base_font_size",
  "content_width", "section_spacing", "background_pattern",
  "sections_config_json", "features_json", "nav_links_json", "services_showcase_json",
  "inquiry_title", "inquiry_subtitle", "footer_desc", "footer_unified_id",
  "footer_quick_services_title", "footer_contact_title", "footer_address",
  "footer_guarantee_title", "footer_guarantee_desc", "footer_license_badge", "footer_copyright",
  "custom_domain", "subdomain"
]);

const DEFAULT_THEME_STYLE_FIELDS: Record<string, any> = {
  primary_color: "#0D6EFD",
  secondary_color: "#F59E0B",
  button_color: "#0D6EFD",
  button_hover_color: "#0B5ED7",
  background_color: "#F8FAFC",
  card_bg_color: "#FFFFFF",
  text_primary_color: "#0F172A",
  text_secondary_color: "#475569",
  link_color: "#0D6EFD",
  border_color: "#E2E8F0",
  navbar_bg_color: "#FFFFFF",
  footer_bg_color: "#0F294A",
  design_style: "modern",
  theme_mode: "light",
  button_radius: "rounded",
  card_radius: "lg",
  shadow_level: "soft",
  font_family: "Tajawal",
  base_font_size: 16,
  content_width: "standard",
  section_spacing: "normal",
  background_pattern: "solid",
  header_logo_type: "company",
  footer_logo_type: "company",
  sections_config_json: "",
  features_json: "",
  nav_links_json: "",
  services_showcase_json: "",
  enable_whatsapp_otp: 1,
  require_whatsapp_otp: 1,
  show_website_images: 1,
  show_hero_image: 1,
  show_services_images: 1,
  show_site_logos: 1
};

function sanitizeHexColor(val: any, fallback: string): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

function sanitizeConfigFields(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  const hexKeys = new Set([
    "primary_color", "secondary_color", "button_color", "button_hover_color",
    "background_color", "card_bg_color", "text_primary_color", "text_secondary_color",
    "link_color", "border_color", "navbar_bg_color", "footer_bg_color"
  ]);
  for (const [k, v] of Object.entries(input || {})) {
    if (!WEBSITE_WRITABLE_COLUMNS.has(k) || v === undefined) continue;
    if (hexKeys.has(k)) {
      out[k] = sanitizeHexColor(v, DEFAULT_THEME_STYLE_FIELDS[k] || "#0D6EFD");
    } else if (k === "base_font_size") {
      out[k] = Math.min(20, Math.max(13, Number(v) || 16));
    } else if (
      k.endsWith("_enabled") ||
      k === "show_social_links" ||
      k === "show_login_btn" ||
      k === "show_register_btn" ||
      k === "require_id_upload" ||
      k === "show_id_upload" ||
      k === "enable_whatsapp_otp" ||
      k === "require_whatsapp_otp" ||
      k === "show_website_images" ||
      k === "show_hero_image" ||
      k === "show_services_images" ||
      k === "show_site_logos"
    ) {
      out[k] = Number(v) ? 1 : 0;
    } else if (
      k === "flight_markup_val" ||
      k === "hotel_markup_val" ||
      k === "package_markup_val" ||
      k === "promo_discount_percent"
    ) {
      out[k] = Number(v) || 0;
    } else if (typeof v === "object" && v !== null) {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = v === null ? "" : String(v);
    }
  }
  return out;
}

function getTenantMeta(tenantId: number) {
  try {
    const row = masterDb
      .prepare("SELECT id, tenant_code, company_name FROM cloud_tenants WHERE id = ?")
      .get(tenantId) as any;
    if (row) return row;
  } catch {}
  return { id: tenantId, tenant_code: tenantId === 1 ? "OMNI-MAIN" : `TENANT-${tenantId}`, company_name: "" };
}

function applyColumnsToWebsiteSettings(fields: Record<string, any>, extraSqlSet: string[] = []) {
  const cols = (db.prepare("PRAGMA table_info(website_settings)").all() as any[]).map((c) => c.name);
  const setClauses: string[] = [];
  const values: any[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (cols.includes(k)) {
      setClauses.push(`${k} = ?`);
      values.push(v);
    }
  }
  for (const extra of extraSqlSet) {
    setClauses.push(extra);
  }
  setClauses.push("updated_at = (datetime('now', 'localtime'))");
  if (setClauses.length > 0) {
    db.prepare(`UPDATE website_settings SET ${setClauses.join(", ")} WHERE id = 1`).run(...values);
  }
}

function validateAndSanitizeUploadedImage(base64Data: string, rawFileName: string) {
  const MAX_BYTES = 5 * 1024 * 1024;
  const match = String(base64Data).match(/^data:(image\/(?:png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i);
  if (!match) {
    throw new Error("صيغة الملف غير مدعومة. الصيغ المسموح بها: PNG, JPG, WebP, SVG فقط");
  }

  const mime = match[1].toLowerCase();
  const rawBuffer = Buffer.from(match[2], "base64");
  if (rawBuffer.length === 0 || rawBuffer.length > MAX_BYTES) {
    throw new Error("حجم الصورة يجب أن يكون أقل من 5 ميجابايت");
  }

  const extMap: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg"
  };
  const safeExt = extMap[mime];
  if (!safeExt) {
    throw new Error("امتداد الصورة غير مسموح به");
  }

  let finalBuffer: Buffer = rawBuffer;
  if (mime === "image/png") {
    if (rawBuffer.length < 8 || rawBuffer[0] !== 0x89 || rawBuffer[1] !== 0x50 || rawBuffer[2] !== 0x4e || rawBuffer[3] !== 0x47) {
      throw new Error("ملف PNG غير صالح");
    }
  } else if (mime === "image/jpeg" || mime === "image/jpg") {
    if (rawBuffer.length < 3 || rawBuffer[0] !== 0xff || rawBuffer[1] !== 0xd8 || rawBuffer[2] !== 0xff) {
      throw new Error("ملف JPG غير صالح");
    }
  } else if (mime === "image/webp") {
    if (
      rawBuffer.length < 12 ||
      rawBuffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
      rawBuffer.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      throw new Error("ملف WebP غير صالح");
    }
  } else if (mime === "image/svg+xml") {
    let svgText = rawBuffer.toString("utf8");
    if (!/<svg[\s>]/i.test(svgText)) {
      throw new Error("ملف SVG غير صالح");
    }
    svgText = svgText
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
      .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, "")
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript\s*:/gi, "");
    finalBuffer = Buffer.from(svgText, "utf8");
  }

  const baseStem = path
    .basename(String(rawFileName || "asset"), path.extname(String(rawFileName || "")))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 32) || "asset";
  const safeFileName = `${baseStem}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}${safeExt}`;
  return { buffer: finalBuffer, safeFileName };
}



// ============================================================================
// B2B CORPORATE PORTAL API ENDPOINTS
// ============================================================================

// 1. Get all corporate accounts
router.get("/travel/corporate/accounts", (_req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
           (SELECT COUNT(*) FROM travel_corporate_employees WHERE corporate_id = c.id) as employees_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id) as requests_count,
           (SELECT COUNT(*) FROM travel_corporate_requests WHERE corporate_id = c.id AND status = 'pending_approval') as pending_approvals_count
    FROM travel_corporate_accounts c
    ORDER BY c.id DESC
  `).all();
  res.json(rows);
});

// 2. Get corporate account by ID with employees and recent requests
router.get("/travel/corporate/accounts/:id", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }
  const employees = db.prepare("SELECT * FROM travel_corporate_employees WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  const requests = db.prepare("SELECT * FROM travel_corporate_requests WHERE corporate_id = ? ORDER BY id DESC").all(req.params.id);
  res.json({ account, employees, requests });
});

// 3. Create new corporate account
router.post("/travel/corporate/accounts", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit = 50000, payment_terms_days = 30,
    policy_max_booking_budget = 5000, policy_allowed_classes = "اقتصادية,أعمال",
    policy_require_manager_approval = 1, notes
  } = req.body;

  if (!company_name) {
    res.status(400).json({ error: "اسم الشركة مطلوب" });
    return;
  }

  const account_code = `CORP-${Date.now().toString().slice(-6)}`;

  const ins = db.prepare(`
    INSERT INTO travel_corporate_accounts (
      company_name, company_name_en, account_code, cr_number, tax_number,
      contact_person, contact_phone, contact_email, credit_limit, current_balance,
      payment_terms_days, policy_max_booking_budget, policy_allowed_classes,
      policy_require_manager_approval, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'active', ?)
  `);

  const r = ins.run(
    company_name, company_name_en || null, account_code, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null, Number(credit_limit),
    Number(payment_terms_days), Number(policy_max_booking_budget), policy_allowed_classes,
    Number(policy_require_manager_approval), notes || null
  );

  const newAcc = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(r.lastInsertRowid);
  logAudit(user.id, user.name, "CORPORATE_ACCOUNT_CREATED", `إنشاء حساب شركة B2B جديد: ${company_name}`);

  res.status(201).json(newAcc);
});

// 4. Update corporate account
router.put("/travel/corporate/accounts/:id", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    company_name, company_name_en, cr_number, tax_number, contact_person,
    contact_phone, contact_email, credit_limit, current_balance, payment_terms_days,
    policy_max_booking_budget, policy_allowed_classes, policy_require_manager_approval,
    status, notes
  } = req.body;

  db.prepare(`
    UPDATE travel_corporate_accounts
    SET company_name = ?, company_name_en = ?, cr_number = ?, tax_number = ?,
        contact_person = ?, contact_phone = ?, contact_email = ?, credit_limit = ?,
        current_balance = ?, payment_terms_days = ?, policy_max_booking_budget = ?,
        policy_allowed_classes = ?, policy_require_manager_approval = ?, status = ?, notes = ?
    WHERE id = ?
  `).run(
    company_name, company_name_en || null, cr_number || null, tax_number || null,
    contact_person || null, contact_phone || null, contact_email || null,
    Number(credit_limit || 50000), Number(current_balance || 0), Number(payment_terms_days || 30),
    Number(policy_max_booking_budget || 5000), policy_allowed_classes,
    Number(policy_require_manager_approval ? 1 : 0), status || "active", notes || null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 5. Add employee to corporate account
router.post("/travel/corporate/employees", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const {
    corporate_id, name_ar, name_en, employee_number, department,
    cost_center, job_title, phone, email, passport_number, passport_expiry,
    max_budget = 3000, allowed_class = "اقتصادية", requires_approval = 1
  } = req.body;

  if (!corporate_id || !name_ar || !employee_number) {
    res.status(400).json({ error: "معرف الشركة واسم الموظف والرقم الوظيفي حقول مطلوبة" });
    return;
  }

  const ins = db.prepare(`
    INSERT INTO travel_corporate_employees (
      corporate_id, name_ar, name_en, employee_number, department,
      cost_center, job_title, phone, email, passport_number, passport_expiry,
      max_budget, allowed_class, requires_approval, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const r = ins.run(
    corporate_id, name_ar, name_en || name_ar, employee_number, department || null,
    cost_center || null, job_title || null, phone || null, email || null,
    passport_number || null, passport_expiry || null, Number(max_budget),
    allowed_class, Number(requires_approval)
  );

  const emp = db.prepare("SELECT * FROM travel_corporate_employees WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(emp);
});

// 6. Submit Corporate Travel Request (With Policy Check)
router.post("/travel/corporate/requests", (req, res) => {
  const {
    corporate_id, employee_id, passenger_name, service_type = "flight",
    trip_type = "round_trip", origin, destination, departure_date, return_date,
    preferred_class = "اقتصادية", purpose_of_trip, estimated_cost = 0
  } = req.body;

  if (!corporate_id || !passenger_name || !origin || !destination || !departure_date) {
    res.status(400).json({ error: "جميع بيانات الرحلة والمسافر مطلوبة" });
    return;
  }

  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(corporate_id) as any;
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  // Check policy rules
  let autoApprove = false;
  const estCost = Number(estimated_cost || 0);
  if (account.policy_require_manager_approval === 0 && estCost <= account.policy_max_booking_budget) {
    autoApprove = true;
  }

  const reqNumber = `REQ-CORP-${Date.now().toString().slice(-6)}`;
  const status = autoApprove ? "approved" : "pending_approval";

  const ins = db.prepare(`
    INSERT INTO travel_corporate_requests (
      request_number, corporate_id, employee_id, passenger_name, service_type,
      trip_type, origin, destination, departure_date, return_date,
      preferred_class, purpose_of_trip, estimated_cost, actual_cost,
      status, approver_name, approved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  const r = ins.run(
    reqNumber, corporate_id, employee_id || null, passenger_name, service_type,
    trip_type, origin, destination, departure_date, return_date || null,
    preferred_class, purpose_of_trip || null, estCost, status,
    autoApprove ? "النظام (الموافقة التلقائية لسياسة السفر)" : null,
    autoApprove ? new Date().toISOString() : null
  );

  const newReq = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(newReq);
});

// 7. Approve / Reject Corporate Travel Request
router.post("/travel/corporate/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { action, approver_name, notes, actual_cost } = req.body; // action: 'approve' | 'reject'
  const reqItem = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id) as any;
  if (!reqItem) {
    res.status(404).json({ error: "طلب السفر غير موجود" });
    return;
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const cost = actual_cost ? Number(actual_cost) : reqItem.estimated_cost;

  db.prepare(`
    UPDATE travel_corporate_requests
    SET status = ?, approver_name = ?, approval_notes = ?, approved_at = ?, actual_cost = ?
    WHERE id = ?
  `).run(
    newStatus,
    approver_name || user.name,
    notes || null,
    new Date().toISOString(),
    cost,
    req.params.id
  );

  // If approved, update corporate balance
  if (action === "approve") {
    db.prepare("UPDATE travel_corporate_accounts SET current_balance = current_balance + ? WHERE id = ?").run(cost, reqItem.corporate_id);
  }

  const updated = db.prepare("SELECT * FROM travel_corporate_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// 8. Get corporate statement / ledger
router.get("/travel/corporate/:id/statement", (req, res) => {
  const account = db.prepare("SELECT * FROM travel_corporate_accounts WHERE id = ?").get(req.params.id);
  if (!account) {
    res.status(404).json({ error: "حساب الشركة غير موجود" });
    return;
  }

  const requests = db.prepare(`
    SELECT r.*, e.department, e.employee_number
    FROM travel_corporate_requests r
    LEFT JOIN travel_corporate_employees e ON e.id = r.employee_id
    WHERE r.corporate_id = ?
    ORDER BY r.id DESC
  `).all(req.params.id);

  res.json({ account, statement_items: requests });
});

// ============================================================================
// B2C PASSENGER SELF-SERVICE PORTAL API ENDPOINTS
// ============================================================================

// 9. Passenger Self-Service Lookup (PNR, Ticket, Passport, or Phone)
router.get("/travel/b2c/lookup", (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length < 2) {
    res.status(400).json({ error: "الرجاء إدخال رقم الحجز أو التذكرة أو الجواز أو الهاتف" });
    return;
  }

  const q = String(query).trim();

  // Search bookings
  const bookings = db.prepare(`
    SELECT b.*, 
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.pnr LIKE ? OR b.ticket_number LIKE ? OR b.booking_number LIKE ?
       OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY b.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  // Search visas
  const visas = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number LIKE ? OR p.passport_number LIKE ? OR c.phone LIKE ?
    ORDER BY v.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);

  // Search hotels
  const hotels = db.prepare(`
    SELECT h.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en,
           c.name as customer_name, c.phone as customer_phone
    FROM travel_hotels h
    LEFT JOIN travel_passengers p ON p.id = h.passenger_id
    LEFT JOIN customers c ON c.id = h.customer_id
    WHERE h.booking_ref LIKE ? OR c.phone LIKE ?
    ORDER BY h.id DESC
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`);

  res.json({
    query: q,
    results_count: bookings.length + visas.length + hotels.length,
    bookings,
    visas,
    hotels
  });
});

// 10. Visa Milestone Live Timeline Tracker
router.get("/travel/b2c/visa-tracking/:param", (req, res) => {
  const param = req.params.param.trim();
  const visa = db.prepare(`
    SELECT v.*,
           p.name_ar as passenger_name_ar, p.name_en as passenger_name_en, p.passport_number,
           p.nationality, c.name as customer_name, c.phone as customer_phone
    FROM travel_visas v
    LEFT JOIN travel_passengers p ON p.id = v.passenger_id
    LEFT JOIN customers c ON c.id = v.customer_id
    WHERE v.visa_number = ? OR v.id = ? OR p.passport_number = ?
  `).get(param, param, param) as any;

  if (!visa) {
    res.status(404).json({ error: "معاملة التأشيرة غير موجودة" });
    return;
  }

  // Construct official embassy milestones timeline
  const statusMilestones: Record<string, number> = {
    pending: 1,
    in_review: 2,
    submitted: 3,
    biometrics: 4,
    under_process: 5,
    approved: 6,
    delivered: 7,
    rejected: -1
  };

  const currentStep = statusMilestones[visa.status] || (visa.status === "approved" ? 6 : 3);

  const timeline = [
    { step: 1, title: "استلام الوثائق والجواز", desc: "تم استلام متطلبات التأشيرة من العميل والتحقق من صحة المستندات", date: visa.application_date || "2026-08-10", completed: currentStep >= 1 },
    { step: 2, title: "المراجعة وتعبئة النموذج الرسمي", desc: "تمت مراجعة البيانات وتعبئة الأبلكيشن وسداد الرسوم القنصلية", date: visa.application_date || "2026-08-12", completed: currentStep >= 2 },
    { step: 3, title: "التقديم إلى السفارة / مركز التأشيرات (VFS/TLS)", desc: "تم تقديم الملف رسمياً إلى القنصلية المعتمدة", date: visa.application_date || "2026-08-15", completed: currentStep >= 3 },
    { step: 4, title: "موعد البصمة والصور الحيوية (Biometrics)", desc: "حضور موعد التبصيم في مركز التأشيرات المعتمد", date: visa.application_date || "2026-08-18", completed: currentStep >= 4 },
    { step: 5, title: "قيد الدراسة والتدقيق الأمني في القنصلية", desc: "جواز السفر والملف قيد المعالجة النهائية لدى القنصلية", date: visa.application_date || "2026-08-20", completed: currentStep >= 5 },
    { step: 6, title: "صدور التأشيرة وإلصاقها في الجواز", desc: "تمت الموافقة الرسمية على التأشيرة واستلام الجواز من السفارة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 6 },
    { step: 7, title: "جاهز للتسليم أو الإرسال عبر الشحن", desc: "الجواز والتأشيرة جاهزة للاستلام من فرع الوكالة", date: visa.expiry_date || "2026-08-22", completed: currentStep >= 7 }
  ];

  res.json({
    visa,
    current_step: currentStep,
    timeline
  });
});

// 11. Submit B2C Customer Request (Change date, Refund, Inquiry)
router.post("/travel/b2c/requests", (req, res) => {
  const {
    request_type, customer_name, customer_phone, customer_email,
    pnr_or_ticket, passport_number, request_details, preferred_new_date
  } = req.body;

  if (!request_type || !customer_name || !customer_phone || !request_details) {
    res.status(400).json({ error: "اسم العميل ورقم الهاتف ونوع الطلب والتفاصيل حقول مطلوبة" });
    return;
  }

  const requestCode = `REQ-B2C-${Date.now().toString().slice(-6)}`;

  let calculatedFees = 0;
  if (request_type === "change_date") calculatedFees = 200; // Standard agency reissue fee
  if (request_type === "refund_ticket") calculatedFees = 150; // Standard cancellation fee

  const ins = db.prepare(`
    INSERT INTO travel_b2c_requests (
      request_code, request_type, customer_name, customer_phone, customer_email,
      pnr_or_ticket, passport_number, request_details, preferred_new_date,
      calculated_fees, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')
  `);

  const r = ins.run(
    requestCode, request_type, customer_name, customer_phone, customer_email || null,
    pnr_or_ticket || null, passport_number || null, request_details,
    preferred_new_date || null, calculatedFees
  );

  const created = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json(created);
});

// 12. Agent view and resolve B2C customer requests
router.get("/travel/b2c/agent-requests", (_req, res) => {
  const rows = db.prepare("SELECT * FROM travel_b2c_requests ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

router.post("/travel/b2c/requests/:id/action", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }

  const { status, agent_response } = req.body; // status: 'in_review' | 'actioned' | 'rejected'

  db.prepare(`
    UPDATE travel_b2c_requests
    SET status = ?, agent_response = ?, assigned_agent = ?, resolved_at = ?
    WHERE id = ?
  `).run(
    status || "actioned",
    agent_response || null,
    user.name,
    status === "actioned" || status === "rejected" ? new Date().toISOString() : null,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM travel_b2c_requests WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ============================================================================
// PUBLIC CUSTOMER TRAVEL WEBSITE & BOOKINGS API ENDPOINTS
// ============================================================================

// 13. Get public website configuration & published branding (isolated per tenant)
router.get("/public/website/config", (req, res) => {
  const tenantId = getCurrentTenantId() || 1;
  const tenantMeta = getTenantMeta(tenantId);
  let settings = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;

  if (!settings) {
    settings = {
      id: 1,
      tenant_id: tenantId,
      site_name: tenantMeta.company_name || "اتقان سوفت للسفريات والسياحة",
      site_slogan: "حلول متكاملة لإدارة وكالات السفر والسياحة بأحدث التقنيات",
      phone: "+966 50 123 4567",
      whatsapp: "966501234567",
      email: "reservations@itqansoft-travel.sa",
      address: "الرياض - المملكة العربية السعودية",
      geo_location: "المملكة العربية السعودية",
      hero_title_2: "سافر بكل راحة وأمان..",
      hero_title_3: `مع ${tenantMeta.company_name || "اتقان سوفت للسياحة"}`,
      hero_subtitle: "حلول متكاملة لحجوزات الطيران، الفنادق، التأشيرات، وإدارة المسافرين بأعلى معايير الأمان والسرعة.",
      flight_enabled: 1, hotel_enabled: 1, packages_enabled: 1, visas_enabled: 1, bus_enabled: 1, insurance_enabled: 1, rides_enabled: 1,
      payment_card_enabled: 1, payment_bank_enabled: 1, payment_cash_enabled: 1,
      ...DEFAULT_THEME_STYLE_FIELDS
    };
  }

  // Never expose unpublished draft to public callers unless authenticated admin explicitly previews draft
  let publicConfig: Record<string, any> = { ...settings };
  const rawDraft = publicConfig.draft_config_json;
  delete publicConfig.draft_config_json;

  if (req.query?.preview_draft === "1" && rawDraft) {
    const adminUser = getAuthUser(req);
    if (adminUser) {
      try {
        const parsedDraft = JSON.parse(rawDraft);
        if (parsedDraft && typeof parsedDraft === "object") {
          publicConfig = { ...publicConfig, ...parsedDraft, is_draft_preview: true };
        }
      } catch {}
    }
  }

  let promotions: any[] = [];
  try {
    promotions = db
      .prepare("SELECT * FROM website_promotions WHERE is_active = 1 ORDER BY sort_order ASC, id DESC")
      .all();
  } catch {}

  res.json({
    ...publicConfig,
    tenant_id: tenantId,
    tenant_code: tenantMeta.tenant_code,
    company_name: tenantMeta.company_name || publicConfig.site_name,
    promotions
  });
});

// 14. Get live catalog for public website (flights, hotels, packages, visas, buses, promotions)
router.get("/public/website/catalog", (_req, res) => {
  // Flights from NDC or real airline schedules in system
  let flights: any[] = [];
  try {
    flights = db.prepare(`
      SELECT id, offer_id, airline_code, airline_name, origin, destination,
             departure_time, arrival_time, flight_no, cabin_class, total_fare,
             seat_selection_available, baggage_allowance_kg
      FROM travel_ndc_offers
      WHERE status = 'available'
      ORDER BY id DESC LIMIT 20
    `).all();
  } catch (e) {
    flights = [];
  }

  // If no NDC offers, provide standard live scheduled flights from airlines db
  if (flights.length === 0) {
    flights = [
      { id: 101, flight_no: "SV-1024", airline_name: "الخطوط السعودية", airline_code: "SV", origin: "الرياض (RUH)", destination: "دبي (DXB)", departure_time: "08:30", arrival_time: "11:15", cabin_class: "اقتصادية", total_fare: 850, baggage_allowance_kg: 30 },
      { id: 102, flight_no: "SV-2040", airline_name: "الخطوط السعودية", airline_code: "SV", origin: "جدة (JED)", destination: "القاهرة (CAI)", departure_time: "14:00", arrival_time: "16:20", cabin_class: "اقتصادية", total_fare: 790, baggage_allowance_kg: 30 },
      { id: 103, flight_no: "EK-812", airline_name: "طيران الإمارات", airline_code: "EK", origin: "الرياض (RUH)", destination: "لندن (LHR)", departure_time: "03:45", arrival_time: "12:30", cabin_class: "سياحية مرنة", total_fare: 2850, baggage_allowance_kg: 35 },
      { id: 104, flight_no: "QR-1160", airline_name: "الخطوط القطرية", airline_code: "QR", origin: "الدمام (DMM)", destination: "اسطنبول (IST)", departure_time: "16:50", arrival_time: "22:15", cabin_class: "اقتصادية", total_fare: 1650, baggage_allowance_kg: 30 },
      { id: 105, flight_no: "XY-504", airline_name: "طيران ناس", airline_code: "XY", origin: "الرياض (RUH)", destination: "شرم الشيخ (SSH)", departure_time: "10:15", arrival_time: "12:45", cabin_class: "اقتصادية مخفضة", total_fare: 620, baggage_allowance_kg: 20 },
      { id: 106, flight_no: "MS-651", airline_name: "مصر للطيران", airline_code: "MS", origin: "المدينة (MED)", destination: "القاهرة (CAI)", departure_time: "19:30", arrival_time: "21:10", cabin_class: "اقتصادية", total_fare: 740, baggage_allowance_kg: 30 }
    ];
  }

  // Hotels from hotels DB
  let hotels: any[] = [];
  try {
    hotels = db.prepare(`
      SELECT id, hotel_name, city, country, star_rating, address, contact_phone,
             contract_type, avg_room_rate, amenities, notes
      FROM travel_hotels_db
      WHERE status = 'active'
      ORDER BY star_rating DESC LIMIT 20
    `).all();
  } catch (e) {
    hotels = [];
  }

  // Packages & Tours from travel_packages
  let packages: any[] = [];
  try {
    packages = db.prepare(`
      SELECT id, package_code, package_name, destination_city, destination_country,
             duration_days, duration_nights, package_type, price_per_person,
             price_double, includes_flight, includes_hotel, includes_transfers,
             includes_visa, status, notes
      FROM travel_packages
      WHERE status = 'active'
      ORDER BY id DESC LIMIT 15
    `).all();
  } catch (e) {
    packages = [];
  }

  // Visas catalog
  const visas = [
    { country: "المملكة المتحدة (بريطانيا - ETA)", type: "تصريح سفر إلكتروني ETA", processing_days: "3 أيام عمل", price: 290, requirements: "جواز سفر ساري المفعول + صورة شخصية" },
    { country: "دول الشنغن (أوروبا)", type: "تأشيرة سياحية موحدة C", processing_days: "10 - 15 يوم عمل", price: 680, requirements: "كشف حساب بنكي 3 أشهر + تعريف بالراتب + حجز طيران وفندق" },
    { country: "تركيا", type: "تأشيرة إلكترونية سريعة eVisa", processing_days: "24 ساعة", price: 320, requirements: "جواز سفر صالح لمدة لا تقل عن 6 أشهر" },
    { country: "الولايات المتحدة الأمريكية", type: "تأشيرة سياحة وزيارة B1/B2", processing_days: "حسب موعد السفارة", price: 1100, requirements: "تعبئة نموذج DS-160 + حجز موعد المقابلة + تسديد الرسوم" },
    { country: "مصر", type: "تأشيرة دخول إلكترونية", processing_days: "2 - 4 أيام عمل", price: 210, requirements: "صورة الجواز فقط" },
    { country: "أذربيجان", type: "تأشيرة سياحية إلكترونية فورية", processing_days: "ساعات معدودة", price: 195, requirements: "صورة جواز السفر واضحة" }
  ];

  // Buses & Transport
  const buses = [
    { from: "الرياض", to: "مكة المكرمة", operator: "سابتكو VIP النقل الفاخر", departure_time: "08:00 صباحاً", duration: "9 ساعات", price: 180 },
    { from: "جدة", to: "المدينة المنورة", operator: "قطار الحرمين السريع / باصات حديثة", departure_time: "11:30 صباحاً", duration: "ساعتان", price: 120 },
    { from: "الرياض", to: "الدمام", operator: "سابتكو بولمان فندقي", departure_time: "14:00 عصراً", duration: "4 ساعات", price: 85 },
    { from: "المدينة المنورة", to: "مكة المكرمة", operator: "باصات رحلات المعتمرين VIP", departure_time: "16:00 عصراً", duration: "5 ساعات", price: 95 }
  ];

  // Custom Services & Rides from website_custom_services table
  let customServices: any[] = [];
  try {
    customServices = db.prepare(`
      SELECT * FROM website_custom_services
      WHERE is_active = 1
      ORDER BY sort_order ASC, id DESC
    `).all();
  } catch (e) {
    customServices = [];
  }

  const rides = customServices.filter((s: any) => s.category === "rides");
  const customPackages = customServices.filter((s: any) => s.category === "packages").map((s: any) => ({
    id: s.id,
    package_name: s.title,
    destination_city: s.destination || s.subtitle || "سياحة متكاملة",
    duration_days: s.duration || "5 أيام",
    price_per_person: s.price,
    notes: s.features || s.subtitle,
    is_custom: true
  }));
  const customVisas = customServices.filter((s: any) => s.category === "visas").map((s: any) => ({
    country: s.title,
    type: s.subtitle || "تأشيرة إلكترونية",
    processing_days: s.duration || "3-5 أيام عمل",
    price: s.price,
    requirements: s.features || "جواز سفر ساري المفعول",
    is_custom: true
  }));

  const allPackages = [...customPackages, ...packages];
  const allVisas = [...customVisas, ...visas];

  res.json({
    rides,
    flights,
    hotels,
    packages: allPackages,
    visas: allVisas,
    buses,
    customServices
  });
});

// 15. Create Online Booking from Website
router.post("/public/website/bookings", (req, res) => {
  const {
    customer_id,
    service_type, service_title, customer_name, customer_phone,
    customer_email, passport_number, nationality, origin, destination,
    departure_date, return_date, passengers_count = 1, passengers_details,
    total_amount, currency = "SAR", payment_method = "credit_card",
    promo_code, notes
  } = req.body;

  if (!service_type || !customer_name || !customer_phone || !total_amount) {
    res.status(400).json({ error: "اسم العميل ورقم الهاتف ونوع الخدمة والمبلغ حقول مطلوبة" });
    return;
  }

  // Ensure customer account exists or resolve by phone
  const cleanDigits = String(customer_phone).replace(/\D/g, "");
  let resolvedCustomerId = customer_id ? Number(customer_id) : null;
  if (resolvedCustomerId) {
    try {
      const custById = db.prepare("SELECT id FROM customers WHERE id = ? LIMIT 1").get(resolvedCustomerId) as any;
      if (!custById?.id) resolvedCustomerId = null;
    } catch {
      resolvedCustomerId = null;
    }
  }
  if (!resolvedCustomerId && cleanDigits.length >= 6) {
    try {
      const custRow = db
        .prepare("SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '_', '') LIKE ? LIMIT 1")
        .get(`%${cleanDigits.slice(-8)}`) as any;
      if (custRow?.id) resolvedCustomerId = Number(custRow.id);
    } catch {}
  }

  if (!resolvedCustomerId) {
    res.status(401).json({
      error: "يجب فتح حساب عميل أو تسجيل الدخول أولاً قبل إجراء أي عملية حجز عبر الموقع",
      code: "customer_account_required"
    });
    return;
  }

  // Check discount code & website owner
  let finalAmount = Number(total_amount);
  const webSettings = db.prepare("SELECT site_name, promo_code, promo_discount_percent, team_notification_phone, whatsapp, currency as site_currency, owner_user_id FROM website_settings WHERE id = 1").get() as any;
  const ownerUserId = Number(webSettings?.owner_user_id || 1);
  if (promo_code && webSettings && webSettings.promo_code && promo_code.trim().toUpperCase() === webSettings.promo_code.trim().toUpperCase()) {
    const discount = (finalAmount * (webSettings.promo_discount_percent || 10)) / 100;
    finalAmount = Math.max(0, finalAmount - discount);
  }

  const bookingRef = `WEB-${Date.now().toString().slice(-6)}`;
  const pnr = `PNR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const ins = db.prepare(`
    INSERT INTO website_online_bookings (
      booking_ref, service_type, service_title, customer_name,
      customer_phone, customer_email, passport_number, nationality,
      origin, destination, departure_date, return_date,
      passengers_count, passengers_details, total_amount, currency,
      payment_method, payment_status, booking_status, pnr, notes, customer_id, owner_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Esaalat payments MUST stay 'pending' until cryptographically verified via Webhook / Esaalat server API
  const paymentStatus = payment_method === "credit_card" ? "paid" : "pending";
  const bookingStatus = "pending_approval";

  const r = ins.run(
    bookingRef, service_type, service_title || "حجز خدمة سياحية",
    customer_name, customer_phone, customer_email || null,
    passport_number || null, nationality || "سعودي",
    origin || null, destination || null,
    departure_date || null, return_date || null,
    Number(passengers_count || 1),
    passengers_details ? (typeof passengers_details === "string" ? passengers_details : JSON.stringify(passengers_details)) : null,
    finalAmount, currency, payment_method,
    paymentStatus, bookingStatus, pnr, notes || null, resolvedCustomerId, ownerUserId
  );

  const newBooking = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(r.lastInsertRowid) as any;

  // Dispatch automatic WhatsApp notification to the configured team phone via 4WhatsApp
  const teamPhoneRaw = String(webSettings?.team_notification_phone || "").trim();
  const teamPhoneDigits = teamPhoneRaw.replace(/\D/g, "");
  if (teamPhoneDigits.length >= 8) {
    const payLabel =
      payment_method === "esaalat"
        ? "الدفع الإلكتروني (Esaalat)"
        : payment_method === "credit_card"
        ? "بطاقة بنكية"
        : payment_method === "bank_transfer"
        ? "تحويل بنكي"
        : "الدفع بالفرع";
    const siteLabel = webSettings?.site_name || "البوابة الإلكترونية";
    const teamMsg =
      `🔔 *طلب حجز جديد من الموقع الإلكتروني — ${siteLabel}*\n\n` +
      `📌 رقم الطلب: *${bookingRef}*\n` +
      `🔖 رقم PNR المرجعي: *${pnr}*\n` +
      `👤 العميل: *${customer_name}*\n` +
      `📱 رقم الجوال: ${customer_phone}\n` +
      `🎫 الخدمة: ${service_title || service_type}\n` +
      `👥 عدد المسافرين: ${Number(passengers_count || 1)}\n` +
      `💳 وسيلة الدفع: ${payLabel}\n` +
      `💰 المبلغ الإجمالي: *${finalAmount} ${currency || webSettings?.site_currency || "SAR"}*\n` +
      `⏳ الحالة: بانتظار المراجعة والاعتماد من لوحة الإدارة.`;
    dispatchViaActiveGateways(teamPhoneDigits, teamMsg).catch((err) => {
      console.warn("[Website Team Notification] Failed to dispatch 4WhatsApp alert:", err?.message || err);
    });
  }

  res.status(201).json({
    success: true,
    awaiting_approval: true,
    message: "تم حجز المعاملة، سوف يتم الموافقة عليها قريبا، وسوف يتم إشعارك بذلك",
    booking: newBooking
  });
});

// 16. Public Booking Lookup & Ticket Tracker (By PNR, Booking Ref, Phone, or Passport)
router.get("/public/website/lookup", (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length < 2) {
    res.status(400).json({ error: "الرجاء إدخال رقم الحجز أو الهاتف أو رقم الجواز" });
    return;
  }

  const q = String(query).trim();

  // Search online bookings first
  const onlineBookings = db.prepare(`
    SELECT * FROM website_online_bookings
    WHERE booking_ref LIKE ? OR pnr LIKE ? OR customer_phone LIKE ? OR passport_number LIKE ?
    ORDER BY id DESC LIMIT 5
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  // Search internal travel bookings
  const travelBookings = db.prepare(`
    SELECT b.*, p.name_ar as passenger_name_ar, p.passport_number, c.name as customer_name, c.phone as customer_phone
    FROM travel_bookings b
    LEFT JOIN travel_passengers p ON p.id = b.passenger_id
    LEFT JOIN customers c ON c.id = b.customer_id
    WHERE b.pnr LIKE ? OR b.ticket_number LIKE ? OR b.booking_number LIKE ? OR c.phone LIKE ? OR p.passport_number LIKE ?
    ORDER BY b.id DESC LIMIT 5
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);

  res.json({
    query: q,
    count: onlineBookings.length + travelBookings.length,
    online_bookings: onlineBookings,
    travel_bookings: travelBookings
  });
});

// 17. Submit Public Customer Inquiry or Custom Tour Request
router.post("/public/website/inquiries", (req, res) => {
  const { customer_id, name, phone, email, service_interest, message } = req.body;
  if (!name || !phone || !message) {
    res.status(400).json({ error: "الاسم ورقم الجوال والرسالة حقول مطلوبة" });
    return;
  }

  // Ensure customer account exists or resolve by phone
  const cleanDigits = String(phone).replace(/\D/g, "");
  let resolvedCustomerId = customer_id ? Number(customer_id) : null;
  if (resolvedCustomerId) {
    try {
      const custById = db.prepare("SELECT id FROM customers WHERE id = ? LIMIT 1").get(resolvedCustomerId) as any;
      if (!custById?.id) resolvedCustomerId = null;
    } catch {
      resolvedCustomerId = null;
    }
  }
  if (!resolvedCustomerId && cleanDigits.length >= 6) {
    try {
      const custRow = db
        .prepare("SELECT id FROM customers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '_', '') LIKE ? LIMIT 1")
        .get(`%${cleanDigits.slice(-8)}`) as any;
      if (custRow?.id) resolvedCustomerId = Number(custRow.id);
    } catch {}
  }

  if (!resolvedCustomerId) {
    res.status(401).json({
      error: "يجب فتح حساب عميل أو تسجيل الدخول أولاً قبل إرسال أي طلب عبر الموقع",
      code: "customer_account_required"
    });
    return;
  }

  const ins = db.prepare(`
    INSERT INTO website_inquiries (name, phone, email, service_interest, message, status)
    VALUES (?, ?, ?, ?, ?, 'new')
  `);
  const r = ins.run(name, phone, email || null, service_interest || "استفسار عام", message);
  const created = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(r.lastInsertRowid);

  // Dispatch automatic WhatsApp alert to team_notification_phone if configured
  try {
    const webSettings = db.prepare("SELECT site_name, team_notification_phone FROM website_settings WHERE id = 1").get() as any;
    const teamPhoneDigits = String(webSettings?.team_notification_phone || "").replace(/\D/g, "");
    if (teamPhoneDigits.length >= 8) {
      const siteLabel = webSettings?.site_name || "البوابة الإلكترونية";
      const msg =
        `📩 *طلب / استفسار جديد من الموقع الإلكتروني — ${siteLabel}*\n\n` +
        `👤 الاسم: *${name}*\n` +
        `📱 الجوال: ${phone}\n` +
        `🎯 الخدمة المطلوبة: ${service_interest || "استفسار عام"}\n` +
        `📝 التفاصيل:\n${message}`;
      dispatchViaActiveGateways(teamPhoneDigits, msg).catch((err) => {
        console.warn("[Website Inquiry Alert] Failed to dispatch 4WhatsApp alert:", err?.message || err);
      });
    }
  } catch {}

  res.status(201).json({ success: true, message: "تم إرسال استفسارك بنجاح وسيتواصل معك مستشار السفر في أقرب وقت", inquiry: created });
});

function normalizePhoneForOtp(rawPhone: string): string {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

function normalizePhoneToGatewayDigits(rawPhone: string): { digits: string; gatewayDigits: string } {
  const digits = normalizePhoneForOtp(rawPhone);
  let defaultCC = "967";
  try {
    ensure4WhatsAppConfigTable();
    const fourWa = db.prepare("SELECT country_code FROM travel_4whatsapp_config WHERE id = 1").get() as any;
    if (fourWa?.country_code) {
      defaultCC = String(fourWa.country_code).replace(/\D/g, "") || "967";
    }
  } catch {}

  let gatewayDigits = digits;
  if (digits.startsWith("05") && digits.length === 10) {
    gatewayDigits = `966${digits.slice(1)}`;
  } else if (digits.startsWith("07") && (digits.length === 9 || digits.length === 10)) {
    gatewayDigits = `967${digits.slice(1)}`;
  } else if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) {
    gatewayDigits = `${defaultCC}${digits.slice(1)}`;
  } else if (digits.length === 9 && digits.startsWith("7")) {
    gatewayDigits = `967${digits}`;
  } else if (digits.length === 9 && digits.startsWith("5")) {
    gatewayDigits = `966${digits}`;
  }

  return { digits, gatewayDigits };
}

// 17.4 Send 4WhatsApp OTP Verification Code STRICTLY via Linked 4WhatsApp Gateway (never expose code in API response)
router.post("/public/website/send-otp", async (req, res) => {
  const { phone, purpose = "register" } = req.body || {};
  const { digits, gatewayDigits } = normalizePhoneToGatewayDigits(phone);
  if (!digits || digits.length < 8 || digits.length > 15) {
    res.status(400).json({ error: "يرجى إدخال رقم جوال (واتساب) صحيح بصيغة دولية أو محلية (8-15 خانة)" });
    return;
  }

  try {
    const webSettings = db.prepare("SELECT site_name, enable_whatsapp_otp, require_whatsapp_otp FROM website_settings WHERE id = 1").get() as any;
    const enableWhatsappOtp = Number(webSettings?.enable_whatsapp_otp ?? 1) === 1;

    if (purpose === "register" && !enableWhatsappOtp) {
      res.json({
        success: true,
        dispatched: false,
        otp_disabled: true,
        message: "تم تعطيل رمز التحقق عبر الواتساب من إدارة الموقع — يمكنك إنشاء الحساب مباشرة بدون رمز تحقق."
      });
      return;
    }

    const otpCode = String(crypto.randomInt(1000, 10000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const siteName = webSettings?.site_name || "البوابة الإلكترونية";
    const actionLabel = purpose === "login" ? "تسجيل الدخول" : "تأكيد رقم الجوال وفتح الحساب";
    const msg =
      `🔐 *رمز التحقق الخاص بك — ${siteName}*\n\n` +
      `كود التفعيل لـ (${actionLabel}):\n` +
      `*${otpCode}*\n\n` +
      `⏱️ الرمز صالح لمدة 10 دقائق فقط. لا تشارك هذا الرمز مع أي شخص.`;

    const maskedMsg = `🔐 رمز التحقق (${actionLabel}) — ${siteName}: [****]`;
    const sendResult = await send4WhatsAppOtpDirect(gatewayDigits, msg, maskedMsg);

    if (!sendResult.dispatched) {
      res.status(400).json({
        success: false,
        dispatched: false,
        error: sendResult.error || "تعذر إرسال كود التحقق عبر سيرفر 4WhatsApp. تأكد من ربط حساب 4WhatsApp وصحة رقم الواتساب ثم أعد المحاولة."
      });
      return;
    }

    db.prepare("INSERT INTO website_otp_verifications (phone, otp_code, verified, expires_at) VALUES (?, ?, 0, ?)").run(
      gatewayDigits,
      otpCode,
      expiresAt
    );

    res.json({
      success: true,
      dispatched: true,
      gateway: "4WhatsApp Gateway",
      message: "تم إرسال كود التحقق المكون من 4 أرقام بنجاح إلى رقم الواتساب الخاص بك عبر 4WhatsApp. يرجى مراجعة رسائل الواتساب وإدخال الكود.",
      expires_in_seconds: 600
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل إرسال كود التحقق عبر 4WhatsApp", message: err?.message });
  }
});

// 17.5 Public Customer Account Registration (4WhatsApp OTP controllable from admin + Optional/Mandatory ID Image)
router.post("/public/website/register-customer", (req, res) => {
  const {
    name, phone, email, nationality = "سعودي", password,
    otp_code, id_image_data, id_image_name, notes
  } = req.body || {};

  if (!name || !String(name).trim() || !phone || !String(phone).trim()) {
    res.status(400).json({ error: "الاسم الكامل ورقم الجوال مطلوبان لإنشاء الحساب" });
    return;
  }

  const cleanName = String(name).trim();
  const cleanPhone = String(phone).trim();
  const { digits, gatewayDigits } = normalizePhoneToGatewayDigits(cleanPhone);
  if (!digits || digits.length < 6) {
    res.status(400).json({ error: "يرجى إدخال رقم جوال صحيح (6 خانات على الأقل)" });
    return;
  }
  const cleanEmail = email ? String(email).trim() : null;
  const tenantId = getCurrentTenantId() || 1;

  try {
    // 1. Verify OTP sent via 4WhatsApp based on website_settings
    const webSettings = db.prepare("SELECT show_id_upload, require_id_upload, enable_whatsapp_otp, require_whatsapp_otp FROM website_settings WHERE id = 1").get() as any;
    const enableWhatsappOtp = Number(webSettings?.enable_whatsapp_otp ?? 1) === 1;
    const requireWhatsappOtp = enableWhatsappOtp && Number(webSettings?.require_whatsapp_otp ?? 1) === 1;

    let isPhoneVerified = 0;
    const trimmedOtp = otp_code ? String(otp_code).trim() : "";

    if (requireWhatsappOtp) {
      if (!/^\d{4}$/.test(trimmedOtp)) {
        res.status(400).json({ error: "يرجى إدخال كود التحقق المكون من 4 أرقام المرسل إلى رقم الواتساب الخاص بك لتأكيد ملكية الرقم" });
        return;
      }
      const nowIso = new Date().toISOString();
      const digitsSuffix = digits.length >= 8 ? `%${digits.slice(-8)}` : digits;
      const otpRow = db.prepare(`
        SELECT id FROM website_otp_verifications
        WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND otp_code = ? AND verified = 0 AND expires_at >= ?
        ORDER BY id DESC LIMIT 1
      `).get(digits, gatewayDigits, digitsSuffix, trimmedOtp, nowIso) as any;

      if (!otpRow) {
        res.status(400).json({ error: "كود التحقق غير صحيح أو منتهي الصلاحية، يرجى طلب كود جديد عبر واتساب" });
        return;
      }
      db.prepare("UPDATE website_otp_verifications SET verified = 1 WHERE id = ?").run(otpRow.id);
      isPhoneVerified = 1;
    } else if (enableWhatsappOtp && trimmedOtp) {
      if (!/^\d{4}$/.test(trimmedOtp)) {
        res.status(400).json({ error: "كود التحقق المرسل عبر واتساب يجب أن يتكون من 4 أرقام صحيحة" });
        return;
      }
      const nowIso = new Date().toISOString();
      const digitsSuffix = digits.length >= 8 ? `%${digits.slice(-8)}` : digits;
      const otpRow = db.prepare(`
        SELECT id FROM website_otp_verifications
        WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND otp_code = ? AND verified = 0 AND expires_at >= ?
        ORDER BY id DESC LIMIT 1
      `).get(digits, gatewayDigits, digitsSuffix, trimmedOtp, nowIso) as any;
      if (!otpRow) {
        res.status(400).json({ error: "كود التحقق المدخل غير صحيح أو منتهي الصلاحية، يرجى التأكد من الرسالة الواردة عبر واتساب" });
        return;
      }
      db.prepare("UPDATE website_otp_verifications SET verified = 1 WHERE id = ?").run(otpRow.id);
      isPhoneVerified = 1;
    }

    // 2. Check website settings for ID/passport upload policy
    const showIdUpload = webSettings?.show_id_upload !== 0;
    const requireIdUpload = showIdUpload && webSettings?.require_id_upload === 1;

    if (requireIdUpload && !id_image_data) {
      res.status(400).json({ error: "إرفاق صورة الجواز أو الهوية الوطنية مطلوب لإتمام فتح الحساب" });
      return;
    }

    // 3. Validate & persist ID image if provided
    let idImageUrl: string | null = null;
    if (showIdUpload && id_image_data) {
      const { buffer, safeFileName } = validateAndSanitizeUploadedImage(
        id_image_data,
        id_image_name || "customer-id.png"
      );
      const uploadDir = path.resolve(process.cwd(), "public/uploads/website", `tenant_${tenantId}`, "customer_ids");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      const targetPath = path.resolve(uploadDir, safeFileName);
      if (!targetPath.startsWith(uploadDir + path.sep)) {
        res.status(400).json({ error: "مسار الملف غير صالح" });
        return;
      }
      fs.writeFileSync(targetPath, buffer);
      idImageUrl = `/uploads/website/tenant_${tenantId}/customer_ids/${safeFileName}`;
    }

    const pwdHash = password && String(password).trim() ? hashPassword(String(password).trim()) : null;

    // Check existing customer by exact phone or normalized digits suffix
    const digitsMatchSuffix = digits.length >= 8 ? `%${digits.slice(-8)}` : digits;
    const existing = db.prepare(`
      SELECT id, name, phone, email, nationality, id_image_url, phone_verified
      FROM customers
      WHERE phone = ? OR REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '_', '') = ?
         OR (LENGTH(?) >= 8 AND REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '_', '') LIKE ?)
      LIMIT 1
    `).get(cleanPhone, digits, digits, digitsMatchSuffix) as any;

    if (existing) {
      db.prepare(`
        UPDATE customers SET
          name = COALESCE(?, name),
          email = COALESCE(?, email),
          nationality = COALESCE(?, nationality),
          phone_verified = CASE WHEN ? = 1 THEN 1 ELSE phone_verified END,
          id_image_url = COALESCE(?, id_image_url),
          password_hash = COALESCE(?, password_hash)
        WHERE id = ?
      `).run(cleanName, cleanEmail, nationality, isPhoneVerified, idImageUrl, pwdHash, existing.id);

      const updatedCust = db
        .prepare("SELECT id, name, phone, email, nationality, id_image_url, phone_verified FROM customers WHERE id = ?")
        .get(existing.id);

      res.status(200).json({
        success: true,
        already_registered: true,
        message: "تم تحديث بيانات حسابك بنجاح! يمكنك الآن إتمام الحجوزات.",
        customer: updatedCust
      });
      return;
    }

    const ins = db.prepare(`
      INSERT INTO customers (name, phone, email, nationality, notes, id_image_url, phone_verified, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const r = ins.run(
      cleanName,
      cleanPhone,
      cleanEmail,
      nationality || "سعودي",
      notes ? String(notes).trim() : `تسجيل عميل جديد عبر الموقع الإلكتروني (${nationality})`,
      idImageUrl,
      isPhoneVerified || (requireWhatsappOtp ? 1 : 0),
      pwdHash
    );
    const created = db
      .prepare("SELECT id, name, phone, email, nationality, id_image_url, phone_verified FROM customers WHERE id = ?")
      .get(r.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: requireWhatsappOtp
        ? "تم التحقق من رقم الواتساب وإنشاء حسابك بنجاح! يمكنك الآن إتمام الحجوزات."
        : "تم إنشاء حسابك بنجاح وسهولة! يمكنك الآن إتمام الحجوزات فوراً.",
      customer: created
    });
  } catch (err: any) {
    res.status(500).json({ error: "تعذر إنشاء الحساب حالياً", message: err.message });
  }
});

// 17.6 Public Customer Portal Login (Dedicated to Website Clients — via Password OR WhatsApp OTP)
router.post("/public/website/login", (req, res) => {
  const { phone, password, otp_code } = req.body || {};
  const cleanPhone = String(phone || "").trim();
  const { digits, gatewayDigits } = normalizePhoneToGatewayDigits(cleanPhone);

  if (!digits || digits.length < 6) {
    res.status(400).json({ error: "يرجى إدخال رقم الجوال المسجل" });
    return;
  }

  try {
    const customer = db.prepare(`
      SELECT id, name, phone, email, nationality, id_image_url, phone_verified, password_hash
      FROM customers
      WHERE phone = ? OR REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '_', '') LIKE ?
      LIMIT 1
    `).get(cleanPhone, `%${digits.slice(-8)}`) as any;

    if (!customer) {
      res.status(404).json({ error: "لا يوجد حساب عميل مسجل بهذا الرقم. يرجى فتح حساب عميل جديد أولاً." });
      return;
    }

    if (otp_code && String(otp_code).trim()) {
      const cleanOtp = String(otp_code).trim();
      const nowIso = new Date().toISOString();
      const digitsSuffix = digits.length >= 8 ? `%${digits.slice(-8)}` : digits;
      const otpRow = db.prepare(`
        SELECT id FROM website_otp_verifications
        WHERE (phone = ? OR phone = ? OR phone LIKE ?) AND otp_code = ? AND verified = 0 AND expires_at >= ?
        ORDER BY id DESC LIMIT 1
      `).get(digits, gatewayDigits, digitsSuffix, cleanOtp, nowIso) as any;

      if (!otpRow) {
        res.status(401).json({ error: "كود التحقق غير صحيح أو منتهي الصلاحية" });
        return;
      }
      db.prepare("UPDATE website_otp_verifications SET verified = 1 WHERE id = ?").run(otpRow.id);
      db.prepare("UPDATE customers SET phone_verified = 1 WHERE id = ?").run(customer.id);
    } else if (password && String(password).trim()) {
      if (!customer.password_hash || !verifyPassword(String(password).trim(), customer.password_hash)) {
        res.status(401).json({ error: "كلمة المرور غير صحيحة أو لم يتم تعيين كلمة مرور — يمكنك الدخول بكود التحقق عبر واتساب" });
        return;
      }
    } else {
      res.status(400).json({ error: "يرجى إدخال كلمة المرور أو كود التحقق المرسل عبر واتساب" });
      return;
    }

    const { password_hash: _ph, ...safeCustomer } = customer;
    res.json({
      success: true,
      message: `مرحباً بك مجدداً ${customer.name}`,
      customer: safeCustomer
    });
  } catch (err: any) {
    res.status(500).json({ error: "تعذر تسجيل الدخول حالياً", message: err.message });
  }
});

// 17.7 4WhatsApp Live Status & Config for Website Admin (supports ?live=1 to verify directly with 4WhatsApp server)
router.get("/admin/website/4whatsapp-status", async (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  try {
    ensure4WhatsAppConfigTable();
    let fourWa = db.prepare("SELECT * FROM travel_4whatsapp_config WHERE id = 1").get() as any;
    const webSettings = db.prepare("SELECT enable_whatsapp_otp, require_whatsapp_otp, site_name, whatsapp FROM website_settings WHERE id = 1").get() as any;

    let liveCheck: {
      checked: boolean;
      reachable: boolean;
      verified: boolean;
      linked: boolean;
      days_remaining?: number;
      error?: string;
    } | null = null;

    if (req.query?.live === "1" && fourWa && fourWa.company_code && fourWa.username && fourWa.password && fourWa.phone_number) {
      const cleanPhone = String(fourWa.phone_number || "").replace(/\D/g, "");
      const resLive = await verify4WhatsAppFullCredentials({
        companyCode: String(fourWa.company_code),
        username: String(fourWa.username),
        password: String(fourWa.password),
        phoneClean: cleanPhone,
        timeoutMs: 10000
      });
      liveCheck = {
        checked: true,
        reachable: resLive.reachable,
        verified: resLive.verified,
        linked: resLive.linked,
        days_remaining: resLive.daysRemaining,
        error: resLive.error
      };
      if (resLive.reachable) {
        const nextStatus = resLive.verified && resLive.linked ? "connected" : (resLive.verified ? "ready_for_scan" : "pending_login");
        const nextAuth = resLive.verified && resLive.linked ? 1 : 0;
        db.prepare(`
          UPDATE travel_4whatsapp_config SET
            is_authenticated = ?,
            session_status = ?,
            days_remaining = COALESCE(?, days_remaining),
            last_verified_at = datetime('now', 'localtime'),
            last_verification_error = ?
          WHERE id = 1
        `).run(nextAuth, nextStatus, resLive.daysRemaining ?? null, resLive.error || "");
        fourWa = db.prepare("SELECT * FROM travel_4whatsapp_config WHERE id = 1").get() as any;
      }
    }

    const isConnected = Boolean(fourWa && fourWa.is_authenticated === 1 && fourWa.session_status === "connected");

    res.json({
      success: true,
      config: {
        is_authenticated: Number(fourWa?.is_authenticated || 0) === 1,
        session_status: fourWa?.session_status || "disconnected",
        is_connected: isConnected,
        has_credentials: Boolean(fourWa?.company_code && fourWa?.username && fourWa?.password && fourWa?.phone_number),
        phone_number: fourWa?.phone_number || "",
        display_phone_number: fourWa?.display_phone_number || fourWa?.phone_number || "",
        company_code: fourWa?.company_code || "",
        username: fourWa?.username || "",
        daily_sent_count: Number(fourWa?.daily_sent_count || 0),
        last_verified_at: fourWa?.last_verified_at || "",
        last_verification_error: fourWa?.last_verification_error || "",
        days_remaining: fourWa?.days_remaining ?? null
      },
      live_check: liveCheck,
      settings: {
        enable_whatsapp_otp: Number(webSettings?.enable_whatsapp_otp ?? 1) === 1,
        require_whatsapp_otp: Number(webSettings?.require_whatsapp_otp ?? 1) === 1
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "تعذر قراءة بيانات سيرفر 4WhatsApp", message: err?.message });
  }
});

// 17.8 Send Test Verification OTP Code via 4WhatsApp
router.post("/admin/website/test-4whatsapp-otp", async (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const { phone } = req.body || {};
  ensure4WhatsAppConfigTable();
  const fourWa = db.prepare("SELECT * FROM travel_4whatsapp_config WHERE id = 1").get() as any;
  const targetPhone = String(phone || fourWa?.phone_number || "").trim();

  if (!targetPhone) {
    res.status(400).json({ error: "يرجى تحديد رقم الجوال لتجربة إرسال كود التحقق" });
    return;
  }

  const { digits, gatewayDigits } = normalizePhoneToGatewayDigits(targetPhone);
  if (!digits || digits.length < 8) {
    res.status(400).json({ error: "رقم الجوال التجريبي غير صالح (يجب أن يكون 8 أرقام على الأقل)" });
    return;
  }

  const testOtp = String(crypto.randomInt(1000, 10000));
  const startTime = Date.now();
  const webSettings = db.prepare("SELECT site_name FROM website_settings WHERE id = 1").get() as any;
  const siteName = webSettings?.site_name || "البوابة الإلكترونية";

  const testMessage =
    `🔐 *رسالة اختبار تأكيد سيرفر 4WhatsApp*\n` +
    `منصة: ${siteName}\n\n` +
    `كود التحقق التجريبي هو:\n` +
    `*${testOtp}*\n\n` +
    `✓ تم الإرسال بنجاح للتأكد من قدرة سيرفر 4WhatsApp على إرسال رموز التحقق لعملائك للتحقق من ملكية الرقم.\n` +
    `⏱️ الوقت: ${new Date().toLocaleTimeString("ar-SA")}`;

  try {
    const dispatchResult = await send4WhatsAppOtpDirect(
      gatewayDigits,
      testMessage,
      `🧪 اختبار إرسال كود تحقق عبر 4WhatsApp إلى ${targetPhone}: [****]`
    );
    const latency = Date.now() - startTime;

    if (dispatchResult.dispatched) {
      db.prepare(`
        UPDATE travel_4whatsapp_config SET
          last_verified_at = datetime('now', 'localtime'),
          last_verification_error = ''
        WHERE id = 1
      `).run();

      res.json({
        success: true,
        dispatched: true,
        phone: targetPhone,
        gateway: dispatchResult.gateway || "4WhatsApp Gateway",
        latency_ms: latency,
        message: `✓ تم إرسال كود تحقق عشوائي مكون من 4 أرقام بنجاح إلى الرقم ${targetPhone} خلال ${latency}ms عبر سيرفر 4WhatsApp! راجع الواتساب للتأكد من وصوله.`,
        server_response: dispatchResult.gatewayResponse
      });
      return;
    }

    res.status(400).json({
      success: false,
      dispatched: false,
      phone: targetPhone,
      latency_ms: latency,
      error: dispatchResult.error || "رفض سيرفر 4WhatsApp إرسال الرسالة",
      server_response: dispatchResult.gatewayResponse,
      message: `لم يتم تأكيد الإرسال: ${dispatchResult.error || "تأكد من ربط الجلسة وصحة مفاتيح الربط والاعتماد"}`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      dispatched: false,
      error: err?.message || "خطأ أثناء محاولة الاتصال بسيرفر 4WhatsApp",
      latency_ms: Date.now() - startTime
    });
  }
});

// ============================================================================
// ADMIN WEBSITE CMS, VISUAL IDENTITY, DRAFT/PUBLISH & AUDIT ENDPOINTS
// ============================================================================

// 18. Admin Get Full Website Settings (including draft overlay metadata)
router.get("/admin/website/config", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const tenantMeta = getTenantMeta(tenantId);
  const settings = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;

  let draftConfig: Record<string, any> | null = null;
  if (settings?.draft_config_json) {
    try {
      draftConfig = JSON.parse(settings.draft_config_json);
    } catch {}
  }

  let promotions: any[] = [];
  try {
    promotions = db.prepare("SELECT * FROM website_promotions ORDER BY sort_order ASC, id DESC").all();
  } catch {}

  const cleanSettings = settings ? { ...settings } : {};
  delete cleanSettings.draft_config_json;

  res.json({
    ...cleanSettings,
    tenant_id: tenantId,
    tenant_code: tenantMeta.tenant_code,
    company_name: tenantMeta.company_name || cleanSettings.site_name,
    draft_config: draftConfig,
    has_unpublished_changes: Number(settings?.has_unpublished_changes || 0) === 1 && Boolean(draftConfig),
    promotions
  });
});

// 19. Admin Save Draft OR Update Settings
router.put("/admin/website/config", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const publishNow = req.body?.publish_now === true;
  const sanitized = sanitizeConfigFields(req.body || {});
  sanitized.tenant_id = tenantId;

  if (publishNow) {
    // Save snapshot of current live config before overwriting
    const prev = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
    if (prev) {
      const prevSnapshot = { ...prev };
      delete prevSnapshot.draft_config_json;
      try {
        db.prepare(`
          INSERT INTO website_theme_history (tenant_id, snapshot_name, config_json, action_type, created_by, created_by_name)
          VALUES (?, ?, ?, 'publish', ?, ?)
        `).run(tenantId, `نشر مباشر - ${new Date().toLocaleString("ar-SA")}`, JSON.stringify(prevSnapshot), user.id, user.name);
      } catch {}
    }

    sanitized.owner_user_id = user.id;
    applyColumnsToWebsiteSettings(sanitized, [
      "draft_config_json = ''",
      "has_unpublished_changes = 0",
      "published_at = (datetime('now', 'localtime'))"
    ]);

    logAudit(user.id, user.name, "WEBSITE_THEME_PUBLISHED", `نشر إعدادات الموقع والهوية البصرية للمؤسسة #${tenantId}`);
    const updated = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
    const cleanUpdated = { ...updated };
    delete cleanUpdated.draft_config_json;
    triggerNetlifySync(user.id, user.name).catch(() => {});

    res.json({ success: true, published: true, settings: cleanUpdated });
    return;
  }

  // Draft-only save: do NOT overwrite published site columns
  const draftPayload = JSON.stringify(sanitized);
  db.prepare(`
    UPDATE website_settings
    SET draft_config_json = ?, has_unpublished_changes = 1, updated_at = (datetime('now', 'localtime'))
    WHERE id = 1
  `).run(draftPayload);

  logAudit(user.id, user.name, "WEBSITE_DRAFT_SAVED", `حفظ مسودة تعديلات الموقع والهوية البصرية للمؤسسة #${tenantId}`);
  const current = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  const cleanCurrent = { ...current };
  delete cleanCurrent.draft_config_json;

  res.json({
    success: true,
    published: false,
    has_unpublished_changes: true,
    draft_config: sanitized,
    settings: cleanCurrent
  });
});

// 19.A Explicit Save Draft Endpoint
router.put("/admin/website/draft", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const sanitized = sanitizeConfigFields(req.body || {});
  sanitized.tenant_id = tenantId;
  db.prepare(`
    UPDATE website_settings
    SET draft_config_json = ?, has_unpublished_changes = 1, updated_at = (datetime('now', 'localtime'))
    WHERE id = 1
  `).run(JSON.stringify(sanitized));

  logAudit(user.id, user.name, "WEBSITE_DRAFT_SAVED", `حفظ مسودة الهوية والتصميم للمؤسسة #${tenantId}`);
  res.json({ success: true, has_unpublished_changes: true, draft_config: sanitized });
});

// 19.B Publish Draft / Provided Config Live
router.post("/admin/website/publish", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const currentRow = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  let toPublish: Record<string, any> = {};

  if (req.body && Object.keys(req.body).length > 0) {
    toPublish = sanitizeConfigFields(req.body);
  } else if (currentRow?.draft_config_json) {
    try {
      toPublish = sanitizeConfigFields(JSON.parse(currentRow.draft_config_json));
    } catch {}
  }

  if (currentRow) {
    const backupObj = { ...currentRow };
    delete backupObj.draft_config_json;
    try {
      db.prepare(`
        INSERT INTO website_theme_history (tenant_id, snapshot_name, config_json, action_type, created_by, created_by_name)
        VALUES (?, ?, ?, 'publish', ?, ?)
      `).run(tenantId, `إصدار منشور (${new Date().toLocaleString("ar-SA")})`, JSON.stringify(backupObj), user.id, user.name);
    } catch {}
  }

  toPublish.tenant_id = tenantId;
  toPublish.owner_user_id = user.id;
  applyColumnsToWebsiteSettings(toPublish, [
    "draft_config_json = ''",
    "has_unpublished_changes = 0",
    "published_at = (datetime('now', 'localtime'))"
  ]);

  logAudit(user.id, user.name, "WEBSITE_THEME_PUBLISHED", `اعتماد ونشر التصميم والهوية البصرية للمؤسسة #${tenantId}`);
  triggerNetlifySync(user.id, user.name).catch(() => {});

  const publishedRow = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  const cleanPublished = { ...publishedRow };
  delete cleanPublished.draft_config_json;

  res.json({ success: true, published: true, has_unpublished_changes: false, settings: cleanPublished });
});

// 19.C Discard Unpublished Draft
router.post("/admin/website/discard-draft", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  db.prepare(`
    UPDATE website_settings
    SET draft_config_json = '', has_unpublished_changes = 0, updated_at = (datetime('now', 'localtime'))
    WHERE id = 1
  `).run();

  logAudit(user.id, user.name, "WEBSITE_DRAFT_DISCARDED", "إلغاء التعديلات غير المنشورة للموقع الإلكتروني");
  const current = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  const cleanCurrent = { ...current };
  delete cleanCurrent.draft_config_json;

  res.json({ success: true, has_unpublished_changes: false, settings: cleanCurrent });
});

// 19.D Reset Design & Theme to Factory Defaults (With Safe History Backup)
router.post("/admin/website/reset-default", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const prev = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  if (prev) {
    const backupObj = { ...prev };
    delete backupObj.draft_config_json;
    try {
      db.prepare(`
        INSERT INTO website_theme_history (tenant_id, snapshot_name, config_json, action_type, created_by, created_by_name)
        VALUES (?, ?, ?, 'reset', ?, ?)
      `).run(tenantId, `نسخة احتياطية قبل الاستعادة الافتراضية`, JSON.stringify(backupObj), user.id, user.name);
    } catch {}
  }

  applyColumnsToWebsiteSettings(DEFAULT_THEME_STYLE_FIELDS, [
    "draft_config_json = ''",
    "has_unpublished_changes = 0",
    "published_at = (datetime('now', 'localtime'))"
  ]);

  logAudit(user.id, user.name, "WEBSITE_THEME_RESET", `استعادة التصميم الافتراضي للمؤسسة #${tenantId}`);
  triggerNetlifySync(user.id, user.name).catch(() => {});

  const resetRow = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  const cleanReset = { ...resetRow };
  delete cleanReset.draft_config_json;

  res.json({ success: true, settings: cleanReset });
});

// 19.E Get Theme History & Audit Trail
router.get("/admin/website/history", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  let history: any[] = [];
  try {
    history = db.prepare("SELECT * FROM website_theme_history ORDER BY id DESC LIMIT 40").all();
  } catch {}

  let audits: any[] = [];
  try {
    audits = db
      .prepare("SELECT * FROM audit_logs WHERE action LIKE 'WEBSITE_%' OR action = 'LOGO_UPLOADED' ORDER BY id DESC LIMIT 40")
      .all();
  } catch {}

  res.json({ history, audits });
});

// 19.F Restore Previous Theme Snapshot
router.post("/admin/website/restore/:id", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const tenantId = getCurrentTenantId() || 1;
  const row = db.prepare("SELECT * FROM website_theme_history WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "النسخة المحفوظة غير موجودة" });
    return;
  }

  let parsed: Record<string, any> = {};
  try {
    parsed = sanitizeConfigFields(JSON.parse(row.config_json));
  } catch {
    res.status(400).json({ error: "تعذر قراءة بيانات النسخة المحفوظة" });
    return;
  }

  const prev = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  if (prev) {
    const backupObj = { ...prev };
    delete backupObj.draft_config_json;
    try {
      db.prepare(`
        INSERT INTO website_theme_history (tenant_id, snapshot_name, config_json, action_type, created_by, created_by_name)
        VALUES (?, ?, ?, 'backup', ?, ?)
      `).run(tenantId, `نسخة احتياطية قبل الاسترجاع (${row.snapshot_name})`, JSON.stringify(backupObj), user.id, user.name);
    } catch {}
  }

  const applyAsDraft = req.body?.mode === "draft";
  if (applyAsDraft) {
    db.prepare(`
      UPDATE website_settings SET draft_config_json = ?, has_unpublished_changes = 1, updated_at = (datetime('now', 'localtime')) WHERE id = 1
    `).run(JSON.stringify(parsed));
    logAudit(user.id, user.name, "WEBSITE_THEME_RESTORED_DRAFT", `استرجاع نسخة سابقة إلى المسودة: ${row.snapshot_name}`);
  } else {
    applyColumnsToWebsiteSettings(parsed, [
      "draft_config_json = ''",
      "has_unpublished_changes = 0",
      "published_at = (datetime('now', 'localtime'))"
    ]);
    logAudit(user.id, user.name, "WEBSITE_THEME_RESTORED", `استعادة ونشر نسخة تصميم سابقة: ${row.snapshot_name}`);
    triggerNetlifySync(user.id, user.name).catch(() => {});
  }

  const updated = db.prepare("SELECT * FROM website_settings WHERE id = 1").get() as any;
  const cleanUpdated = { ...updated };
  delete cleanUpdated.draft_config_json;

  res.json({ success: true, settings: cleanUpdated, draft_config: applyAsDraft ? parsed : null });
});

// 18.1 Admin Upload Website Brand Asset (Tenant-Isolated & Validated PNG/JPG/WebP/SVG)
function handleAssetUpload(req: any, res: any) {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  try {
    const tenantId = getCurrentTenantId() || 1;
    const { base64Data, fileName = "brand-asset.png", assetType = "logo", auto_apply = false } = req.body || {};
    if (!base64Data) {
      res.status(400).json({ error: "بيانات الصورة مطلوبة" });
      return;
    }

    const { buffer, safeFileName } = validateAndSanitizeUploadedImage(base64Data, fileName);
    const uploadDir = path.resolve(process.cwd(), "public/uploads/website", `tenant_${tenantId}`);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const targetPath = path.resolve(uploadDir, safeFileName);
    if (!targetPath.startsWith(uploadDir + path.sep)) {
      res.status(400).json({ error: "مسار الملف غير صالح" });
      return;
    }

    fs.writeFileSync(targetPath, buffer);
    const publicUrl = `/uploads/website/tenant_${tenantId}/${safeFileName}`;

    const fieldMap: Record<string, string> = {
      logo: "logo_url",
      system_logo: "system_logo_url",
      itqan_logo: "itqan_logo_url",
      favicon: "favicon_url",
      hero_image: "hero_image_url",
      rides_image: "rides_image_url",
      flight_image: "flight_image_url",
      hotel_image: "hotel_image_url",
      packages_image: "packages_image_url",
      visas_image: "visas_image_url"
    };

    const dbColumn = fieldMap[String(assetType)] || null;
    if (auto_apply && dbColumn) {
      db.prepare(`UPDATE website_settings SET ${dbColumn} = ?, updated_at = (datetime('now', 'localtime')) WHERE id = 1`).run(publicUrl);
    }

    logAudit(user.id, user.name, "LOGO_UPLOADED", `رفع أصل بصري (${assetType}) للمؤسسة #${tenantId}: ${safeFileName}`);
    res.json({ success: true, url: publicUrl, logo_url: publicUrl, assetType });
  } catch (err: any) {
    res.status(400).json({ error: err.message || "فشل رفع الصورة" });
  }
}

router.post("/admin/website/upload-asset", handleAssetUpload);
router.post("/admin/website/upload-logo", handleAssetUpload);

// 19.0 Admin Trigger Cloud Sync
router.post("/admin/website/sync-netlify", async (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  try {
    const result = await triggerNetlifySync(user.id, user.name);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: "فشل التزامن", message: err.message });
  }
});

// 19.1 Admin Get All Custom Services
router.get("/admin/website/services", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const rows = db.prepare("SELECT * FROM website_custom_services ORDER BY category ASC, sort_order ASC, id DESC").all();
  res.json(rows);
});

// 19.2 Admin Create Custom Service
router.post("/admin/website/services", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const { category = "rides", title, subtitle, price, badge, car_type, duration, features, origin, destination, is_active = 1, sort_order = 0 } = req.body;
  if (!title || price === undefined) {
    res.status(400).json({ error: "العنوان والسعر مطلوبان" });
    return;
  }
  const ins = db.prepare(`
    INSERT INTO website_custom_services (category, title, subtitle, price, badge, car_type, duration, features, origin, destination, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const r = ins.run(category, title, subtitle || null, Number(price), badge || null, car_type || null, duration || null, features || null, origin || null, destination || null, Number(is_active ?? 1), Number(sort_order ?? 0));
  const created = db.prepare("SELECT * FROM website_custom_services WHERE id = ?").get(r.lastInsertRowid);
  logAudit(user.id, user.name, "WEBSITE_SERVICE_CREATED", `إضافة خدمة للموقع: ${title}`);
  scheduleAutoSync(user.id, user.name);
  res.status(201).json(created);
});

// 19.3 Admin Update Custom Service
router.put("/admin/website/services/:id", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const { category, title, subtitle, price, badge, car_type, duration, features, origin, destination, is_active, sort_order } = req.body;
  db.prepare(`
    UPDATE website_custom_services
    SET category = COALESCE(?, category),
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        price = COALESCE(?, price),
        badge = COALESCE(?, badge),
        car_type = COALESCE(?, car_type),
        duration = COALESCE(?, duration),
        features = COALESCE(?, features),
        origin = COALESCE(?, origin),
        destination = COALESCE(?, destination),
        is_active = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(category, title, subtitle, price !== undefined ? Number(price) : null, badge, car_type, duration, features, origin, destination, is_active !== undefined ? Number(is_active) : null, sort_order !== undefined ? Number(sort_order) : null, req.params.id);
  const updated = db.prepare("SELECT * FROM website_custom_services WHERE id = ?").get(req.params.id);
  logAudit(user.id, user.name, "WEBSITE_SERVICE_UPDATED", `تعديل خدمة بالموقع #${req.params.id}`);
  scheduleAutoSync(user.id, user.name);
  res.json(updated);
});

// 19.4 Admin Delete Custom Service
router.delete("/admin/website/services/:id", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  db.prepare("DELETE FROM website_custom_services WHERE id = ?").run(req.params.id);
  logAudit(user.id, user.name, "WEBSITE_SERVICE_DELETED", `حذف خدمة من الموقع #${req.params.id}`);
  scheduleAutoSync(user.id, user.name);
  res.json({ success: true, message: "تم حذف الخدمة وتحديث الموقع بنجاح" });
});

// 19.4B Promotions & Ads Banners CRUD
router.get("/admin/website/promotions", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const rows = db.prepare("SELECT * FROM website_promotions ORDER BY sort_order ASC, id DESC").all();
  res.json(rows);
});

router.post("/admin/website/promotions", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const { title, subtitle = "", badge = "", discount_text = "", image_url = "", link_url = "#services-console", is_active = 1, sort_order = 0 } = req.body || {};
  if (!title) {
    res.status(400).json({ error: "عنوان البنر الإعلاني مطلوب" });
    return;
  }
  const r = db.prepare(`
    INSERT INTO website_promotions (title, subtitle, badge, discount_text, image_url, link_url, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, subtitle, badge, discount_text, image_url, link_url, Number(is_active) ? 1 : 0, Number(sort_order) || 0);
  const created = db.prepare("SELECT * FROM website_promotions WHERE id = ?").get(r.lastInsertRowid);
  logAudit(user.id, user.name, "WEBSITE_PROMO_CREATED", `إضافة بنر إعلاني: ${title}`);
  scheduleAutoSync(user.id, user.name);
  res.status(201).json(created);
});

router.put("/admin/website/promotions/:id", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const { title, subtitle, badge, discount_text, image_url, link_url, is_active, sort_order } = req.body || {};
  db.prepare(`
    UPDATE website_promotions
    SET title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        badge = COALESCE(?, badge),
        discount_text = COALESCE(?, discount_text),
        image_url = COALESCE(?, image_url),
        link_url = COALESCE(?, link_url),
        is_active = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(
    title ?? null, subtitle ?? null, badge ?? null, discount_text ?? null,
    image_url ?? null, link_url ?? null,
    is_active !== undefined ? (Number(is_active) ? 1 : 0) : null,
    sort_order !== undefined ? Number(sort_order) : null,
    req.params.id
  );
  const updated = db.prepare("SELECT * FROM website_promotions WHERE id = ?").get(req.params.id);
  scheduleAutoSync(user.id, user.name);
  res.json(updated);
});

router.delete("/admin/website/promotions/:id", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  db.prepare("DELETE FROM website_promotions WHERE id = ?").run(req.params.id);
  logAudit(user.id, user.name, "WEBSITE_PROMO_DELETED", `حذف بنر إعلاني #${req.params.id}`);
  scheduleAutoSync(user.id, user.name);
  res.json({ success: true });
});

// 19.5 Real-time cloud sync push receiver
router.post("/public/website/sync-push", (req, res) => {
  try {
    const { secret, settings, services } = req.body || {};
    const expectedSecret = process.env.OMNIFLY_SYNC_SECRET;
    if (!expectedSecret || typeof secret !== "string") {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }
    const providedBuf = Buffer.from(secret);
    const expectedBuf = Buffer.from(expectedSecret);
    if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      res.status(403).json({ error: "غير مصرح" });
      return;
    }

    if (settings && typeof settings === "object") {
      applyColumnsToWebsiteSettings(sanitizeConfigFields(settings));
    }

    if (Array.isArray(services)) {
      db.prepare("DELETE FROM website_custom_services").run();
      const ins = db.prepare(`
        INSERT INTO website_custom_services (id, category, title, subtitle, price, badge, car_type, duration, features, origin, destination, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of services) {
        ins.run(
          s.id || null, s.category || "rides", s.title, s.subtitle || null,
          Number(s.price || 0), s.badge || null, s.car_type || null,
          s.duration || null, s.features || null, s.origin || null,
          s.destination || null, Number(s.is_active ?? 1), Number(s.sort_order ?? 0)
        );
      }
    }

    exportWebsiteDataToFile(getCurrentTenantId() || 1);
    res.json({ success: true, message: "تم استقبال وتطبيق التزامن اللحظي بنجاح" });
  } catch (err: any) {
    res.status(500).json({ error: "فشل استقبال التزامن", message: err.message });
  }
});

// 20. Admin Get All Website Online Bookings
router.get("/admin/website/bookings", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const rows = db.prepare("SELECT * FROM website_online_bookings ORDER BY id DESC LIMIT 200").all();
  res.json(rows);
});

// 21. Admin Update Online Booking Status
router.put("/admin/website/bookings/:id/status", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const { booking_status, payment_status, notes } = req.body;
  db.prepare(`
    UPDATE website_online_bookings
    SET booking_status = COALESCE(?, booking_status),
        payment_status = COALESCE(?, payment_status),
        notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(booking_status || null, payment_status || null, notes || null, req.params.id);

  const updated = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(req.params.id);
  logAudit(user.id, user.name, "WEBSITE_BOOKING_STATUS", `تحديث حالة الحجز الإلكتروني #${req.params.id}`);
  res.json(updated);
});

// 22. Admin Get Website Inquiries
router.get("/admin/website/inquiries", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;
  const rows = db.prepare("SELECT * FROM website_inquiries ORDER BY id DESC LIMIT 100").all();
  res.json(rows);
});

// 23. Admin Update Inquiry Status
router.put("/admin/website/inquiries/:id/status", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const { status } = req.body;
  db.prepare("UPDATE website_inquiries SET status = ? WHERE id = ?").run(status, req.params.id);
  const updated = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(req.params.id);
  res.json(updated);
});

// ─────────────────────────────────────────────────────────────────────────────
// 24. ADMIN HEADER NOTIFICATIONS & WEBSITE APPROVAL + ACCOUNTING WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────

function ensureWebsiteCustomerWithCoaAccount(params: {
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
}): { customerId: number; accountCode: string; customer: any } {
  const cleanName = String(params.name || "عميل الموقع").trim();
  const cleanPhone = String(params.phone || "").trim();
  const digitsOnly = cleanPhone.replace(/\D/g, "");

  let customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(cleanPhone) as any;
  if (!customer && digitsOnly.length >= 7) {
    const tail = digitsOnly.slice(-9);
    customer = db
      .prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') LIKE ? LIMIT 1")
      .get(`%${tail}`) as any;
  }

  if (!customer) {
    const ins = db
      .prepare("INSERT INTO customers (name, phone, email, notes) VALUES (?, ?, ?, ?)")
      .run(
        cleanName,
        cleanPhone,
        params.email || null,
        params.notes || "عميل معتمد من حجوزات الموقع الإلكتروني"
      );
    customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(ins.lastInsertRowid) as any;
  }

  // Ensure parent account 11200 (العملاء والذمم المدينة) exists
  const acc11200 = db.prepare("SELECT id, code FROM accounts WHERE code = '11200'").get() as any;
  if (!acc11200) {
    db.prepare(`
      INSERT OR IGNORE INTO accounts (code, name, type, parent_code, balance, is_parent, auto_add, active, level)
      VALUES ('11200', 'العملاء والذمم المدينة', 'asset', '11000', 0, 1, 1, 1, 2)
    `).run();
  }

  let accountCode = String(customer.account_code || "").trim();
  if (accountCode) {
    const existingAcc = db.prepare("SELECT id, code FROM accounts WHERE code = ?").get(accountCode) as any;
    if (!existingAcc) accountCode = "";
  }

  if (!accountCode) {
    const linked = db
      .prepare(
        `SELECT a.code FROM account_customers ac
         JOIN accounts a ON a.id = ac.account_id
         WHERE ac.customer_id = ? LIMIT 1`
      )
      .get(customer.id) as { code: string } | undefined;
    if (linked?.code) {
      accountCode = linked.code;
    }
  }

  if (!accountCode) {
    const rows = db
      .prepare("SELECT code FROM accounts WHERE code LIKE '112%' AND code != '11200'")
      .all() as Array<{ code: string }>;
    let maxNum = 11200;
    for (const r of rows) {
      const n = parseInt(r.code, 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
    accountCode = String(maxNum + 1);
    db.prepare(`
      INSERT INTO accounts (code, name, type, parent_code, balance, auto_add, is_parent, active, level)
      VALUES (?, ?, 'asset', '11200', 0, 1, 0, 1, 3)
    `).run(accountCode, customer.name || cleanName);
  }

  db.prepare("UPDATE customers SET account_code = ? WHERE id = ?").run(accountCode, customer.id);
  const accRow = db.prepare("SELECT id FROM accounts WHERE code = ?").get(accountCode) as { id: number } | undefined;
  if (accRow?.id) {
    db.prepare("INSERT OR IGNORE INTO account_customers (account_id, customer_id) VALUES (?, ?)").run(accRow.id, customer.id);
  }

  const updatedCustomer = db.prepare("SELECT * FROM customers WHERE id = ?").get(customer.id);
  return { customerId: Number(customer.id), accountCode, customer: updatedCustomer };
}

function resolveAvailableAccountCode(preferredCode: string, fallbackCode: string): string {
  const row = db.prepare("SELECT code FROM accounts WHERE code = ? AND active = 1").get(preferredCode) as { code: string } | undefined;
  if (row?.code) return row.code;
  const fb = db.prepare("SELECT code FROM accounts WHERE code = ?").get(fallbackCode) as { code: string } | undefined;
  if (fb?.code) return fb.code;
  const anyAsset = db.prepare("SELECT code FROM accounts WHERE type = 'asset' ORDER BY id ASC LIMIT 1").get() as { code: string } | undefined;
  return anyAsset?.code || fallbackCode;
}

router.get("/admin/notifications", (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مصرح" });
    return;
  }

  let pendingBookings: any[] = [];
  let newInquiries: any[] = [];
  try {
    pendingBookings = db
      .prepare(
        `SELECT id, booking_ref, service_type, service_title, customer_name, customer_phone,
                total_amount, currency, payment_method, payment_status, booking_status, created_at
         FROM website_online_bookings
         WHERE booking_status = 'pending_approval'
         ORDER BY id DESC LIMIT 40`
      )
      .all();
  } catch {}

  try {
    newInquiries = db
      .prepare(
        `SELECT id, name, phone, service_interest, message, status, created_at
         FROM website_inquiries
         WHERE status = 'new'
         ORDER BY id DESC LIMIT 40`
      )
      .all();
  } catch {}

  const items = [
    ...pendingBookings.map((b) => ({
      id: `booking-${b.id}`,
      entityType: "website_booking" as const,
      entityId: Number(b.id),
      title: `طلب حجز جديد (${b.booking_ref})`,
      subtitle: `${b.customer_name} • ${b.service_title} (${b.total_amount} ${b.currency || "SAR"})`,
      status: b.booking_status,
      createdAt: b.created_at,
      href: `/website-management?tab=bookings&bookingId=${b.id}`,
    })),
    ...newInquiries.map((inq) => ({
      id: `inquiry-${inq.id}`,
      entityType: "website_inquiry" as const,
      entityId: Number(inq.id),
      title: `استفسار عميل جديد من الموقع`,
      subtitle: `${inq.name} • ${inq.service_interest || "استفسار عام"}`,
      status: inq.status,
      createdAt: inq.created_at,
      href: `/website-management?tab=inquiries&inquiryId=${inq.id}`,
    })),
  ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  res.json({
    pendingCount: items.length,
    bookingsCount: pendingBookings.length,
    inquiriesCount: newInquiries.length,
    items,
  });
});

router.post("/admin/website/bookings/:id/approve", async (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const bookingId = Number(req.params.id);
  const { payment_status, payment_method, safe_id, final_amount, notes, force_whatsapp_immediate } = req.body || {};

  try {
    const txResult = db.transaction(() => {
      const booking = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(bookingId) as any;
      if (!booking) {
        return { errorStatus: 404, error: "طلب الحجز غير موجود" };
      }
      if (booking.booking_status === "rejected") {
        return { errorStatus: 409, error: "تم رفض هذا الحجز مسبقاً ولا يمكن اعتماده" };
      }
      if (booking.booking_status === "confirmed" && booking.invoice_id && booking.journal_entry_id) {
        const existingCustomer = booking.customer_id
          ? db.prepare("SELECT * FROM customers WHERE id = ?").get(booking.customer_id)
          : null;
        const existingInvoice = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(booking.invoice_id);
        return {
          alreadyApproved: true,
          booking,
          customer: existingCustomer,
          invoice: existingInvoice,
          journalEntryId: booking.journal_entry_id,
        };
      }

      const effAmount =
        final_amount !== undefined && Number(final_amount) >= 0
          ? Number(final_amount)
          : Number(booking.total_amount || 0);
      const effPaymentMethod = String(payment_method || booking.payment_method || "cash");
      const effPaymentStatus = String(
        payment_status ||
          (effPaymentMethod === "credit_card" || effPaymentMethod === "bank_transfer"
            ? booking.payment_status || "paid"
            : booking.payment_status || "pending")
      );
      const effNotes = notes !== undefined ? String(notes) : booking.notes;

      const { customerId, accountCode: customerAccountCode, customer } = ensureWebsiteCustomerWithCoaAccount({
        name: booking.customer_name,
        phone: booking.customer_phone,
        email: booking.customer_email,
        notes: `عميل حجز الموقع (${booking.booking_ref})`,
      });

      const svcType = String(booking.service_type || "flight").toLowerCase();
      const preferredRevCode =
        svcType === "hotel"
          ? "42000"
          : svcType === "visa"
          ? "43000"
          : svcType === "flight" || svcType === "ticket"
          ? "41000"
          : "44000";
      const revenueAccountCode = resolveAvailableAccountCode(preferredRevCode, "41000");

      const isPaid = effPaymentStatus === "paid";
      const debitAccountCode = isPaid
        ? effPaymentMethod === "cash"
          ? resolveAvailableAccountCode("11100", customerAccountCode)
          : resolveAvailableAccountCode("11102", "11100")
        : customerAccountCode;

      const todayStr = new Date().toISOString().slice(0, 10);
      const invoiceNumber = `WEB-INV-${booking.id}-${Date.now().toString().slice(-4)}`;
      const paidAmt = isPaid ? effAmount : 0;
      const remAmt = isPaid ? 0 : effAmount;

      const invRes = db
        .prepare(
          `INSERT INTO travel_invoices (
            invoice_number, invoice_date, customer_id, customer_name,
            payment_method, payment_status, cost_subtotal, fees_subtotal,
            selling_subtotal, discount, net_selling, net_profit,
            paid_amount, remaining_amount, branch_id, user_id, user_name,
            notes, statement, grand_total, issue_date, status, customer_statement,
            currency, exchange_rate, debit_account_code, credit_account_code
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, 0, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, 1.0, ?, ?)`
        )
        .run(
          invoiceNumber,
          todayStr,
          customerId,
          customer.name || booking.customer_name,
          effPaymentMethod,
          effPaymentStatus,
          effAmount,
          effAmount,
          effAmount,
          paidAmt,
          remAmt,
          user.id,
          user.name,
          effNotes || `اعتماد حجز الموقع الإلكتروني (${booking.booking_ref})`,
          `اعتماد حجز موقع إلكتروني: ${booking.service_title} - ${booking.booking_ref}`,
          effAmount,
          todayStr,
          `${booking.service_title} (${booking.booking_ref})`,
          booking.currency || "SAR",
          debitAccountCode,
          revenueAccountCode
        );

      const invoiceId = Number(invRes.lastInsertRowid);

      db.prepare(
        `INSERT INTO travel_invoice_items (
          invoice_id, service_type, service_ref_id, description, passenger_name,
          cost_price, service_fees, selling_price, profit, statement, accounting_impact_account
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
      ).run(
        invoiceId,
        svcType,
        booking.id,
        `${booking.service_title || svcType} (${booking.booking_ref}) — عدد ${Number(booking.passengers_count || 1)}`,
        customer.name || booking.customer_name,
        effAmount,
        effAmount,
        `اعتماد حجز موقع إلكتروني: ${booking.service_title || svcType} (${booking.booking_ref})`,
        revenueAccountCode
      );

      let journalEntryId: number | null = null;
      if (effAmount > 0) {
        journalEntryId = createDoubleEntryJournal(
          todayStr,
          `اعتماد حجز الموقع الإلكتروني #${booking.booking_ref} - ${customer.name} (${booking.service_title})`,
          "website_booking",
          booking.id,
          [
            {
              account_code: debitAccountCode,
              debit: effAmount,
              credit: 0,
              description: isPaid
                ? `تحصيل حجز الموقع ${booking.booking_ref} (${effPaymentMethod})`
                : `استحقاق ذمة عميل حجز الموقع ${booking.booking_ref}`,
              currency: booking.currency || "SAR",
              exchange_rate: 1.0,
            },
            {
              account_code: revenueAccountCode,
              debit: 0,
              credit: effAmount,
              description: `إيراد ${booking.service_title} (${booking.booking_ref})`,
              currency: booking.currency || "SAR",
              exchange_rate: 1.0,
            },
          ],
          {
            currency: booking.currency || "SAR",
            currency_rate: 1.0,
            reference_no: invoiceNumber,
            doc_type: "فاتورة حجز موقع",
          }
        );

        db.prepare("UPDATE travel_invoices SET journal_entry_id = ? WHERE id = ?").run(journalEntryId, invoiceId);
      }

      if (isPaid && effPaymentMethod === "cash" && effAmount > 0) {
        const targetSafe = safe_id
          ? (db.prepare("SELECT * FROM safes WHERE id = ?").get(Number(safe_id)) as any)
          : (db.prepare("SELECT * FROM safes WHERE active = 1 ORDER BY id ASC LIMIT 1").get() as any);
        if (targetSafe) {
          db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(effAmount, targetSafe.id);
          db.prepare(
            `INSERT INTO safe_transactions (
              transaction_number, safe_id, safe_name, date, user_id, user_name,
              amount, currency, statement, reference_number, operation_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'إيداع')`
          ).run(
            `ST-WEB-${booking.id}-${Date.now().toString().slice(-4)}`,
            targetSafe.id,
            targetSafe.name || "الصندوق الرئيسي",
            todayStr,
            user.id,
            user.name,
            effAmount,
            booking.currency || "SAR",
            `تحصيل حجز موقع إلكتروني معتمد (${booking.booking_ref}) - ${customer.name}`,
            invoiceNumber
          );
        }
      }

      db.prepare(
        `UPDATE website_online_bookings
         SET booking_status = 'confirmed',
             payment_status = ?,
             payment_method = ?,
             total_amount = ?,
             notes = ?,
             customer_id = ?,
             invoice_id = ?,
             journal_entry_id = ?,
             approved_by = ?,
             approved_by_name = ?,
             approved_at = datetime('now', 'localtime')
         WHERE id = ?`
      ).run(
        effPaymentStatus,
        effPaymentMethod,
        effAmount,
        effNotes || null,
        customerId,
        invoiceId,
        journalEntryId,
        user.id,
        user.name,
        bookingId
      );

      logAudit(
        user.id,
        user.name,
        "WEBSITE_BOOKING_APPROVED",
        `اعتماد حجز الموقع ${booking.booking_ref} وحفظ العميل (${customer.name} - ${customerAccountCode}) والفاتورة ${invoiceNumber}`
      );

      const updatedBooking = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(bookingId);
      const createdInvoice = db.prepare("SELECT * FROM travel_invoices WHERE id = ?").get(invoiceId);

      return {
        alreadyApproved: false,
        booking: updatedBooking,
        customer,
        customerAccountCode,
        invoice: createdInvoice,
        invoiceNumber,
        journalEntryId,
        effPaymentStatus,
      };
    })();

    if ((txResult as any).errorStatus) {
      res.status((txResult as any).errorStatus).json({ error: (txResult as any).error });
      return;
    }

    if ((txResult as any).alreadyApproved) {
      res.json({
        success: true,
        alreadyApproved: true,
        message: "تم اعتماد هذا الحجز مسبقاً",
        ...(txResult as any),
      });
      return;
    }

    const waResult = await scheduleOrDispatchWebsiteBookingWhatsApp((txResult as any).booking, {
      invoiceNumber: (txResult as any).invoiceNumber,
      paymentStatus: (txResult as any).effPaymentStatus,
      forceImmediate: Boolean(force_whatsapp_immediate),
    });

    try {
      db.prepare(
        "UPDATE website_online_bookings SET whatsapp_log_id = ?, whatsapp_scheduled_at = ? WHERE id = ?"
      ).run(waResult.logId || null, waResult.scheduledAt || null, bookingId);
    } catch {}

    const finalBooking = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(bookingId);
    scheduleAutoSync(user.id, user.name);

    res.json({
      success: true,
      message: waResult.dispatched
        ? "تم اعتماد الحجز، تسجيل العميل والفاتورة في دليل الحسابات، وإرسال إشعار الواتساب للعميل"
        : waResult.scheduled
        ? `تم اعتماد الحجز، تسجيل العميل والفاتورة في دليل الحسابات، وجدولة إشعار الواتساب (${waResult.scheduledAt})`
        : "تم اعتماد الحجز وحفظ العميل والفاتورة في دليل الحسابات بنجاح",
      booking: finalBooking,
      customer: (txResult as any).customer,
      customerAccountCode: (txResult as any).customerAccountCode,
      invoice: (txResult as any).invoice,
      journalEntryId: (txResult as any).journalEntryId,
      whatsapp: waResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "تعذر اعتماد الحجز وتسجيله محاسبياً" });
  }
});

router.post("/admin/website/bookings/:id/reject", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const bookingId = Number(req.params.id);
  const { reason = "" } = req.body || {};
  const existing = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(bookingId) as any;
  if (!existing) {
    res.status(404).json({ error: "طلب الحجز غير موجود" });
    return;
  }
  if (existing.booking_status === "confirmed") {
    res.status(409).json({ error: "لا يمكن رفض حجز تم اعتماده وترحيله محاسبياً مسبقاً" });
    return;
  }

  db.prepare(
    `UPDATE website_online_bookings
     SET booking_status = 'rejected',
         rejected_reason = ?,
         approved_by = ?,
         approved_by_name = ?,
         approved_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(String(reason || "").trim() || null, user.id, user.name, bookingId);

  logAudit(
    user.id,
    user.name,
    "WEBSITE_BOOKING_REJECTED",
    `رفض طلب الحجز الإلكتروني ${existing.booking_ref}${reason ? `: ${reason}` : ""}`
  );
  scheduleAutoSync(user.id, user.name);
  const updated = db.prepare("SELECT * FROM website_online_bookings WHERE id = ?").get(bookingId);
  res.json({ success: true, message: "تم رفض طلب الحجز بنجاح", booking: updated });
});

router.post("/admin/website/inquiries/:id/approve", (req, res) => {
  const user = requireWebsiteAdmin(req, res);
  if (!user) return;

  const inqId = Number(req.params.id);
  const { status = "reviewed", save_customer = false } = req.body || {};
  const inq = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(inqId) as any;
  if (!inq) {
    res.status(404).json({ error: "الاستفسار غير موجود" });
    return;
  }

  let customerInfo: any = null;
  if (save_customer) {
    customerInfo = ensureWebsiteCustomerWithCoaAccount({
      name: inq.name,
      phone: inq.phone,
      email: inq.email,
      notes: `تم اعتماده من استفسارات الموقع (${inq.service_interest || "استفسار"})`,
    });
  }

  db.prepare("UPDATE website_inquiries SET status = ? WHERE id = ?").run(status, inqId);
  logAudit(user.id, user.name, "WEBSITE_INQUIRY_REVIEWED", `مراجعة واعتماد استفسار العميل ${inq.name}`);
  scheduleAutoSync(user.id, user.name);

  const updated = db.prepare("SELECT * FROM website_inquiries WHERE id = ?").get(inqId);
  res.json({ success: true, inquiry: updated, customer: customerInfo?.customer || null, customerAccountCode: customerInfo?.accountCode || null });
});

export default router;
