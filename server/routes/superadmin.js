import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
import { requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

// All routes here require Super Admin authentication
router.use(requireSuperAdmin);

// Helper function to log super admin audit events
async function logSuperAdminAction(req, action, landlordId, landlordName, details = {}, notes = "") {
  try {
    const adminId = req.user.superAdminId || req.user.id;
    const adminName = req.user.fullName || "Super Admin";
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
    await pool.query(
      `INSERT INTO super_admin_audit_logs (super_admin_id, super_admin_name, action, landlord_id, landlord_name, details, notes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [adminId, adminName, action, landlordId, landlordName, JSON.stringify(details), notes, ip]
    );
  } catch (err) {
    console.error("Failed to log super admin audit action:", err);
  }
}

// ─── GET /api/superadmin/stats ───────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const totalLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords");
    const activeLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Active'");
    const suspendedLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Suspended'");
    const pendingLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Pending Activation'");
    const expiredLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE subscription_end_date < CURRENT_DATE OR account_status = 'Expired'");
    const totalRoomsRes = await pool.query("SELECT COUNT(*) FROM rooms");
    const totalTenantsRes = await pool.query("SELECT COUNT(*) FROM tenants");
    const totalChargesRes = await pool.query("SELECT COALESCE(SUM(amount), 0) as total_charged, COALESCE(SUM(amount_paid), 0) as total_collected FROM charges");

    res.json({
      totalLandlords: parseInt(totalLandlordsRes.rows[0].count),
      activeLandlords: parseInt(activeLandlordsRes.rows[0].count),
      suspendedLandlords: parseInt(suspendedLandlordsRes.rows[0].count),
      pendingLandlords: parseInt(pendingLandlordsRes.rows[0].count),
      expiredLandlords: parseInt(expiredLandlordsRes.rows[0].count),
      totalRooms: parseInt(totalRoomsRes.rows[0].count),
      totalTenants: parseInt(totalTenantsRes.rows[0].count),
      totalCharged: parseFloat(totalChargesRes.rows[0].total_charged),
      totalCollected: parseFloat(totalChargesRes.rows[0].total_collected),
    });
  } catch (err) {
    console.error("Error fetching superadmin stats:", err);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
});

// ─── GET /api/superadmin/landlords ───────────────────────────────────────────
router.get("/landlords", async (req, res) => {
  try {
    const query = `
      SELECT 
        l.id,
        l.full_name,
        l.email,
        l.phone,
        l.property_name,
        l.property_address,
        l.subscription_plan,
        l.subscription_duration_months,
        l.subscription_start_date,
        l.subscription_end_date,
        l.account_status,
        l.created_at,
        l.updated_at,
        COUNT(DISTINCT r.id) as room_count,
        COUNT(DISTINCT t.id) as tenant_count,
        COUNT(DISTINCT CASE WHEN t.tenancy_status = 'Active' THEN t.id END) as active_tenant_count,
        COALESCE(SUM(DISTINCT c.amount), 0) as total_billed,
        COALESCE(SUM(DISTINCT p.amount) FILTER (WHERE p.status = 'successful'), 0) as total_paid
      FROM landlords l
      LEFT JOIN rooms r ON r.landlord_id = l.id
      LEFT JOIN tenants t ON t.landlord_id = l.id
      LEFT JOIN charges c ON c.landlord_id = l.id
      LEFT JOIN payments p ON p.landlord_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query);

    // Compute dynamic status (e.g. check if expired by date)
    const landlords = result.rows.map(row => {
      let computedStatus = row.account_status;
      if (row.account_status === "Active" && row.subscription_end_date) {
        const endDate = new Date(row.subscription_end_date);
        const today = new Date();
        if (endDate < today) {
          computedStatus = "Expired";
        }
      }
      return {
        ...row,
        room_count: parseInt(row.room_count || 0),
        tenant_count: parseInt(row.tenant_count || 0),
        active_tenant_count: parseInt(row.active_tenant_count || 0),
        total_billed: parseFloat(row.total_billed || 0),
        total_paid: parseFloat(row.total_paid || 0),
        computedStatus,
      };
    });

    res.json(landlords);
  } catch (err) {
    console.error("Error fetching landlords:", err);
    res.status(500).json({ error: "Failed to fetch landlords list" });
  }
});

