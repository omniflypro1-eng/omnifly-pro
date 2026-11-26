import { Router } from "express";
import { db, masterDb, hashPassword, isLocalDesktopMode, checkpointDatabase } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import { recordAuditLog } from "./audit";

const router = Router();

function isAdminRole(role?: string) {
  return role === "admin" || role === "developer" || role === "general_manager" || role === "مدير" || role === "مدير عام" || role === "مدير عام الشركة";
}

function isProtectedSuperAccount(role?: string, username?: string) {
  const uname = String(username || "").trim().toLowerCase();
  const r = String(role || "").trim().toLowerCase();
  return r === "developer" || uname === "developer" || uname === "admin";
}

function canManageUsers(user: any): boolean {
  if (!user) return false;
  if (user.role === "developer" || String(user.username || "").toLowerCase() === "developer") return true;
  if (Array.isArray(user.allowed_modules) && user.allowed_modules.length > 0) {
    return user.allowed_modules.includes("sys_admin");
  }
  return isAdminRole(user.role) || user.username === "admin";
}

function getAuthUserStrict(req: any) {
  return getAuthUser(req);
}

function parseModulesField(val: any): string[] | null {
  if (!val) return null;
  if (Array.isArray(val)) return val.filter((x) => typeof x === "string" && x.trim().length > 0);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === "string" && x.trim().length > 0);
    } catch {}
  }
  return null;
}

function serializeModulesField(val: any, isProtectedSuper: boolean): string | null {
  if (isProtectedSuper) return null;
  if (val === undefined || val === null) return null;
  if (Array.isArray(val)) {
    const clean = Array.from(new Set(val.filter((x) => typeof x === "string" && x.trim().length > 0)));
    return clean.length > 0 ? JSON.stringify(clean) : null;
  }
  if (typeof val === "string" && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) return JSON.stringify(parsed);
    } catch {}
  }
  return null;
}

const toUser = (u: any) => {
  const isAdmin = isAdminRole(u.role) || u.username === "admin" || u.username === "developer";
  const isSuper = isProtectedSuperAccount(u.role, u.username);
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    active: Boolean(u.active),
    can_discount: isAdmin ? true : Boolean(u.can_discount !== undefined && u.can_discount !== null ? u.can_discount : (u.role === "accountant")),
    email: u.email,
    phone: u.phone,
    avatar_url: u.avatar_url,
    default_branch_id: u.default_branch_id,
    language: u.language,
    timezone: u.timezone,
    status: u.status,
    full_name: u.full_name,
    
    employee_id: u.employee_id,
    branch_id: u.branch_id,
    allowed_modules: isSuper ? null : parseModulesField(u.allowed_modules),
    perm_create_invoice: isAdmin ? true : (u.perm_create_invoice !== undefined ? Boolean(u.perm_create_invoice) : true),
    perm_edit_invoice: isAdmin ? true : (u.perm_edit_invoice !== undefined ? Boolean(u.perm_edit_invoice) : true),
    perm_cancel_invoice: isAdmin ? true : (u.perm_cancel_invoice !== undefined ? Boolean(u.perm_cancel_invoice) : true),
    perm_return: isAdmin ? true : (u.perm_return !== undefined ? Boolean(u.perm_return) : true),
    perm_view_prices: isAdmin ? true : (u.perm_view_prices !== undefined ? Boolean(u.perm_view_prices) : true),
    perm_view_profits: isAdmin ? true : (u.perm_view_profits !== undefined ? Boolean(u.perm_view_profits) : true),
    perm_edit_stock: isAdmin ? true : (u.perm_edit_stock !== undefined ? Boolean(u.perm_edit_stock) : true),
    perm_stocktake: isAdmin ? true : (u.perm_stocktake !== undefined ? Boolean(u.perm_stocktake) : true),
    perm_edit_entries: isAdmin ? true : (u.perm_edit_entries !== undefined ? Boolean(u.perm_edit_entries) : true),
    perm_close_periods: isAdmin ? true : (u.perm_close_periods !== undefined ? Boolean(u.perm_close_periods) : true),
    perm_view_salaries: isAdmin ? true : (u.perm_view_salaries !== undefined ? Boolean(u.perm_view_salaries) : true)
  };
};

