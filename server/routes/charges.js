import { Router } from "express";
import pool from "../db.js";
import { requireLandlord, requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/charges
router.get("/", requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === "landlord") {
      ({ rows } = await pool.query(
        "SELECT * FROM charges WHERE landlord_id=$1 ORDER BY created_at DESC",
        [req.user.landlordId]
      ));
    } else {
      ({ rows } = await pool.query(
        "SELECT * FROM charges WHERE tenant_id=$1 ORDER BY created_at DESC",
        [req.user.tenantDbId]
      ));
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch charges" });
  }
});

// POST /api/charges
router.post("/", requireLandlord, async (req, res) => {
  const {
    categoryId, categoryName, tenantId, tenantName, roomId, roomNumber,
    amount, issueDate, dueDate, billingPeriod, issuedBy
  } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO charges (
        landlord_id, category_id, category_name, tenant_id, tenant_name,
        room_id, room_number, amount, amount_paid, remaining_balance,
        issue_date, due_date, billing_period, status, issued_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$8,$9,$10,$11,'upcoming',$12) RETURNING *`,
      [
        req.user.landlordId, categoryId||null, categoryName,
        tenantId||null, tenantName, roomId||null, roomNumber,
        amount, issueDate, dueDate, billingPeriod, issuedBy
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create charge" });
  }
});

// PATCH /api/charges/:id/status
router.patch("/:id/status", requireLandlord, async (req, res) => {
  const { status, amountPaid, remainingBalance } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE charges SET status=$1, amount_paid=$2, remaining_balance=$3
       WHERE id=$4 AND landlord_id=$5 RETURNING *`,
      [status, amountPaid, remainingBalance, req.params.id, req.user.landlordId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Charge not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update charge" });
  }
});

export default router;
