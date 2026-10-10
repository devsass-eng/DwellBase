import jwt from "jsonwebtoken";
import pool from "../db.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ error: "Super Admin access required" });
    }
    next();
  });
}

export function requireLandlord(req, res, next) {
  requireAuth(req, res, async () => {
    if (req.user.role !== "landlord") {
      return res.status(403).json({ error: "Landlord access required" });
    }
    try {
      const result = await pool.query(
        "SELECT account_status, subscription_end_date FROM landlords WHERE id = $1",
        [req.user.landlordId]
      );
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Landlord account not found" });
      }
      const landlord = result.rows[0];
      if (landlord.account_status === "Suspended") {
        return res.status(403).json({ error: "Your landlord account has been suspended. Please contact Super Admin support." });
      }
      if (landlord.account_status === "Pending Activation") {
        return res.status(403).json({ error: "Your landlord account is pending activation by the Super Admin." });
      }
      next();
    } catch (err) {
      console.error("Landlord auth error:", err);
      res.status(500).json({ error: "Authentication verification failed" });
    }
  });
}

export function requireTenant(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "tenant") {
      return res.status(403).json({ error: "Tenant access required" });
    }
    next();
  });
}
