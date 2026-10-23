import { Router } from "express";
import { db, logAudit } from "../lib/sqlite";
import { getAuthUser } from "./auth";
import {
  getConversionMultiplier,
  convertCurrency,
  getCurrencyDecimals,
  getCurrencyFractionName,
  formatCurrencyAmount,
  getSystemPrimaryCurrency,
  normalizeCurrencyName,
  STANDARD_CURRENCIES_META
} from "../lib/currency-converter";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

router.get("/system/backup", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const products = db.prepare("SELECT * FROM products").all();
  const categories = db.prepare("SELECT * FROM categories").all();
  const orders = db.prepare("SELECT * FROM orders").all();
  const orderItems = db.prepare("SELECT * FROM order_items").all();
  const customers = db.prepare("SELECT * FROM customers").all();
  const expenses = db.prepare("SELECT * FROM expenses").all();
  const suppliers = db.prepare("SELECT * FROM suppliers").all();

  const backupData = {
    version: "2.5.0",
    timestamp: new Date().toISOString(),
    products,
    categories,
    orders,
    orderItems,
    customers,
    expenses,
    suppliers
  };

  logAudit(user.id, user.name, "نسخ احتياطي", "تصدير نسخة احتياطية من النظام");
  res.setHeader("Content-Disposition", `attachment; filename=omni-backup-${new Date().toISOString().slice(0, 10)}.json`);
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(backupData, null, 2));
});

// ────────────────────────────────────────────────────────
// CURRENCIES MANAGEMENT & CONVERSION ENDPOINTS
// ────────────────────────────────────────────────────────
router.get("/currencies", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM currencies ORDER BY type DESC, id ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/currencies", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, symbol, fraction, decimal_places, flag, type, exchange_rate, active } = req.body;
  if (!name || !symbol || !type) {
    res.status(400).json({ error: "بيانات العملة ناقصة، يرجى ملء الاسم والرمز والنوع" });
    return;
  }
  const cleanSymbol = symbol.trim().toUpperCase();
  const meta = STANDARD_CURRENCIES_META[cleanSymbol];
  const finalFraction = fraction || meta?.fraction || "هللة";
  const finalDecimals = decimal_places !== undefined ? Number(decimal_places) : (meta?.decimals ?? 2);
  const finalFlag = flag || meta?.flag || "🌐";
  const numRate = Number(exchange_rate) > 0 ? Number(exchange_rate) : 1.0;

  try {
    // If setting as local currency, enforce exclusivity (all others become foreign)
    if (type === "local") {
      db.prepare("UPDATE currencies SET type = 'foreign'").run();
    }

    const stmt = db.prepare(`
      INSERT INTO currencies (name, symbol, fraction, decimal_places, flag, type, exchange_rate, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name.trim(),
      cleanSymbol,
      finalFraction,
      finalDecimals,
      finalFlag,
      type,
      type === "local" ? 1.0 : numRate,
      active !== false ? 1 : 0
    );
    const row = db.prepare("SELECT * FROM currencies WHERE id = ?").get(result.lastInsertRowid);
    
    logAudit(user.id, user.name, "إضافة عملة", `تم إضافة عملة جديدة: ${name} (${cleanSymbol}) بسعر صرف (${type === "local" ? 1.0 : numRate}) وكسر (${finalFraction})`);
    res.status(201).json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { name, symbol, fraction, decimal_places, flag, type, exchange_rate, active } = req.body;
  try {
    const existing = db.prepare("SELECT * FROM currencies WHERE id = ?").get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: "العملة غير موجودة" });
      return;
    }

    const targetType = type ?? existing.type;
    // If setting as local currency, all other currencies become foreign
    if (targetType === "local" && existing.type !== "local") {
      db.prepare("UPDATE currencies SET type = 'foreign' WHERE id != ?").run(req.params.id);
    }

    const cleanSymbol = symbol ? symbol.trim().toUpperCase() : existing.symbol;
    const numRate = targetType === "local" ? 1.0 : (exchange_rate !== undefined ? Number(exchange_rate) : existing.exchange_rate);
    const numDecimals = decimal_places !== undefined ? Number(decimal_places) : (existing.decimal_places ?? 2);

    db.prepare(`
      UPDATE currencies
      SET name = ?, symbol = ?, fraction = ?, decimal_places = ?, flag = ?, type = ?, exchange_rate = ?, active = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      cleanSymbol,
      fraction !== undefined ? fraction : existing.fraction,
      numDecimals,
      flag !== undefined ? flag : existing.flag,
      targetType,
      numRate,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      req.params.id
    );
    // If the currency updated is the current system primary currency, sync safe balances
    const primaryCurrency = getSystemPrimaryCurrency();
    if (cleanSymbol === normalizeCurrencyName(primaryCurrency)) {
      try {
        const safes = db.prepare("SELECT id, name, balance, opening_balance, actual_balance, currency, base_balance, base_currency FROM safes").all() as any[];
        for (const s of safes) {
          const baseBal = s.base_balance !== null && s.base_balance !== undefined ? Number(s.base_balance) : 4000000;
          const baseCurr = s.base_currency || "YER";
          let newBalance = baseBal;
          if (normalizeCurrencyName(primaryCurrency) !== normalizeCurrencyName(baseCurr)) {
            const mult = getConversionMultiplier(baseCurr, primaryCurrency, numRate);
            newBalance = Math.round(baseBal * mult * 100) / 100;
          }
          db.prepare("UPDATE safes SET balance = ?, actual_balance = ? WHERE id = ?").run(newBalance, newBalance, s.id);
        }
      } catch (err) {
        console.error("Error syncing safes on currency rate change:", err);
      }
    }

    const updated = db.prepare("SELECT * FROM currencies WHERE id = ?").get(req.params.id);
    logAudit(user.id, user.name, "تعديل عملة", `تم تعديل العملة: ${name || existing.name} (${cleanSymbol})، سعر الصرف: ${numRate}`);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/currencies/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    const existing = db.prepare("SELECT * FROM currencies WHERE id = ?").get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: "العملة غير موجودة" });
      return;
    }
    if (existing.type === "local") {
      res.status(400).json({ error: "لا يمكن حذف العملة المحلية الأساسية للنظام" });
      return;
    }
    db.prepare("DELETE FROM currencies WHERE id = ?").run(req.params.id);
    logAudit(user.id, user.name, "حذف عملة", `تم حذف عملة: ${existing.name}`);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Real-time International Currency Conversion Calculator Endpoint
