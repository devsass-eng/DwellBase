// Run once: node server/migrate.js
// Seeds default billing categories for the landlord account

import pool from "./db.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  console.log("Running DwellBase database migration...");
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  
  try {
    await pool.query(sql);
    // Alter existing tables if needed for smooth upgrades
    await pool.query(`
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'Standard';
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS subscription_duration_months INTEGER DEFAULT 12;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS subscription_start_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS subscription_end_date DATE DEFAULT (CURRENT_DATE + INTERVAL '12 months');
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'Active';
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS reset_token TEXT;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;
    `);
    console.log("Schema created and updated successfully.");
  } catch (err) {
    console.error("Schema error:", err.message);
    throw err;
  }

  // ─── Seed Default Super Admin ──────────────────────────────────────────────
  const superEmail = process.env.SUPERADMIN_EMAIL || "superadmin@dwellbase.com";
  const superPassword = process.env.SUPERADMIN_PASSWORD || "SuperAdmin@1234";
  const superFullName = process.env.SUPERADMIN_NAME || "System Super Administrator";

  const existingSuper = await pool.query("SELECT id FROM super_admins WHERE email=$1", [superEmail]);
  if (existingSuper.rows.length === 0) {
    const superHash = await bcrypt.hash(superPassword, 12);
    await pool.query(
      "INSERT INTO super_admins (full_name, email, password_hash) VALUES ($1,$2,$3)",
      [superFullName, superEmail, superHash]
    );
    console.log("Created Super Admin account:", superEmail, "/ password:", superPassword);
  } else {
    console.log("Super Admin account already exists:", superEmail);
  }

  // Create default landlord account if SEED_EMAIL is set
  const email = process.env.SEED_EMAIL || "admin@dwellbase.com";
  const password = process.env.SEED_PASSWORD || "Admin@1234";
  const fullName = process.env.SEED_NAME || "Property Manager";
  const propertyName = process.env.SEED_PROPERTY || "DwellBase Property";

  const existing = await pool.query("SELECT id FROM landlords WHERE email=$1", [email]);
  let landlordId;
  if (existing.rows.length > 0) {
    landlordId = existing.rows[0].id;
    console.log("Landlord account already exists:", email);
  } else {
    const hash = await bcrypt.hash(password, 12);
    const res = await pool.query(
      `INSERT INTO landlords (full_name, email, password_hash, property_name, subscription_plan, subscription_duration_months, account_status)
       VALUES ($1,$2,$3,$4,'Standard',12,'Active') RETURNING id`,
      [fullName, email, hash, propertyName]
    );
    landlordId = res.rows[0].id;
    console.log("Created landlord account:", email, "/ password:", password);
  }

  // Seed default billing categories
  const cats = [
    { name: "Rent", description: "Monthly/Yearly room rent", freq: "yearly", grace: 7 },
    { name: "Light Bill", description: "Electricity charges", freq: "monthly", grace: 7 },
    { name: "Water Bill", description: "Water supply charges", freq: "monthly", grace: 7 },
  ];
  for (const cat of cats) {
    const ex = await pool.query(
      "SELECT id FROM billing_categories WHERE landlord_id=$1 AND name=$2",
      [landlordId, cat.name]
    );
    if (ex.rows.length === 0) {
      await pool.query(
        "INSERT INTO billing_categories (landlord_id, name, description, billing_frequency, is_default, grace_period_days) VALUES ($1,$2,$3,$4,true,$5)",
        [landlordId, cat.name, cat.description, cat.freq, cat.grace]
      );
      console.log("Added default category:", cat.name);
    }
  }

  console.log("Migration complete!");
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