// ─── GET /api/superadmin/landlords/:id ───────────────────────────────────────
router.get("/landlords/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const landlordRes = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (landlordRes.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const { password_hash, ...landlord } = landlordRes.rows[0];

    const roomsRes = await pool.query(
      "SELECT id, room_number, room_code, monthly_rent, status FROM rooms WHERE landlord_id = $1 ORDER BY sequence_number ASC",
      [id]
    );
    const tenantsRes = await pool.query(
      "SELECT id, tenant_id, full_name, phone, email, room_number, monthly_rent, start_date, end_date, outstanding_balance, tenancy_status, account_status FROM tenants WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );
    const recentPaymentsRes = await pool.query(
      "SELECT id, reference_number, tenant_name, room_number, category_name, amount, payment_method, payment_date, status FROM payments WHERE landlord_id = $1 ORDER BY created_at DESC LIMIT 10",
      [id]
    );
    const historyRes = await pool.query(
      "SELECT * FROM super_admin_audit_logs WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );

    res.json({
      landlord,
      rooms: roomsRes.rows,
      tenants: tenantsRes.rows,
      recentPayments: recentPaymentsRes.rows,
      history: historyRes.rows,
    });
  } catch (err) {
    console.error("Error fetching landlord details:", err);
    res.status(500).json({ error: "Failed to fetch landlord details" });
  }
});

// ─── POST /api/superadmin/landlords ──────────────────────────────────────────
router.post("/landlords", async (req, res) => {
  const {
    fullName,
    email,
    password,
    phone,
    propertyName,
    propertyAddress,
    subscriptionPlan = "Standard",
    subscriptionDurationMonths = 12,
    subscriptionStartDate,
    accountStatus = "Active",
    notes = "",
  } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ error: "Full name and email are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const exists = await client.query("SELECT id FROM landlords WHERE email = $1", [email.trim().toLowerCase()]);
    if (exists.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "A landlord with this email already exists" });
    }

    const rawPassword = password && password.trim() ? password.trim() : "DwellBase@" + Math.floor(1000 + Math.random() * 9000);
    const hash = await bcrypt.hash(rawPassword, 12);

    const startDate = subscriptionStartDate ? new Date(subscriptionStartDate) : new Date();
    const duration = parseInt(subscriptionDurationMonths) || 12;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + duration);

    const result = await client.query(
      `INSERT INTO landlords (
        full_name, email, password_hash, phone, property_name, property_address,
        subscription_plan, subscription_duration_months, subscription_start_date, subscription_end_date,
        account_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, full_name, email, phone, property_name, property_address, subscription_plan, subscription_duration_months, subscription_start_date, subscription_end_date, account_status, created_at`,
      [
        fullName.trim(),
        email.trim().toLowerCase(),
        hash,
        phone || "",
        propertyName || "DwellBase Property",
        propertyAddress || "",
        subscriptionPlan,
        duration,
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
        accountStatus,
      ]
    );

    const newLandlord = result.rows[0];

    // Seed default billing categories for the new landlord
    const defaultCategories = [
      { name: "Rent", desc: "Monthly/Yearly room rent", freq: "yearly", grace: 7 },
      { name: "Light Bill", desc: "Electricity charges", freq: "monthly", grace: 7 },
      { name: "Water Bill", desc: "Water supply charges", freq: "monthly", grace: 7 },
    ];
    for (const cat of defaultCategories) {
      await client.query(
        `INSERT INTO billing_categories (landlord_id, name, description, billing_frequency, is_default, grace_period_days)
         VALUES ($1, $2, $3, $4, true, $5)`,
        [newLandlord.id, cat.name, cat.desc, cat.freq, cat.grace]
      );
    }

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "CREATE_LANDLORD",
      newLandlord.id,
      newLandlord.full_name,
      {
        email: newLandlord.email,
        plan: newLandlord.subscription_plan,
        duration: newLandlord.subscription_duration_months,
        status: newLandlord.account_status,
      },
      notes || "Landlord account created manually by Super Admin"
    );

    res.status(201).json({
      landlord: newLandlord,
      initialPassword: rawPassword,
      message: "Landlord created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error creating landlord:", err);
    res.status(500).json({ error: "Failed to create landlord account: " + err.message });
  } finally {
    client.release();
  }
});

