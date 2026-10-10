import { Router } from "express";
import pool from "../db.js";
import { requireLandlord, requireTenant, requireAuth } from "../middleware/auth.js";

const router = Router();

function genRef(prefix) {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2,6).toUpperCase();
  return prefix + "-" + ts + "-" + rnd;
}

// GET /api/payments
router.get("/", requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === "landlord") {
      ({ rows } = await pool.query(
        "SELECT * FROM payments WHERE landlord_id=$1 ORDER BY created_at DESC",
        [req.user.landlordId]
      ));
    } else {
      ({ rows } = await pool.query(
        "SELECT * FROM payments WHERE tenant_id=$1 ORDER BY created_at DESC",
        [req.user.tenantDbId]
      ));
    }
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// POST /api/payments/cash  (landlord records cash payment)
router.post("/cash", requireLandlord, async (req, res) => {
  const {
    tenantId, tenantName, roomId, roomNumber, chargeId,
    categoryId, categoryName, billingPeriod, amount,
    paymentDate, notes, recordedBy
  } = req.body;
  try {
    const refNum = genRef("CSH");
    const receiptNum = "REC-" + Date.now().toString(36).toUpperCase();
    const { rows } = await pool.query(
      `INSERT INTO payments (
        landlord_id, reference_number, tenant_id, tenant_name, room_id, room_number,
        charge_id, category_id, category_name, billing_period, amount,
        payment_method, status, recorded_by, payment_date, notes,
        receipt_ref, receipt_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'cash','successful',$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        req.user.landlordId, refNum, tenantId||null, tenantName, roomId||null, roomNumber,
        chargeId||null, categoryId||null, categoryName, billingPeriod, amount,
        recordedBy, paymentDate, notes||"", refNum, receiptNum
      ]
    );
    // Update charge
    if (chargeId) {
      await pool.query(
        `UPDATE charges
         SET amount_paid = LEAST(amount, amount_paid + $1),
             remaining_balance = GREATEST(0, remaining_balance - $1),
             status = CASE
               WHEN GREATEST(0, remaining_balance - $1) = 0 THEN 'paid'
               WHEN amount_paid + $1 > 0 THEN 'partially_paid'
               ELSE status END
         WHERE id=$2 AND landlord_id=$3`,
        [amount, chargeId, req.user.landlordId]
      );
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record cash payment" });
  }
});

// POST /api/payments/momo  (tenant or landlord initiates momo)
router.post("/momo", requireAuth, async (req, res) => {
  const {
    tenantId, tenantName, roomId, roomNumber, chargeId,
    categoryId, categoryName, billingPeriod, amount, momoNetwork
  } = req.body;
  try {
    const refNum = genRef("MMO");
    const landlordId = req.user.role === "landlord"
      ? req.user.landlordId
      : req.user.landlordId;
    const { rows } = await pool.query(
      `INSERT INTO payments (
        landlord_id, reference_number, tenant_id, tenant_name, room_id, room_number,
        charge_id, category_id, category_name, billing_period, amount,
        payment_method, momo_network, status, recorded_by, payment_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'momo',$12,'pending',$13,CURRENT_DATE)
      RETURNING *`,
      [
        landlordId, refNum, tenantId||null, tenantName, roomId||null, roomNumber,
        chargeId||null, categoryId||null, categoryName, billingPeriod, amount,
        momoNetwork, req.user.role === "tenant" ? "tenant" : "admin"
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initiate MoMo payment" });
  }
});

// PATCH /api/payments/:id/status  (landlord verifies/rejects)
router.patch("/:id/status", requireLandlord, async (req, res) => {
  const { status, providerRef } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE payments SET status=$1, provider_ref=$2
       WHERE id=$3 AND landlord_id=$4 RETURNING *`,
      [status, providerRef||null, req.params.id, req.user.landlordId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Payment not found" });
    // If confirmed successful, update the charge
    if (status === "successful" && rows[0].charge_id) {
      await pool.query(
        `UPDATE charges
         SET amount_paid = LEAST(amount, amount_paid + $1),
             remaining_balance = GREATEST(0, remaining_balance - $1),
             status = CASE
               WHEN GREATEST(0, remaining_balance - $1) = 0 THEN 'paid'
               WHEN amount_paid + $1 > 0 THEN 'partially_paid'
               ELSE status END
         WHERE id=$2 AND landlord_id=$3`,
        [rows[0].amount, rows[0].charge_id, req.user.landlordId]
      );
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update payment status" });
  }
});

// POST /api/payments/:id/reverse
router.post("/:id/reverse", requireLandlord, async (req, res) => {
  const { reason } = req.body;
  try {
    const prev = await pool.query("SELECT * FROM payments WHERE id=$1 AND landlord_id=$2", [req.params.id, req.user.landlordId]);
    if (prev.rows.length === 0) return res.status(404).json({ error: "Payment not found" });
    const payment = prev.rows[0];
    if (payment.status !== "successful") {
      return res.status(400).json({ error: "Only successful payments can be reversed" });
    }
    await pool.query("UPDATE payments SET status='reversed' WHERE id=$1", [req.params.id]);
    // Restore the charge balance
    if (payment.charge_id) {
      await pool.query(
        `UPDATE charges
         SET amount_paid = GREATEST(0, amount_paid - $1),
             remaining_balance = LEAST(amount, remaining_balance + $1),
             status = CASE WHEN LEAST(amount, remaining_balance + $1) >= amount THEN 'pending' ELSE 'partially_paid' END
         WHERE id=$2 AND landlord_id=$3`,
        [payment.amount, payment.charge_id, req.user.landlordId]
      );
    }
    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (landlord_id, entity_type, entity_id, field, original_value, corrected_value, actor, reason)
       VALUES ($1,'payment',$2,'status','successful','reversed',$3,$4)`,
      [req.user.landlordId, req.params.id, "admin", reason||""]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reverse payment" });
  }
});

export default router;