router.post("/currencies/convert", (req, res) => {
  try {
    const { amount, fromCurrency, toCurrency, customRate } = req.body || {};
    const numAmount = Number(amount) || 0;
    const from = String(fromCurrency || "YER");
    const to = String(toCurrency || "SAR");
    const rate = customRate !== undefined && customRate !== "" ? Number(customRate) : undefined;

    const multiplier = getConversionMultiplier(from, to, rate);
    const convertedAmount = convertCurrency(numAmount, from, to, rate);
    const formatted = formatCurrencyAmount(convertedAmount, to);
    const toDecimals = getCurrencyDecimals(to);
    const toFraction = getCurrencyFractionName(to);

    res.json({
      amount: numAmount,
      fromCurrency: from,
      toCurrency: to,
      multiplier,
      reverseMultiplier: multiplier > 0 ? Math.round((1.0 / multiplier) * 100000) / 100000 : 0,
      convertedAmount,
      decimals: toDecimals,
      fractionName: toFraction,
      formattedText: formatted.formatted,
      spelledText: formatted.spelled,
      formula: `${numAmount.toLocaleString("ar-SA")} ${from} × ${multiplier} = ${convertedAmount.toLocaleString("ar-SA")} ${to}`
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل التحويل الحسابي", message: err?.message });
  }
});

// ────────────────────────────────────────────────────────
// USER SESSIONS TRACKING ENDPOINTS
// ────────────────────────────────────────────────────────
router.get("/system/sessions", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM erp_sessions ORDER BY login_time DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/system/sessions/terminate/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    const existing = db.prepare("SELECT * FROM erp_sessions WHERE id = ?").get(req.params.id) as any;
    if (!existing) {
      res.status(404).json({ error: "الجلسة غير موجودة" });
      return;
    }
    db.prepare(`
      UPDATE erp_sessions
      SET status = 'خروج قسري', logout_time = datetime('now', 'localtime')
      WHERE id = ?
    `).run(req.params.id);
    logAudit(user.id, user.name, "إنهاء جلسة", `تم إنهاء جلسة المستخدم قسراً: ${existing.username}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ────────────────────────────────────────────────────────
// ROLE PERMISSIONS MANAGEMENT ENDPOINTS
// ────────────────────────────────────────────────────────
router.get("/role-permissions", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM role_permissions").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/role-permissions/:role", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { role } = req.params;
  const {
    can_void_bills,
    can_view_cost,
    can_change_currencies,
    can_approve_returns,
    can_open_close_safe,
    can_transfer_funds,
    can_edit_products,
    can_delete_orders
  } = req.body;

  try {
    db.prepare(`
      UPDATE role_permissions
      SET can_void_bills = ?,
          can_view_cost = ?,
          can_change_currencies = ?,
          can_approve_returns = ?,
          can_open_close_safe = ?,
          can_transfer_funds = ?,
          can_edit_products = ?,
          can_delete_orders = ?
      WHERE role = ?
    `).run(
      can_void_bills !== undefined ? (can_void_bills ? 1 : 0) : 0,
      can_view_cost !== undefined ? (can_view_cost ? 1 : 0) : 0,
      can_change_currencies !== undefined ? (can_change_currencies ? 1 : 0) : 0,
      can_approve_returns !== undefined ? (can_approve_returns ? 1 : 0) : 0,
      can_open_close_safe !== undefined ? (can_open_close_safe ? 1 : 0) : 0,
      can_transfer_funds !== undefined ? (can_transfer_funds ? 1 : 0) : 0,
      can_edit_products !== undefined ? (can_edit_products ? 1 : 0) : 0,
      can_delete_orders !== undefined ? (can_delete_orders ? 1 : 0) : 0,
      role
    );

    const updated = db.prepare("SELECT * FROM role_permissions WHERE role = ?").get(role);
    logAudit(user.id, user.name, "تعديل صلاحيات", `تم تعديل صلاحيات الدور: ${role}`);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