router.get("/users", (req, res) => {
  const user = getAuthUserStrict(req);
  if (!canManageUsers(user)) { res.status(403).json({ error: "غير مصرح" }); return; }
  let rows = db.prepare(`
    SELECT id, username, name, role, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
           employee_id, branch_id, allowed_modules, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
           perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
    FROM users 
    ORDER BY name
  `).all() as any[];
  if (user.role !== "developer") {
    rows = rows.filter((r: any) => r.role !== "developer" && r.username !== "developer");
  }
  res.json(rows.map(toUser));
});

router.post("/users", (req, res) => {
  const user = getAuthUserStrict(req);
  if (!canManageUsers(user)) { res.status(403).json({ error: "غير مصرح" }); return; }
  const {
    username, name, role, password, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
    employee_id, branch_id, allowed_modules,
    perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
    perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
  } = req.body;
  if (!username || !name || !role || !password) { res.status(400).json({ error: "بيانات ناقصة" }); return; }
  
  if (role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح لغير المطور بتعيين دور المطور" });
    return;
  }

  const tenantId = Number((user as any).tenant_id || 1);
  if (!isLocalDesktopMode()) {
    const tRow = masterDb.prepare("SELECT max_users FROM cloud_tenants WHERE id = ?").get(tenantId) as any;
    if (tRow?.max_users) {
      const currentUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE LOWER(username) != 'developer'").get() as { c: number })?.c || 0;
      if (currentUsers >= Number(tRow.max_users)) {
        res.status(403).json({ error: `تم الوصول للحد الأقصى للمستخدمين المسموح به في باقة المؤسسة (${tRow.max_users} مستخدمين).` });
        return;
      }
    }
    const globalDup = masterDb.prepare("SELECT id FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))").get(String(username).trim());
    if (globalDup) {
      res.status(409).json({ error: `اسم المستخدم (${username}) مستخدم مسبقاً في النظام السحابي` });
      return;
    }
  }
  
  const cleanUsername = String(username).trim();
  const cleanRole = String(role).trim();
  const hash = hashPassword(password);
  const targetIsAdmin = isAdminRole(cleanRole);
  const targetIsProtectedSuper = isProtectedSuperAccount(cleanRole, cleanUsername);
  const serializedModules = serializeModulesField(allowed_modules, targetIsProtectedSuper);
  const discountFlag = targetIsAdmin ? 1 : (can_discount !== undefined ? (can_discount ? 1 : 0) : (cleanRole === "accountant" ? 1 : 0));
  const r = db.prepare(`
    INSERT INTO users (
      username, password_hash, name, role, active, can_discount,
      email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
      employee_id, branch_id, allowed_modules,
      perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
      perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cleanUsername, hash, name, cleanRole, active !== false ? 1 : 0, discountFlag,
    email ?? null, phone ?? null, avatar_url ?? null, default_branch_id ?? 1, language ?? "عربي", timezone ?? "GMT+3", status ?? "نشط", full_name ?? name,
    employee_id ? Number(employee_id) : null,
    branch_id ? Number(branch_id) : null,
    serializedModules,
    targetIsAdmin || perm_create_invoice !== false ? 1 : 0,
    targetIsAdmin || perm_edit_invoice !== false ? 1 : 0,
    targetIsAdmin || perm_cancel_invoice !== false ? 1 : 0,
    targetIsAdmin || perm_return !== false ? 1 : 0,
    targetIsAdmin || perm_view_prices !== false ? 1 : 0,
    targetIsAdmin || perm_view_profits !== false ? 1 : 0,
    targetIsAdmin || perm_edit_stock !== false ? 1 : 0,
    targetIsAdmin || perm_stocktake !== false ? 1 : 0,
    targetIsAdmin || perm_edit_entries !== false ? 1 : 0,
    targetIsAdmin || perm_close_periods !== false ? 1 : 0,
    targetIsAdmin || perm_view_salaries !== false ? 1 : 0
  );
  const u = db.prepare(`
    SELECT id, username, name, role, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
           employee_id, branch_id, allowed_modules, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
           perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
    FROM users WHERE id=?
  `).get(r.lastInsertRowid) as any;

  if (!isLocalDesktopMode() && tenantId > 1) {
    const existingMaster = masterDb
      .prepare("SELECT id FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?)) AND tenant_id=?")
      .get(cleanUsername, tenantId) as { id: number } | undefined;
    if (existingMaster) {
      masterDb.prepare(
        "UPDATE users SET password_hash=?, name=?, role=?, active=?, can_discount=?, email=?, phone=?, status=?, full_name=?, allowed_modules=? WHERE id=?"
      ).run(hash, name, cleanRole, active !== false ? 1 : 0, discountFlag, email ?? null, phone ?? null, status ?? "نشط", full_name ?? name, serializedModules, existingMaster.id);
    } else {
      masterDb.prepare(`
        INSERT INTO users (username, password_hash, name, role, active, can_discount, tenant_id, email, phone, status, full_name, allowed_modules)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cleanUsername, hash, name, cleanRole, active !== false ? 1 : 0, discountFlag, tenantId, email ?? null, phone ?? null, status ?? "نشط", full_name ?? name, serializedModules);
    }
    checkpointDatabase(masterDb);
  }
  checkpointDatabase(db);

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `إنشاء مستخدم جديد: ${name} (${cleanUsername})`,
      actionType: "create",
      entityType: "users",
      entityId: Number(r.lastInsertRowid),
      details: `تم إنشاء حساب مستخدم جديد بدور: ${cleanRole}`
    });
  }

  res.status(201).json(toUser(u));
});

