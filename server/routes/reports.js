import { Router } from "express";
import pool from "../db.js";
import { requireLandlord, requireTenant, requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/reports/summary  (landlord dashboard summary)
router.get("/summary", requireLandlord, async (req, res) => {
  try {
    const lid = req.user.landlordId;
    const [rooms, tenants, payments, charges] = await Promise.all([
      pool.query("SELECT status, COUNT(*) as count FROM rooms WHERE landlord_id=$1 AND archived=false GROUP BY status", [lid]),
      pool.query("SELECT tenancy_status, COUNT(*) as count FROM tenants WHERE landlord_id=$1 GROUP BY tenancy_status", [lid]),
      pool.query("SELECT SUM(amount) as total FROM payments WHERE landlord_id=$1 AND status='successful'", [lid]),
      pool.query("SELECT SUM(remaining_balance) as total FROM charges WHERE landlord_id=$1 AND status NOT IN ('paid')", [lid]),
    ]);
    res.json({
      rooms: rooms.rows,
      tenants: tenants.rows,
      totalCollected: payments.rows[0]?.total || 0,
      totalOutstanding: charges.rows[0]?.total || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch summary" });
  }
});

// GET /api/reports/audit-logs
router.get("/audit-logs", requireLandlord, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM audit_logs WHERE landlord_id=$1 ORDER BY created_at DESC",
      [req.user.landlordId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
