import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "artifacts/api-server/data/pos.db");
const db = new DatabaseSync(dbPath);

try {
  console.log("Resetting all safe and cash drawer balances to zero...");
  db.exec("UPDATE safes SET balance = 0, actual_balance = 0, opening_balance = 0;");
  db.exec("UPDATE cash_drawer_logs SET balance = 0;");
  console.log("✓ All safe balances reset to zero.");
} catch (err) {
  console.error("Error resetting balances:", err);
} finally {
  db.close();
}