// ─── PATCH /api/superadmin/landlords/:id ─────────────────────────────────────
router.patch("/landlords/:id", async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, propertyName, propertyAddress, notes } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    const fields = [];
    const values = [];
    let idx = 1;

    if (fullName !== undefined) { fields.push(`full_name = $${idx++}`); values.push(fullName.trim()); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email.trim().toLowerCase()); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone.trim()); }
    if (propertyName !== undefined) { fields.push(`property_name = $${idx++}`); values.push(propertyName.trim()); }
    if (propertyAddress !== undefined) { fields.push(`property_address = $${idx++}`); values.push(propertyAddress.trim()); }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE landlords SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING id, full_name, email, phone, property_name, property_address, subscription_plan, account_status, updated_at
    `;
    const result = await pool.query(updateQuery, values);
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "EDIT_LANDLORD",
      updated.id,
      updated.full_name,
      { before: { fullName: current.full_name, email: current.email, phone: current.phone }, after: { fullName: updated.full_name, email: updated.email, phone: updated.phone } },
      notes || "Updated landlord profile details"
    );

    res.json({ landlord: updated, message: "Landlord updated successfully" });
  } catch (err) {
    console.error("Error updating landlord:", err);
    res.status(500).json({ error: "Failed to update landlord" });
  }
});

// ─── POST /api/superadmin/landlords/:id/activate ────────────────────────────
router.post("/landlords/:id/activate", async (req, res) => {
  const { id } = req.params;
  const { notes = "" } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    const result = await pool.query(
      "UPDATE landlords SET account_status = 'Active', updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, account_status",
      [id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "ACTIVATE_ACCOUNT",
      updated.id,
      updated.full_name,
      { previousStatus: current.account_status, newStatus: "Active" },
      notes || "Activated landlord account after payment verification"
    );

    res.json({ landlord: updated, message: `Account for ${updated.full_name} has been activated.` });
  } catch (err) {
    console.error("Error activating landlord:", err);
    res.status(500).json({ error: "Failed to activate landlord account" });
  }
});

// ─── POST /api/superadmin/landlords/:id/suspend ─────────────────────────────
router.post("/landlords/:id/suspend", async (req, res) => {
  const { id } = req.params;
  const { reason = "", notes = "" } = req.body;

  if (!reason.trim()) {
    return res.status(400).json({ error: "A suspension reason is required for safety and audit purposes" });
  }

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    const result = await pool.query(
      "UPDATE landlords SET account_status = 'Suspended', updated_at = NOW() WHERE id = $1 RETURNING id, full_name, email, account_status",
      [id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "SUSPEND_ACCOUNT",
      updated.id,
      updated.full_name,
      { previousStatus: current.account_status, newStatus: "Suspended", reason },
      notes ? `${reason} — ${notes}` : reason
    );

    res.json({
      landlord: updated,
      message: `Account for ${updated.full_name} has been suspended. All records remain preserved.`,
    });
  } catch (err) {
    console.error("Error suspending landlord:", err);
    res.status(500).json({ error: "Failed to suspend landlord account" });
  }
});

// ─── POST /api/superadmin/landlords/:id/renew ───────────────────────────────
router.post("/landlords/:id/renew", async (req, res) => {
  const { id } = req.params;
  const { months = 12, notes = "" } = req.body;

  const extensionMonths = parseInt(months) || 12;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    // Determine new end date: extend from current end date or from today if past
    let baseDate = current.subscription_end_date ? new Date(current.subscription_end_date) : new Date();
    const today = new Date();
    if (baseDate < today) {
      baseDate = today;
    }
    baseDate.setMonth(baseDate.getMonth() + extensionMonths);
    const newEndDateStr = baseDate.toISOString().split("T")[0];

    const result = await pool.query(
      `UPDATE landlords 
       SET subscription_end_date = $1, 
           subscription_duration_months = subscription_duration_months + $2,
           account_status = 'Active',
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING id, full_name, email, subscription_plan, subscription_end_date, account_status`,
      [newEndDateStr, extensionMonths, id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "RENEW_SUBSCRIPTION",
      updated.id,
      updated.full_name,
      {
        previousEndDate: current.subscription_end_date,
        newEndDate: updated.subscription_end_date,
        extensionMonths,
      },
      notes || `Renewed subscription by ${extensionMonths} months after manual payment confirmation`
    );

    res.json({
      landlord: updated,
      message: `Subscription renewed successfully until ${newEndDateStr}.`,
    });
  } catch (err) {
    console.error("Error renewing subscription:", err);
    res.status(500).json({ error: "Failed to renew subscription" });
  }
});

// ─── POST /api/superadmin/landlords/:id/change-plan ─────────────────────────
router.post("/landlords/:id/change-plan", async (req, res) => {
  const { id } = req.params;
  const { plan, durationMonths, notes = "" } = req.body;

  const validPlans = ["Starter", "Standard", "Pro", "Enterprise"];
  if (!plan || !validPlans.includes(plan)) {
    return res.status(400).json({ error: `Valid plan is required (${validPlans.join(", ")})` });
  }

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    const duration = durationMonths ? parseInt(durationMonths) : current.subscription_duration_months;

    const result = await pool.query(
      `UPDATE landlords 
       SET subscription_plan = $1, 
           subscription_duration_months = $2,
           updated_at = NOW() 
       WHERE id = $3 
       RETURNING id, full_name, email, subscription_plan, subscription_duration_months, account_status`,
      [plan, duration, id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "CHANGE_PLAN",
      updated.id,
      updated.full_name,
      {
        previousPlan: current.subscription_plan,
        newPlan: updated.subscription_plan,
        duration,
      },
      notes || `Changed subscription plan from ${current.subscription_plan} to ${updated.subscription_plan}`
    );

    res.json({
      landlord: updated,
      message: `Plan changed to ${updated.subscription_plan} successfully.`,
    });
  } catch (err) {
    console.error("Error changing plan:", err);
    res.status(500).json({ error: "Failed to change subscription plan" });
  }
});

// ─── POST /api/superadmin/landlords/:id/reset-access ────────────────────────
router.post("/landlords/:id/reset-access", async (req, res) => {
  const { id } = req.params;
  const { temporaryPassword, notes = "" } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiration

    let newTempPassword = temporaryPassword;
    if (temporaryPassword && temporaryPassword.trim()) {
      const hash = await bcrypt.hash(temporaryPassword.trim(), 12);
      await pool.query(
        "UPDATE landlords SET password_hash = $1, reset_token = $2, reset_token_expires_at = $3, updated_at = NOW() WHERE id = $4",
        [hash, resetToken, expiresAt, id]
      );
    } else {
      newTempPassword = "DwellReset@" + Math.floor(1000 + Math.random() * 9000);
      const hash = await bcrypt.hash(newTempPassword, 12);
      await pool.query(
        "UPDATE landlords SET password_hash = $1, reset_token = $2, reset_token_expires_at = $3, updated_at = NOW() WHERE id = $4",
        [hash, resetToken, expiresAt, id]
      );
    }

    const resetLink = `${req.protocol}://${req.get("host")}/admin/login?reset_token=${resetToken}`;

    await logSuperAdminAction(
      req,
      "RESET_ACCESS",
      current.id,
      current.full_name,
      { tokenGenerated: true, expiresAt },
      notes || "Generated secure password reset and temporary credentials"
    );

    res.json({
      message: "Access reset generated successfully",
      temporaryPassword: newTempPassword,
      resetToken,
      resetLink,
      expiresAt,
    });
  } catch (err) {
    console.error("Error resetting access:", err);
    res.status(500).json({ error: "Failed to reset landlord access" });
  }
});

// ─── GET /api/superadmin/landlords/:id/history ──────────────────────────────
router.get("/landlords/:id/history", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM super_admin_audit_logs WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching landlord history:", err);
    res.status(500).json({ error: "Failed to fetch landlord history" });
  }
});

// ─── GET /api/superadmin/audit-logs ──────────────────────────────────────────
router.get("/audit-logs", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM super_admin_audit_logs ORDER BY created_at DESC LIMIT 200"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
