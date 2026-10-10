import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { requireLandlord } from "../middleware/auth.js";

const router = Router();

// GET /api/settings  (landlord profile + payment settings + notif prefs)
router.get("/", requireLandlord, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, email, phone, property_name, property_address,
              momo_network, momo_name, momo_number, payment_instructions,
              notif_new_tenant, notif_manual_momo, notif_confirmed_payment,
              notif_upcoming_charges, notif_overdue_charges
       FROM landlords WHERE id=$1`,
      [req.user.landlordId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Landlord not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PATCH /api/settings
router.patch("/", requireLandlord, async (req, res) => {
  const allowed = [
    "full_name","phone","property_name","property_address",
    "momo_network","momo_name","momo_number","payment_instructions",
    "notif_new_tenant","notif_manual_momo","notif_confirmed_payment",
    "notif_upcoming_charges","notif_overdue_charges"
  ];
  const fieldMap = {
    fullName:"full_name", propertyName:"property_name", propertyAddress:"property_address",
    momoNetwork:"momo_network", momoName:"momo_name", momoNumber:"momo_number",
    paymentInstructions:"payment_instructions",
    notifNewTenant:"notif_new_tenant", notifManualMomo:"notif_manual_momo",
    notifConfirmedPayment:"notif_confirmed_payment",
    notifUpcomingCharges:"notif_upcoming_charges", notifOverdueCharges:"notif_overdue_charges"
  };
  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, val] of Object.entries(req.body)) {
    const col = fieldMap[key] || key;
    if (allowed.includes(col)) {
      fields.push(col + "=$" + i++);
      values.push(val);
    }
  }
  if (req.body.newPassword) {
    fields.push("password_hash=$" + i++);
    values.push(await bcrypt.hash(req.body.newPassword, 12));
  }
  fields.push("updated_at=NOW()");
  values.push(req.user.landlordId);
  try {
    const { rows } = await pool.query(
      `UPDATE landlords SET ${fields.join(",")} WHERE id=$${i}
       RETURNING id, full_name, email, phone, property_name, property_address,
                 momo_network, momo_name, momo_number, payment_instructions,
                 notif_new_tenant, notif_manual_momo, notif_confirmed_payment,
                 notif_upcoming_charges, notif_overdue_charges`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "Landlord not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// GET /api/settings/billing-categories
router.get("/billing-categories", requireLandlord, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM billing_categories WHERE landlord_id=$1 ORDER BY created_at",
      [req.user.landlordId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch billing categories" });
  }
});

// POST /api/settings/billing-categories
router.post("/billing-categories", requireLandlord, async (req, res) => {
  const { name, description, billingFrequency, customIntervalMonths, defaultAmount, gracePeriodDays } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO billing_categories
         (landlord_id, name, description, billing_frequency, custom_interval_months, default_amount, grace_period_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        req.user.landlordId, name, description||"", billingFrequency,
        customIntervalMonths||null, defaultAmount||null, gracePeriodDays||7
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create billing category" });
  }
});

// PATCH /api/settings/billing-categories/:id
router.patch("/billing-categories/:id", requireLandlord, async (req, res) => {
  const { status } = req.body;
  try {
    const { rows } = await pool.query(
      "UPDATE billing_categories SET status=$1 WHERE id=$2 AND landlord_id=$3 RETURNING *",
      [status, req.params.id, req.user.landlordId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Category not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update billing category" });
  }
});

export default router;
