import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pool from "../db.js";
import { requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

// All routes here require Super Admin authentication
router.use(requireSuperAdmin);

// Helper to log super admin audit events
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

// Helper to generate a secure activation token
async function generateActivationToken(landlordId) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72); // 72 hours expiration

  await pool.query(
    `INSERT INTO landlord_activation_tokens (landlord_id, token_hash, raw_token, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [landlordId, tokenHash, rawToken, expiresAt]
  );

  return { rawToken, expiresAt };
}

// ─── GET /api/superadmin/stats ───────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const totalLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords");
    const activeLandlordsRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Active'");
    const pendingPaymentRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Pending Payment'");
    const pendingActivationRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Pending Activation'");
    const suspendedRes = await pool.query("SELECT COUNT(*) FROM landlords WHERE account_status = 'Suspended'");

    // Total approved one-time collections ONLY (excludes pending, rejected, reversed)
    const totalCollectionsRes = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM landlord_access_payments WHERE status = 'approved'"
    );

    const totalRoomsRes = await pool.query("SELECT COUNT(*) FROM rooms");
    const totalTenantsRes = await pool.query("SELECT COUNT(*) FROM tenants");

    const recentLandlordsRes = await pool.query(
      "SELECT id, landlord_code, full_name, email, phone, property_name, is_paid, account_status, created_at FROM landlords ORDER BY created_at DESC LIMIT 5"
    );

    const recentPaymentsRes = await pool.query(
      "SELECT id, payment_id, landlord_id, landlord_name, amount, payment_method, date_received, status, created_at FROM landlord_access_payments ORDER BY created_at DESC LIMIT 5"
    );

    const recentAuditRes = await pool.query(
      "SELECT * FROM super_admin_audit_logs ORDER BY created_at DESC LIMIT 5"
    );

    res.json({
      totalLandlords: parseInt(totalLandlordsRes.rows[0].count),
      activeLandlords: parseInt(activeLandlordsRes.rows[0].count),
      pendingPayment: parseInt(pendingPaymentRes.rows[0].count),
      pendingActivation: parseInt(pendingActivationRes.rows[0].count),
      suspendedAccounts: parseInt(suspendedRes.rows[0].count),
      totalApprovedCollections: parseFloat(totalCollectionsRes.rows[0].total),
      totalRooms: parseInt(totalRoomsRes.rows[0].count),
      totalTenants: parseInt(totalTenantsRes.rows[0].count),
      recentLandlords: recentLandlordsRes.rows,
      recentPayments: recentPaymentsRes.rows,
      recentAudit: recentAuditRes.rows,
    });
  } catch (err) {
    console.error("Error fetching superadmin stats:", err);
    res.status(500).json({ error: "Failed to fetch platform statistics" });
  }
});

// ─── GET /api/superadmin/landlords ───────────────────────────────────────────
router.get("/landlords", async (req, res) => {
  try {
    const query = `
      SELECT 
        l.id,
        l.landlord_code,
        l.full_name,
        l.email,
        l.phone,
        l.property_name,
        l.property_address,
        l.one_time_fee,
        l.is_paid,
        l.payment_approved_at,
        l.account_activated_at,
        l.account_status,
        l.suspension_reason,
        l.created_at,
        l.updated_at,
        COUNT(DISTINCT r.id) as room_count,
        COUNT(DISTINCT t.id) as tenant_count,
        (
          SELECT json_build_object(
            'id', p.id,
            'payment_id', p.payment_id,
            'amount', p.amount,
            'payment_method', p.payment_method,
            'date_received', p.date_received,
            'status', p.status,
            'approval_date', p.approval_date,
            'external_reference', p.external_reference
          )
          FROM landlord_access_payments p 
          WHERE p.landlord_id = l.id 
          ORDER BY p.created_at DESC LIMIT 1
        ) as latest_payment
      FROM landlords l
      LEFT JOIN rooms r ON r.landlord_id = l.id
      LEFT JOIN tenants t ON t.landlord_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `;
    const result = await pool.query(query);

    const landlords = result.rows.map(row => ({
      ...row,
      room_count: parseInt(row.room_count || 0),
      tenant_count: parseInt(row.tenant_count || 0),
      one_time_fee: parseFloat(row.one_time_fee || 500.00),
    }));

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
      "SELECT id, sequence_number, room_number, room_code, monthly_rent, status FROM rooms WHERE landlord_id = $1 ORDER BY sequence_number ASC",
      [id]
    );

    const tenantsRes = await pool.query(
      "SELECT id, tenant_id, full_name, phone, email, room_number, monthly_rent, start_date, end_date, outstanding_balance, tenancy_status, account_status FROM tenants WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const paymentsRes = await pool.query(
      "SELECT * FROM landlord_access_payments WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const historyRes = await pool.query(
      "SELECT * FROM super_admin_audit_logs WHERE landlord_id = $1 ORDER BY created_at DESC",
      [id]
    );

    const tokensRes = await pool.query(
      "SELECT id, raw_token, expires_at, used_at, created_at FROM landlord_activation_tokens WHERE landlord_id = $1 ORDER BY created_at DESC LIMIT 5",
      [id]
    );

    res.json({
      landlord,
      rooms: roomsRes.rows,
      tenants: tenantsRes.rows,
      payments: paymentsRes.rows,
      history: historyRes.rows,
      activationTokens: tokensRes.rows,
    });
  } catch (err) {
    console.error("Error fetching landlord details:", err);
    res.status(500).json({ error: "Failed to fetch landlord details" });
  }
});

// ─── POST /api/superadmin/landlords (Manual Creation) ───────────────────────
router.post("/landlords", async (req, res) => {
  const {
    fullName,
    email,
    phone,
    propertyName,
    propertyAddress,
    oneTimeFee,
    paymentReceived,
    paymentMethod = "cash",
    dateReceived,
    externalReference = "",
    receiptNumber = "",
    notes = "",
    autoApprove = false,
  } = req.body;

  if (!fullName || !email) {
    return res.status(400).json({ error: "Full name and email are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Prevent duplicate email accounts
    const exists = await client.query("SELECT id FROM landlords WHERE email = $1", [email.trim().toLowerCase()]);
    if (exists.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "A landlord account with this email already exists" });
    }

    // Generate unique landlord code
    const countRes = await client.query("SELECT COUNT(*) FROM landlords");
    const nextNum = parseInt(countRes.rows[0].count) + 1;
    const landlordCode = `LL-${String(nextNum).padStart(3, "0")}`;

    // Fee setup
    const fee = oneTimeFee ? parseFloat(oneTimeFee) : 500.00;
    const isPaid = !!(paymentReceived && autoApprove);
    const initialStatus = isPaid ? "Active" : paymentReceived ? "Pending Activation" : "Pending Payment";

    // Insert landlord record
    const landlordRes = await client.query(
      `INSERT INTO landlords (
        landlord_code, full_name, email, phone, property_name, property_address,
        one_time_fee, is_paid, payment_approved_at, account_activated_at, account_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, landlord_code, full_name, email, phone, property_name, property_address, one_time_fee, is_paid, account_status, created_at`,
      [
        landlordCode,
        fullName.trim(),
        email.trim().toLowerCase(),
        phone || "",
        propertyName || "DwellBase Property",
        propertyAddress || "",
        fee,
        isPaid,
        isPaid ? new Date() : null,
        isPaid ? new Date() : null,
        initialStatus,
      ]
    );
    const newLandlord = landlordRes.rows[0];

    // If payment was received, record it
    let paymentRecord = null;
    if (paymentReceived) {
      const paymentDate = dateReceived ? new Date(dateReceived) : new Date();
      const paymentId = `OTP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const pStatus = autoApprove ? "approved" : "pending_verification";
      const adminName = req.user.fullName || "Super Admin";

      const pRes = await client.query(
        `INSERT INTO landlord_access_payments (
          payment_id, landlord_id, landlord_name, landlord_email, amount, payment_method,
          date_received, external_reference, receipt_number, status, recorded_by, approved_by, approval_date, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          paymentId,
          newLandlord.id,
          newLandlord.full_name,
          newLandlord.email,
          fee,
          paymentMethod,
          paymentDate.toISOString().split("T")[0],
          externalReference,
          receiptNumber,
          pStatus,
          adminName,
          autoApprove ? adminName : null,
          autoApprove ? new Date() : null,
          notes || (autoApprove ? "Payment received and approved during manual creation" : "Payment recorded awaiting verification"),
        ]
      );
      paymentRecord = pRes.rows[0];
    }

    // Seed default billing categories for the landlord's workspace
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

    // If activated, generate single-use activation token
    let activationData = null;
    if (initialStatus === "Active") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      await client.query(
        `INSERT INTO landlord_activation_tokens (landlord_id, token_hash, raw_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [newLandlord.id, tokenHash, rawToken, expiresAt]
      );

      const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      activationData = {
        token: rawToken,
        activationLink: `${origin}/activate?token=${rawToken}`,
        expiresAt,
      };
    }

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "CREATE_LANDLORD",
      newLandlord.id,
      newLandlord.full_name,
      {
        landlordCode: newLandlord.landlord_code,
        email: newLandlord.email,
        fee: newLandlord.one_time_fee,
        status: newLandlord.account_status,
        paymentRecorded: !!paymentReceived,
      },
      notes || `Landlord created by Super Admin (Status: ${newLandlord.account_status})`
    );

    res.status(201).json({
      landlord: newLandlord,
      payment: paymentRecord,
      activation: activationData,
      message: `Landlord account ${newLandlord.landlord_code} created successfully.`,
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
      return res.status(400).json({ error: "No profile fields provided to update" });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE landlords SET ${fields.join(", ")}
      WHERE id = $${idx}
      RETURNING id, landlord_code, full_name, email, phone, property_name, property_address, account_status, is_paid, updated_at
    `;
    const result = await pool.query(updateQuery, values);
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "EDIT_LANDLORD",
      updated.id,
      updated.full_name,
      { before: { fullName: current.full_name, email: current.email, phone: current.phone }, after: { fullName: updated.full_name, email: updated.email, phone: updated.phone } },
      notes || "Updated landlord profile information"
    );

    res.json({ landlord: updated, message: "Landlord profile updated successfully." });
  } catch (err) {
    console.error("Error updating landlord:", err);
    res.status(500).json({ error: "Failed to update landlord profile" });
  }
});

// ─── POST /api/superadmin/landlords/:id/activate ────────────────────────────
router.post("/landlords/:id/activate", async (req, res) => {
  const { id } = req.params;
  const { notes = "" } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    // Approve any pending access payment if exists
    const pendingPayment = await client.query(
      "SELECT id FROM landlord_access_payments WHERE landlord_id = $1 AND status = 'pending_verification' ORDER BY created_at DESC LIMIT 1",
      [id]
    );
    if (pendingPayment.rows.length > 0) {
      const adminName = req.user.fullName || "Super Admin";
      await client.query(
        "UPDATE landlord_access_payments SET status = 'approved', approved_by = $1, approval_date = NOW(), updated_at = NOW() WHERE id = $2",
        [adminName, pendingPayment.rows[0].id]
      );
    }

    const result = await client.query(
      `UPDATE landlords 
       SET is_paid = true, 
           payment_approved_at = COALESCE(payment_approved_at, NOW()),
           account_activated_at = COALESCE(account_activated_at, NOW()),
           account_status = 'Active',
           suspension_reason = '',
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, landlord_code, full_name, email, is_paid, account_status, account_activated_at`,
      [id]
    );
    const updated = result.rows[0];

    // Generate activation token if landlord has no password set yet
    let activationData = null;
    if (!current.password_hash) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      await client.query(
        `INSERT INTO landlord_activation_tokens (landlord_id, token_hash, raw_token, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [id, tokenHash, rawToken, expiresAt]
      );

      const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
      activationData = {
        token: rawToken,
        activationLink: `${origin}/activate?token=${rawToken}`,
        expiresAt,
      };
    }

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "ACTIVATE_ACCOUNT",
      updated.id,
      updated.full_name,
      { previousStatus: current.account_status, newStatus: "Active", isPaid: true },
      notes || "Account activated after one-time payment verification"
    );

    res.json({
      landlord: updated,
      activation: activationData,
      message: `Account for ${updated.full_name} has been activated with permanent access.`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error activating landlord:", err);
    res.status(500).json({ error: "Failed to activate landlord account" });
  } finally {
    client.release();
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
      `UPDATE landlords 
       SET account_status = 'Suspended', 
           suspension_reason = $1, 
           updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, landlord_code, full_name, email, account_status, suspension_reason`,
      [reason.trim(), id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "SUSPEND_ACCOUNT",
      updated.id,
      updated.full_name,
      { previousStatus: current.account_status, newStatus: "Suspended", reason: reason.trim() },
      notes ? `${reason.trim()} — ${notes}` : reason.trim()
    );

    res.json({
      landlord: updated,
      message: `Account for ${updated.full_name} has been suspended. All records remain safely preserved.`,
    });
  } catch (err) {
    console.error("Error suspending landlord:", err);
    res.status(500).json({ error: "Failed to suspend landlord account" });
  }
});

