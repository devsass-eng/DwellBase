import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = Router();

// ─── GET /api/auth/public-settings (Branding, Pricing & Contact Info) ────────
router.get("/public-settings", async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM platform_settings");
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    console.error("Error fetching public settings:", err);
    res.status(500).json({ error: "Failed to fetch platform info" });
  }
});

// ─── POST /api/auth/superadmin/login ─────────────────────────────────────────
router.post("/superadmin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM super_admins WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Super Admin credentials" });
    }
    const admin = result.rows[0];
    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid Super Admin credentials" });
    }
    const token = jwt.sign(
      { id: admin.id, role: "super_admin", superAdminId: admin.id, fullName: admin.full_name, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password_hash, ...safe } = admin;
    res.json({ token, superAdmin: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during Super Admin login" });
  }
});

// ─── GET /api/auth/verify-activation-token ───────────────────────────────────
router.get("/verify-activation-token", async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: "Activation token is required" });
  }
  try {
    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const result = await pool.query(
      `SELECT t.*, l.full_name, l.email, l.property_name, l.account_status, l.is_paid 
       FROM landlord_activation_tokens t
       JOIN landlords l ON l.id = t.landlord_id
       WHERE t.token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Invalid or non-existent activation link." });
    }
    const tokenRecord = result.rows[0];
    if (tokenRecord.used_at) {
      return res.status(400).json({ error: "This activation link has already been used. Please log in with your credentials." });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(410).json({ error: "This activation link has expired. Please contact the platform owner to issue a fresh access link." });
    }

    res.json({
      valid: true,
      landlord: {
        id: tokenRecord.landlord_id,
        fullName: tokenRecord.full_name,
        email: tokenRecord.email,
        propertyName: tokenRecord.property_name,
      },
      expiresAt: tokenRecord.expires_at,
    });
  } catch (err) {
    console.error("Error verifying activation token:", err);
    res.status(500).json({ error: "Failed to verify activation token" });
  }
});

// ─── POST /api/auth/complete-activation ──────────────────────────────────────
router.post("/complete-activation", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters long" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");
    const tokenRes = await client.query(
      `SELECT t.*, l.id as landlord_id, l.full_name, l.email, l.property_name 
       FROM landlord_activation_tokens t
       JOIN landlords l ON l.id = t.landlord_id
       WHERE t.token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invalid activation link" });
    }
    const record = tokenRes.rows[0];

    if (record.used_at) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "This activation link has already been used" });
    }
    if (new Date(record.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "This activation link has expired" });
    }

    // Hash password and activate landlord
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      `UPDATE landlords 
       SET password_hash = $1, 
           is_paid = true, 
           account_status = 'Active', 
           account_activated_at = COALESCE(account_activated_at, NOW()), 
           updated_at = NOW() 
       WHERE id = $2`,
      [hash, record.landlord_id]
    );

    // Invalidate the token
    await client.query("UPDATE landlord_activation_tokens SET used_at = NOW() WHERE id = $1", [record.id]);

    await client.query("COMMIT");

    // Generate JWT for instant login
    const jwtToken = jwt.sign(
      { id: record.landlord_id, role: "landlord", landlordId: record.landlord_id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token: jwtToken,
      landlord: {
        id: record.landlord_id,
        full_name: record.full_name,
        email: record.email,
        property_name: record.property_name,
      },
      message: "Your password has been set and your account is active with permanent access!",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error completing activation:", err);
    res.status(500).json({ error: "Failed to complete account activation" });
  } finally {
    client.release();
  }
});

// ─── POST /api/auth/landlord/login ───────────────────────────────────────────
router.post("/landlord/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM landlords WHERE email = $1",
      [email.trim().toLowerCase()]
    );
    if (result.rows.length === 0) {
      // Check if this is a Super Admin logging in through the unified Admin Login
      const superAdminRes = await pool.query(
        "SELECT * FROM super_admins WHERE email = $1",
        [email.trim().toLowerCase()]
      );
      if (superAdminRes.rows.length > 0) {
        const admin = superAdminRes.rows[0];
        const matchSuper = await bcrypt.compare(password, admin.password_hash);
        if (matchSuper) {
          const token = jwt.sign(
            { id: admin.id, role: "super_admin", email: admin.email, fullName: admin.full_name },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
          );
          return res.json({
            token,
            role: "super_admin",
            superAdmin: { id: admin.id, full_name: admin.full_name, email: admin.email },
            redirectTo: "/superadmin/dashboard",
          });
        }
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const landlord = result.rows[0];

    if (!landlord.password_hash) {
      return res.status(401).json({
        error: "Your account has not been activated yet. Please check your activation link or contact the platform owner.",
      });
    }

    const match = await bcrypt.compare(password, landlord.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (landlord.account_status === "Suspended") {
      return res.status(403).json({
        error: `Your landlord account has been suspended${landlord.suspension_reason ? `: ${landlord.suspension_reason}` : ""}. All records remain preserved. Please contact the platform administrator.`,
      });
    }
    if (landlord.account_status === "Pending Payment") {
      return res.status(403).json({
        error: "Your account is pending one-time access fee payment. Please contact the platform owner to arrange payment.",
      });
    }
    if (landlord.account_status === "Pending Activation") {
      return res.status(403).json({
        error: "Your one-time access payment has been recorded and is awaiting Super Admin verification and activation.",
      });
    }

    const token = jwt.sign(
      { id: landlord.id, role: "landlord", landlordId: landlord.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password_hash, ...safe } = landlord;
    res.json({ token, landlord: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ─── POST /api/auth/tenant/login ────────────────────────────────────────────
router.post("/tenant/login", async (req, res) => {
  const { tenantId, password } = req.body;
  if (!tenantId || !password) {
    return res.status(400).json({ error: "Tenant ID, phone, or email and password are required" });
  }
  try {
    const rawId = tenantId.trim();
    const cleanPassword = password.trim();

    // Support logging in via Tenant ID, phone, email, or full name
    const result = await pool.query(
      `SELECT * FROM tenants 
       WHERE UPPER(tenant_id) = UPPER($1) 
          OR phone = $1 
          OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER($1))
          OR LOWER(full_name) = LOWER($1)`,
      [rawId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Tenant ID or password" });
    }

    let matchedTenant = null;
    for (const tenant of result.rows) {
      if (tenant.password_hash) {
        const match = await bcrypt.compare(cleanPassword, tenant.password_hash)
                   || await bcrypt.compare(password, tenant.password_hash);
        if (match) {
          matchedTenant = tenant;
          break;
        }
      }
    }

    if (!matchedTenant) {
      const unactivated = result.rows.find(t => !t.password_hash);
      if (unactivated) {
        return res.status(401).json({ error: "Tenant login credentials have not been generated yet. Please contact your landlord." });
      }
      return res.status(401).json({ error: "Invalid Tenant ID or password" });
    }

    if (matchedTenant.account_status === "Suspended") {
      return res.status(403).json({ error: "Your tenant login access has been suspended by your landlord." });
    }

    const token = jwt.sign(
      { id: matchedTenant.id, role: "tenant", landlordId: matchedTenant.landlord_id, tenantDbId: matchedTenant.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password_hash, ...safe } = matchedTenant;
    res.json({ token, tenant: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

export default router;