router.put("/users/:id", (req, res) => {
  const user = getAuthUserStrict(req);
  if (!canManageUsers(user)) { res.status(403).json({ error: "غير مصرح" }); return; }
  
  const targetUser = db.prepare("SELECT id, username, name, role, active, can_discount, password_hash, allowed_modules FROM users WHERE id=?").get(req.params.id) as any;
  if (!targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  
  if (targetUser.role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح بالتعديل على حساب المطور" });
    return;
  }
  
  const {
    username, name, role, password, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
    employee_id, branch_id, allowed_modules,
    perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
    perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
  } = req.body;
  
  if (role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح لغير المطور بتعيين دور المطور" });
    return;
  }
  
  const targetRole = role ?? targetUser.role;
  const targetIsAdmin = isAdminRole(targetRole);
  const cleanOldU = String(targetUser.username || "").trim();
  const cleanNewU = String(username || targetUser.username || "").trim();
  const targetIsProtectedSuper = isProtectedSuperAccount(targetRole, cleanNewU);
  const serializedModules = allowed_modules !== undefined
    ? serializeModulesField(allowed_modules, targetIsProtectedSuper)
    : (targetIsProtectedSuper ? null : (targetUser.allowed_modules ?? null));
  const discountFlag = targetIsAdmin ? 1 : (can_discount !== undefined 
    ? (can_discount ? 1 : 0) 
    : (targetUser.can_discount !== undefined && targetUser.can_discount !== null ? targetUser.can_discount : (targetRole === "accountant" ? 1 : 0)));
  const newPassHash = password ? hashPassword(password) : null;
  const callerTenantId = Number((user as any).tenant_id || 1);

  if (!isLocalDesktopMode() && cleanNewU.toLowerCase() !== cleanOldU.toLowerCase()) {
    const dupMaster = masterDb
      .prepare("SELECT id FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?))")
      .get(cleanNewU) as { id: number } | undefined;
    if (dupMaster) {
      res.status(409).json({ error: `اسم المستخدم (${cleanNewU}) مستخدم مسبقاً في النظام السحابي` });
      return;
    }
  }

  if (newPassHash) {
    db.prepare(`
      UPDATE users SET
        username=?, name=?, role=?, password_hash=?, active=?, can_discount=?,
        email=?, phone=?, avatar_url=?, default_branch_id=?, language=?, timezone=?, status=?, full_name=?,
        employee_id=?, branch_id=?, allowed_modules=?,
        perm_create_invoice=?, perm_edit_invoice=?, perm_cancel_invoice=?, perm_return=?, perm_view_prices=?, perm_view_profits=?,
        perm_edit_stock=?, perm_stocktake=?, perm_edit_entries=?, perm_close_periods=?, perm_view_salaries=?
      WHERE id=?
    `).run(
      cleanNewU, name, targetRole, newPassHash, active !== false ? 1 : 0, discountFlag,
      email ?? null, phone ?? null, avatar_url ?? null, default_branch_id ?? 1, language ?? "عربي", timezone ?? "GMT+3", status ?? "نشط", full_name ?? name,
      employee_id !== undefined ? (employee_id ? Number(employee_id) : null) : null,
      branch_id !== undefined ? (branch_id ? Number(branch_id) : null) : null,
      serializedModules,
      targetIsAdmin || perm_create_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_edit_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_cancel_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_return !== false ? 1 : 0,
      targetIsAdmin || perm_view_prices !== false ? 1 : 0,
      targetIsAdmin || perm_view_profits !== false ? 1 : 0,
      targetIsAdmin || perm_edit_stock !== false ? 1 : 0,
      targetIsAdmin || perm_stocktake !== false ? 1 : 0,
      targetIsAdmin || perm_edit_entries !== false ? 1 : 0,
      targetIsAdmin || perm_close_periods !== false ? 1 : 0,
      targetIsAdmin || perm_view_salaries !== false ? 1 : 0,
      req.params.id
    );
  } else {
    db.prepare(`
      UPDATE users SET
        username=?, name=?, role=?, active=?, can_discount=?,
        email=?, phone=?, avatar_url=?, default_branch_id=?, language=?, timezone=?, status=?, full_name=?,
        employee_id=?, branch_id=?, allowed_modules=?,
        perm_create_invoice=?, perm_edit_invoice=?, perm_cancel_invoice=?, perm_return=?, perm_view_prices=?, perm_view_profits=?,
        perm_edit_stock=?, perm_stocktake=?, perm_edit_entries=?, perm_close_periods=?, perm_view_salaries=?
      WHERE id=?
    `).run(
      cleanNewU, name, targetRole, active !== false ? 1 : 0, discountFlag,
      email ?? null, phone ?? null, avatar_url ?? null, default_branch_id ?? 1, language ?? "عربي", timezone ?? "GMT+3", status ?? "نشط", full_name ?? name,
      employee_id !== undefined ? (employee_id ? Number(employee_id) : null) : null,
      branch_id !== undefined ? (branch_id ? Number(branch_id) : null) : null,
      serializedModules,
      targetIsAdmin || perm_create_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_edit_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_cancel_invoice !== false ? 1 : 0,
      targetIsAdmin || perm_return !== false ? 1 : 0,
      targetIsAdmin || perm_view_prices !== false ? 1 : 0,
      targetIsAdmin || perm_view_profits !== false ? 1 : 0,
      targetIsAdmin || perm_edit_stock !== false ? 1 : 0,
      targetIsAdmin || perm_stocktake !== false ? 1 : 0,
      targetIsAdmin || perm_edit_entries !== false ? 1 : 0,
      targetIsAdmin || perm_close_periods !== false ? 1 : 0,
      targetIsAdmin || perm_view_salaries !== false ? 1 : 0,
      req.params.id
    );
  }
  const u = db.prepare(`
    SELECT id, username, name, role, active, can_discount, email, phone, avatar_url, default_branch_id, language, timezone, status, full_name,
           employee_id, branch_id, allowed_modules, perm_create_invoice, perm_edit_invoice, perm_cancel_invoice, perm_return, perm_view_prices, perm_view_profits,
           perm_edit_stock, perm_stocktake, perm_edit_entries, perm_close_periods, perm_view_salaries
    FROM users WHERE id=?
  `).get(req.params.id) as any;

  if (!isLocalDesktopMode() && callerTenantId > 1) {
    const existingMaster = masterDb
      .prepare("SELECT id FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?)) AND tenant_id=?")
      .get(cleanOldU, callerTenantId) as { id: number } | undefined;
    if (existingMaster) {
      if (newPassHash) {
        masterDb.prepare(
          "UPDATE users SET username=?, name=?, role=?, password_hash=?, active=?, can_discount=?, email=?, phone=?, status=?, full_name=?, allowed_modules=? WHERE id=?"
        ).run(cleanNewU, name, targetRole, newPassHash, active !== false ? 1 : 0, discountFlag, email ?? null, phone ?? null, status ?? "نشط", full_name ?? name, serializedModules, existingMaster.id);
      } else {
        masterDb.prepare(
          "UPDATE users SET username=?, name=?, role=?, active=?, can_discount=?, email=?, phone=?, status=?, full_name=?, allowed_modules=? WHERE id=?"
        ).run(cleanNewU, name, targetRole, active !== false ? 1 : 0, discountFlag, email ?? null, phone ?? null, status ?? "نشط", full_name ?? name, serializedModules, existingMaster.id);
      }
    } else {
      masterDb.prepare(
        "INSERT OR IGNORE INTO users (username, password_hash, name, role, active, can_discount, tenant_id, email, phone, status, full_name, allowed_modules) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(cleanNewU, newPassHash || targetUser.password_hash, name, targetRole, active !== false ? 1 : 0, discountFlag, callerTenantId, email ?? null, phone ?? null, status ?? "نشط", full_name ?? name, serializedModules);
    }
    checkpointDatabase(masterDb);
  }
  checkpointDatabase(db);

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `تعديل بيانات المستخدم: ${name || targetUser.name} (${cleanNewU})`,
      actionType: "update",
      entityType: "users",
      entityId: Number(req.params.id),
      details: `تم تعديل بيانات المستخدم بنجاح. الدور الجديد: ${targetRole}`
    });
  }

  res.json(toUser(u));
});