// ─── POST /api/superadmin/landlords/:id/reactivate ───────────────────────────
router.post("/landlords/:id/reactivate", async (req, res) => {
  const { id } = req.params;
  const { notes = "" } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    if (current.account_status !== "Suspended") {
      return res.status(400).json({ error: "Account is not currently suspended" });
    }

    const result = await pool.query(
      `UPDATE landlords 
       SET account_status = 'Active', 
           suspension_reason = '', 
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, landlord_code, full_name, email, account_status`,
      [id]
    );
    const updated = result.rows[0];

    await logSuperAdminAction(
      req,
      "REACTIVATE_ACCOUNT",
      updated.id,
      updated.full_name,
      { previousStatus: "Suspended", newStatus: "Active" },
      notes || "Account reactivated by Super Admin without additional fee"
    );

    res.json({
      landlord: updated,
      message: `Account for ${updated.full_name} has been reactivated. Access restored.`,
    });
  } catch (err) {
    console.error("Error reactivating landlord:", err);
    res.status(500).json({ error: "Failed to reactivate landlord account" });
  }
});

// ─── POST /api/superadmin/landlords/:id/reset-access (Activation Link / Password Reset) ──
router.post("/landlords/:id/reset-access", async (req, res) => {
  const { id } = req.params;
  const { temporaryPassword, notes = "" } = req.body;

  try {
    const existing = await pool.query("SELECT * FROM landlords WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Landlord not found" });
    }
    const current = existing.rows[0];

    // Generate new single-use token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await pool.query(
      `INSERT INTO landlord_activation_tokens (landlord_id, token_hash, raw_token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [id, tokenHash, rawToken, expiresAt]
    );

    let tempPw = temporaryPassword;
    if (temporaryPassword && temporaryPassword.trim()) {
      const hash = await bcrypt.hash(temporaryPassword.trim(), 12);
      await pool.query("UPDATE landlords SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, id]);
    }

    const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
    const activationLink = `${origin}/activate?token=${rawToken}`;

    await logSuperAdminAction(
      req,
      "RESET_ACCESS",
      current.id,
      current.full_name,
      { tokenGenerated: true, expiresAt },
      notes || "Generated single-use activation / password reset link"
    );

    res.json({
      message: "Access link generated successfully.",
      activationLink,
      token: rawToken,
      temporaryPassword: tempPw || null,
      expiresAt,
    });
  } catch (err) {
    console.error("Error resetting access:", err);
    res.status(500).json({ error: "Failed to generate access credentials" });
  }
});

// ─── GET /api/superadmin/payments (One-Time Payments List) ───────────────────
router.get("/payments", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        l.landlord_code,
        l.phone as landlord_phone,
        l.account_status as landlord_account_status
      FROM landlord_access_payments p
      JOIN landlords l ON l.id = p.landlord_id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching access payments:", err);
    res.status(500).json({ error: "Failed to fetch one-time payments" });
  }
});

// ─── POST /api/superadmin/payments (Record One-Time Payment) ─────────────────
router.post("/payments", async (req, res) => {
  const {
    landlordId,
    amount,
    paymentMethod = "cash",
    dateReceived,
    externalReference = "",
    receiptNumber = "",
    notes = "",
    autoApprove = false,
  } = req.body;

  if (!landlordId || !amount) {
    return res.status(400).json({ error: "Landlord ID and payment amount are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const landlordRes = await client.query("SELECT * FROM landlords WHERE id = $1", [landlordId]);
    if (landlordRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Landlord not found" });
    }
    const landlord = landlordRes.rows[0];

    // Verify landlord doesn't already have an approved payment
    const approvedCheck = await client.query(
      "SELECT id FROM landlord_access_payments WHERE landlord_id = $1 AND status = 'approved'",
      [landlordId]
    );
    if (approvedCheck.rows.length > 0 && autoApprove) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This landlord already has an approved one-time account access payment." });
    }

    const paymentDate = dateReceived ? new Date(dateReceived) : new Date();
    const paymentId = `OTP-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const adminName = req.user.fullName || "Super Admin";
    const status = autoApprove ? "approved" : "pending_verification";

    const paymentRes = await client.query(
      `INSERT INTO landlord_access_payments (
        payment_id, landlord_id, landlord_name, landlord_email, amount, payment_method,
        date_received, external_reference, receipt_number, status, recorded_by, approved_by, approval_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        paymentId,
        landlord.id,
        landlord.full_name,
        landlord.email,
        parseFloat(amount),
        paymentMethod,
        paymentDate.toISOString().split("T")[0],
        externalReference,
        receiptNumber,
        status,
        adminName,
        autoApprove ? adminName : null,
        autoApprove ? new Date() : null,
        notes,
      ]
    );
    const payment = paymentRes.rows[0];

    if (autoApprove) {
      await client.query(
        `UPDATE landlords 
         SET is_paid = true, 
             payment_approved_at = NOW(), 
             account_status = 'Active', 
             account_activated_at = COALESCE(account_activated_at, NOW()),
             updated_at = NOW() 
         WHERE id = $1`,
        [landlord.id]
      );
    } else {
      await client.query(
        `UPDATE landlords SET account_status = 'Pending Activation', updated_at = NOW() WHERE id = $1 AND account_status != 'Active'`,
        [landlord.id]
      );
    }

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      autoApprove ? "APPROVE_PAYMENT" : "RECORD_PAYMENT",
      landlord.id,
      landlord.full_name,
      { paymentId, amount, paymentMethod, status },
      notes || (autoApprove ? "Recorded and approved one-time access payment" : "Recorded one-time payment for verification")
    );

    res.status(201).json({
      payment,
      message: autoApprove ? "Payment approved and landlord account activated." : "Payment recorded as Pending Verification.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error recording payment:", err);
    res.status(500).json({ error: "Failed to record payment: " + err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/superadmin/payments/:id/approve ──────────────────────────────
router.post("/payments/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { notes = "" } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const paymentRes = await client.query("SELECT * FROM landlord_access_payments WHERE id = $1", [id]);
    if (paymentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment record not found" });
    }
    const payment = paymentRes.rows[0];

    if (payment.status === "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This payment is already approved" });
    }

    const adminName = req.user.fullName || "Super Admin";

    const updatedPaymentRes = await client.query(
      `UPDATE landlord_access_payments 
       SET status = 'approved', approved_by = $1, approval_date = NOW(), notes = COALESCE($2, notes), updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [adminName, notes ? `${payment.notes ? payment.notes + " | " : ""}${notes}` : null, id]
    );
    const updatedPayment = updatedPaymentRes.rows[0];

    // Activate landlord account
    const landlordRes = await client.query(
      `UPDATE landlords 
       SET is_paid = true, 
           payment_approved_at = NOW(), 
           account_status = 'Active', 
           account_activated_at = COALESCE(account_activated_at, NOW()), 
           suspension_reason = '',
           updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, full_name, email, account_status, is_paid`,
      [payment.landlord_id]
    );
    const landlord = landlordRes.rows[0];

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "APPROVE_PAYMENT",
      landlord.id,
      landlord.full_name,
      { paymentId: payment.payment_id, amount: payment.amount, paymentMethod: payment.payment_method },
      notes || "Super Admin approved one-time account access payment"
    );

    res.json({
      payment: updatedPayment,
      landlord,
      message: `Payment ${payment.payment_id} approved. Account for ${landlord.full_name} is now permanently Active.`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error approving payment:", err);
    res.status(500).json({ error: "Failed to approve payment: " + err.message });
  } finally {
    client.release();
  }
});

