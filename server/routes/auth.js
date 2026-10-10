import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../db.js";

const router = Router();

// POST /api/auth/superadmin/login
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

// POST /api/auth/landlord/register
router.post("/landlord/register", async (req, res) => {
  const { fullName, email, password, phone, propertyName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "fullName, email and password are required" });
  }
  try {
    const exists = await pool.query("SELECT id FROM landlords WHERE email = $1", [email.toLowerCase()]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO landlords (full_name, email, password_hash, phone, property_name, subscription_plan, subscription_duration_months, account_status)
       VALUES ($1,$2,$3,$4,$5,'Standard',12,'Active') RETURNING id, full_name, email, phone, property_name, subscription_plan, account_status`,
      [fullName, email.toLowerCase(), hash, phone || "", propertyName || ""]
    );
    const landlord = result.rows[0];
    const token = jwt.sign(
      { id: landlord.id, role: "landlord", landlordId: landlord.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.status(201).json({ token, landlord });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during registration" });
  }
});

// POST /api/auth/landlord/login
router.post("/landlord/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM landlords WHERE email = $1",
      [email.toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const landlord = result.rows[0];
    const match = await bcrypt.compare(password, landlord.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (landlord.account_status === "Suspended") {
      return res.status(403).json({ error: "Your landlord account has been suspended. Please contact Super Admin support." });
    }
    if (landlord.account_status === "Pending Activation") {
      return res.status(403).json({ error: "Your landlord account is pending activation by the Super Admin." });
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

// POST /api/auth/tenant/login
router.post("/tenant/login", async (req, res) => {
  const { tenantId, password } = req.body;
  if (!tenantId || !password) {
    return res.status(400).json({ error: "tenantId and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM tenants WHERE tenant_id = $1",
      [tenantId.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid Tenant ID or password" });
    }
    const tenant = result.rows[0];
    if (!tenant.password_hash) {
      return res.status(401).json({ error: "Tenant account not activated yet" });
    }
    const match = await bcrypt.compare(password, tenant.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid Tenant ID or password" });
    }
    const token = jwt.sign(
      { id: tenant.id, role: "tenant", landlordId: tenant.landlord_id, tenantDbId: tenant.id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    const { password_hash, ...safe } = tenant;
    res.json({ token, tenant: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
});

export default router;