router.delete("/users/:id", (req, res) => {
  const user = getAuthUserStrict(req);
  if (!canManageUsers(user)) { res.status(403).json({ error: "غير مصرح" }); return; }
  
  const targetUser = db.prepare("SELECT id, username, name, role, active FROM users WHERE id=?").get(req.params.id) as any;
  if (!targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  
  if (targetUser.role === "developer" && user.role !== "developer") {
    res.status(403).json({ error: "غير مصرح بحذف حساب المطور" });
    return;
  }

  // System safety policy for user deletion: check for references
  const ordersCount = (db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ?").get(req.params.id) as { c: number }).c;
  const shiftsCount = (db.prepare("SELECT COUNT(*) as c FROM cash_shifts WHERE user_id = ?").get(req.params.id) as { c: number }).c;
  const journalCount = (db.prepare("SELECT COUNT(*) as c FROM journal_entries WHERE user_id = ?").get(req.params.id) as { c: number }).c;

  if (ordersCount > 0 || shiftsCount > 0 || journalCount > 0) {
    res.status(400).json({
      error: "لا يمكن حذف هذا المستخدم نظراً لوجود عمليات بيع، مناوبات نقدية، أو قيود محاسبية مسجلة باسمه في النظام. يُرجى إلغاء تفعيل حسابه وتعطيله بدلاً من الحذف للحفاظ على سلامة وتكامل السجلات المالية."
    });
    return;
  }
  
  db.prepare("DELETE FROM users WHERE id=?").run(req.params.id);
  if (!isLocalDesktopMode() && Number((user as any).tenant_id || 1) > 1) {
    masterDb.prepare("DELETE FROM users WHERE LOWER(TRIM(username))=LOWER(TRIM(?)) AND tenant_id=?").run(targetUser.username, Number((user as any).tenant_id));
    checkpointDatabase(masterDb);
  }
  checkpointDatabase(db);

  if (user) {
    recordAuditLog({
      userId: user.id,
      userName: user.name,
      action: `حذف المستخدم: ${targetUser.name} (${targetUser.username})`,
      actionType: "delete",
      entityType: "users",
      entityId: Number(req.params.id),
      details: `تم حذف حساب المستخدم بنجاح بعد التأكد من خلوه من الارتباطات المالية في النظام`
    });
  }

  res.status(204).send();
});

export default router;