// ─── POST /api/superadmin/payments/:id/reject ───────────────────────────────
router.post("/payments/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { reason = "", notes = "" } = req.body;

  if (!reason.trim()) {
    return res.status(400).json({ error: "A rejection reason is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const paymentRes = await client.query("SELECT * FROM landlord_access_payments WHERE id = $1", [id]);
    if (paymentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment record not found" });
    }
    const payment = paymentRes.rows[0];

    const updatedPaymentRes = await client.query(
      `UPDATE landlord_access_payments 
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [reason.trim(), id]
    );

    // Update landlord status to Pending Payment if not already paid by another transaction
    const otherApproved = await client.query(
      "SELECT id FROM landlord_access_payments WHERE landlord_id = $1 AND status = 'approved' AND id != $2",
      [payment.landlord_id, id]
    );
    if (otherApproved.rows.length === 0) {
      await client.query(
        "UPDATE landlords SET is_paid = false, account_status = 'Pending Payment', updated_at = NOW() WHERE id = $1 AND account_status != 'Suspended'",
        [payment.landlord_id]
      );
    }

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "REJECT_PAYMENT",
      payment.landlord_id,
      payment.landlord_name,
      { paymentId: payment.payment_id, amount: payment.amount, reason: reason.trim() },
      notes ? `${reason.trim()} — ${notes}` : reason.trim()
    );

    res.json({
      payment: updatedPaymentRes.rows[0],
      message: `Payment ${payment.payment_id} rejected. Reason: ${reason}`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error rejecting payment:", err);
    res.status(500).json({ error: "Failed to reject payment" });
  } finally {
    client.release();
  }
});

// ─── POST /api/superadmin/payments/:id/reverse ──────────────────────────────
router.post("/payments/:id/reverse", async (req, res) => {
  const { id } = req.params;
  const { reason = "", notes = "" } = req.body;

  if (!reason.trim()) {
    return res.status(400).json({ error: "A reversal reason is required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const paymentRes = await client.query("SELECT * FROM landlord_access_payments WHERE id = $1", [id]);
    if (paymentRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Payment record not found" });
    }
    const payment = paymentRes.rows[0];

    const updatedPaymentRes = await client.query(
      `UPDATE landlord_access_payments 
       SET status = 'reversed', reversal_reason = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [reason.trim(), id]
    );

    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "REVERSE_PAYMENT",
      payment.landlord_id,
      payment.landlord_name,
      { paymentId: payment.payment_id, amount: payment.amount, reason: reason.trim() },
      notes ? `${reason.trim()} — ${notes}` : reason.trim()
    );

    res.json({
      payment: updatedPaymentRes.rows[0],
      message: `Payment ${payment.payment_id} has been marked as reversed for audit review.`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error reversing payment:", err);
    res.status(500).json({ error: "Failed to reverse payment" });
  } finally {
    client.release();
  }
});

// ─── GET /api/superadmin/audit-logs ──────────────────────────────────────────
router.get("/audit-logs", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM super_admin_audit_logs ORDER BY created_at DESC LIMIT 300");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching audit logs:", err);
    res.status(500).json({ error: "Failed to fetch platform audit logs" });
  }
});

// ─── GET /api/superadmin/settings & PATCH /api/superadmin/settings ───────────
router.get("/settings", async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value, description FROM platform_settings");
    const settingsMap = {};
    result.rows.forEach(r => { settingsMap[r.key] = r.value; });
    res.json(settingsMap);
  } catch (err) {
    console.error("Error fetching platform settings:", err);
    res.status(500).json({ error: "Failed to fetch platform settings" });
  }
});

router.patch("/settings", async (req, res) => {
  const updates = req.body; // e.g. { one_time_fee: "600.00", contact_phone: "..." }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [key, value] of Object.entries(updates)) {
      await client.query(
        `INSERT INTO platform_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      );
    }
    await client.query("COMMIT");

    await logSuperAdminAction(
      req,
      "UPDATE_SETTINGS",
      null,
      "Platform Settings",
      updates,
      "Super Admin updated platform configuration"
    );

    const result = await pool.query("SELECT key, value FROM platform_settings");
    const settingsMap = {};
    result.rows.forEach(r => { settingsMap[r.key] = r.value; });

    res.json({ settings: settingsMap, message: "Platform settings updated successfully." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating settings:", err);
    res.status(500).json({ error: "Failed to update platform settings" });
  } finally {
    client.release();
  }
});

export default router;
