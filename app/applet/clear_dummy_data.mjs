import { resetEntireDatabase } from "./artifacts/api-server/lib/sqlite.js";

try {
  console.log("Starting database factory reset to clear all mock/dummy data...");
  const result = resetEntireDatabase();
  console.log("Database reset completed successfully:", result);
} catch (err) {
  console.error("Error resetting database:", err);
}
