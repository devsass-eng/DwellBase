// Run once: node server/migrate.js
// Sets up DwellBase schema, platform settings, Super Admin, and initial landlord

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

    // Safe Alter statements to adapt existing tables
    await pool.query(`
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS landlord_code TEXT;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS one_time_fee NUMERIC(12,2) DEFAULT 500.00;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS payment_approved_at TIMESTAMPTZ;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS account_activated_at TIMESTAMPTZ;
      ALTER TABLE landlords ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT '';
      ALTER TABLE landlords ALTER COLUMN account_status SET DEFAULT 'Pending Payment';
      ALTER TABLE landlords ALTER COLUMN password_hash DROP NOT NULL;
    `);

    console.log("Schema created and updated successfully.");
  } catch (err) {
    console.error("Schema error:", err.message);
    throw err;
  }

  // ─── 1. Seed Platform Settings ─────────────────────────────────────────────
  const defaultSettings = [
    { key: "one_time_fee", value: "500.00", desc: "Standard one-time landlord account access fee in Ghana Cedis (GH₵)" },
    { key: "platform_name", value: "DwellBase", desc: "Platform branding name" },
    { key: "tagline", value: "Property Management Made Simple.", desc: "Platform official tagline" },
    { key: "contact_phone", value: "024 123 4567", desc: "Super Admin direct telephone for prospective landlord inquiries" },
    { key: "contact_email", value: "owner@dwellbase.com", desc: "Super Admin direct email address" },
    { key: "contact_momo_number", value: "054 400 4400", desc: "Direct Mobile Money transfer number for one-time fee" },
    { key: "contact_momo_name", value: "DwellBase Platform Owner", desc: "Registered name on Mobile Money account" },
    { key: "contact_instructions", value: "To obtain access to DwellBase, please contact the platform owner to arrange cash payment or direct Mobile Money transfer. After independent verification, your permanent account will be activated.", desc: "Instructions displayed to prospective landlords" }
  ];

  for (const s of defaultSettings) {
    const ex = await pool.query("SELECT key FROM platform_settings WHERE key = $1", [s.key]);
    if (ex.rows.length === 0) {
      await pool.query(
        "INSERT INTO platform_settings (key, value, description) VALUES ($1, $2, $3)",
        [s.key, s.value, s.desc]
      );
      console.log("Seeded platform setting:", s.key);
    }
  }

  // ─── 2. Seed Default Super Admin ───────────────────────────────────────────
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

  // ─── 3. Seed Default Landlord ──────────────────────────────────────────────
  const email = process.env.SEED_EMAIL || "admin@dwellbase.com";
  const password = process.env.SEED_PASSWORD || "Admin@1234";
  const fullName = process.env.SEED_NAME || "Property Manager";
  const propertyName = process.env.SEED_PROPERTY || "DwellBase Property";

  const existing = await pool.query("SELECT id, is_paid FROM landlords WHERE email=$1", [email]);
  let landlordId;
  if (existing.rows.length > 0) {
    landlordId = existing.rows[0].id;
    await pool.query(
      `UPDATE landlords 
       SET is_paid = true, account_status = 'Active', payment_approved_at = COALESCE(payment_approved_at, NOW()), account_activated_at = COALESCE(account_activated_at, NOW())
       WHERE id = $1`,
      [landlordId]
    );
    console.log("Landlord account updated to Paid & Active:", email);
  } else {
    const hash = await bcrypt.hash(password, 12);
    const res = await pool.query(
      `INSERT INTO landlords (
        landlord_code, full_name, email, password_hash, property_name, 
        one_time_fee, is_paid, payment_approved_at, account_activated_at, account_status
      ) VALUES ('LL-001', $1, $2, $3, $4, 500.00, true, NOW(), NOW(), 'Active') RETURNING id`,
      [fullName, email, hash, propertyName]
    );
    landlordId = res.rows[0].id;
    console.log("Created active landlord account:", email, "/ password:", password);
  }

  // Ensure default landlord has an approved one-time payment record
  const exPayment = await pool.query("SELECT id FROM landlord_access_payments WHERE landlord_id=$1", [landlordId]);
  if (exPayment.rows.length === 0) {
    await pool.query(
      `INSERT INTO landlord_access_payments (
        payment_id, landlord_id, landlord_name, landlord_email, amount, payment_method,
        date_received, external_reference, receipt_number, status, recorded_by, approved_by, approval_date, notes
      ) VALUES (
        'OTP-INITIAL-001', $1, $2, $3, 500.00, 'cash',
        CURRENT_DATE, 'INITIAL-PROVISION', 'REC-001', 'approved', 'Super Administrator', 'Super Administrator', NOW(), 'Initial setup demonstration landlord'
      )`,
      [landlordId, fullName, email]
    );
    console.log("Recorded approved initial one-time access payment for landlord");
  }

  // ─── 4. Seed Default Billing Categories ────────────────────────────────────
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
