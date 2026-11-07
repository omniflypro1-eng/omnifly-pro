import { db } from "./artifacts/api-server/src/lib/sqlite.js";

function migrate() {
  console.log("Starting database migration...");
  try {
    const tableInfo = db.prepare("PRAGMA table_info(website_settings)").all();
    const cols = tableInfo.map((c: any) => c.name);
    
    const needed = [
      "logo_url", "facebook_url", "twitter_url", "instagram_url", 
      "footer_text", "badge_text", "site_title", "topbar_announcement",
      "customer_service_name", "announcement_badge_1", "announcement_badge_2",
      "nav_subtitle", "hero_title_2", "hero_title_3", "secondary_phone",
      "currency", "social_handle", "topbar_text", "x_url"
    ];
    
    for (const col of needed) {
      if (!cols.includes(col)) {
        try {
          db.exec(`ALTER TABLE website_settings ADD COLUMN ${col} TEXT`);
          console.log(`Added column ${col} to website_settings`);
        } catch (e) {
          console.warn(`Could not add column ${col}:`, e);
        }
      }
    }
    
    // Ensure row 1 exists with defaults
    const count = (db.prepare("SELECT COUNT(*) as c FROM website_settings").get() as any).c;
    if (count === 0) {
      db.exec(`
        INSERT INTO website_settings (id, site_name, site_slogan) 
        VALUES (1, 'أكوان للسفريات والسياحة • Akwan Travel & Tourism', 'بوابتكم الذكية لحجوزات الطيران والفنادق والتأشيرات')
      `);
      console.log("Initialized website_settings with default row");
    }
    
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
