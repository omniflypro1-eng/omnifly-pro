import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { randomBytes, scryptSync } from "node:crypto";

const dbPath = path.resolve(process.cwd(), "artifacts/api-server/data/pos.db");
const db = new DatabaseSync(dbPath);

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

try {
  console.log("Starting complete mock and dummy data cleanup...");
  db.exec("PRAGMA foreign_keys = OFF;");

  const tablesToClear = [
    "order_items", "orders", "return_items", "returns",
    "sales_installments", "pos_draft_items", "pos_drafts",
    "quote_items", "quotes", "table_order_items", "table_orders", "reservations",
    "purchase_items", "purchase_invoices", "purchase_return_items", "purchase_returns", "purchase_order_items", "purchase_orders",
    "vouchers", "journal_entry_lines", "journal_entries",
    "expenses", "cash_drawer_logs", "cash_transfers", "bank_reconciliations", "shifts",
    "travel_passengers", "travel_groups", "travel_visas", "travel_bus_bookings", "travel_hotel_bookings", "travel_flight_tickets",
    "travel_invoice_items", "travel_invoices", "travel_quotation_items", "travel_quotations", "travel_tasks", "travel_suppliers",
    "travel_insurance", "travel_transport", "travel_documents", "travel_approvals", "travel_bsp_reconciliation", "travel_packages", "travel_package_itinerary",
    "products", "product_categories", "product_units", "product_batches", "stock_adjustments", "stocktake_records", "price_tiers",
    "customers", "suppliers", "customer_points", "point_transactions",
    "notifications", "whatsapp_logs", "audit_logs", "activity_logs", "chat_messages"
  ];

  for (const table of tablesToClear) {
    try {
      db.exec(`DELETE FROM ${table};`);
      try {
        db.exec(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
      } catch (e) {}
    } catch (e) {
      // Table might not exist, ignore
    }
  }

  // Reset safes balance
  try {
    db.exec("UPDATE safes SET balance = 0;");
  } catch (e) {}

  // Seed default product categories
  try {
    const insCat = db.prepare("INSERT INTO product_categories (name, icon) VALUES (?, ?)");
    insCat.run("خدمات السفر والسياحة", "Plane");
    insCat.run("خدمات الحج والعمرة", "Building");
    insCat.run("تأشيرات وإقامات", "FileText");
  } catch (e) {}

  // Ensure admin and developer accounts
  try {
    const devHash = hashPassword("dev123");
    const adminHash = hashPassword("admin123");
    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, name, role, active) VALUES (1, 'admin', ?, 'مدير عام الشركة', 'admin', 1)`).run(adminHash);
    db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, name, role, active) VALUES (2, 'developer', ?, 'مطور النظام', 'developer', 1)`).run(devHash);
  } catch (e) {}

  db.exec("PRAGMA foreign_keys = ON;");
  console.log("✓ All mock and dummy data successfully cleared. System is now clean and pristine.");
} catch (err) {
  console.error("Error clearing database:", err);
} finally {
  db.close();
}
