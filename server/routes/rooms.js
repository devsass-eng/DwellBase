import { Router } from "express";
import pool from "../db.js";
import { requireLandlord } from "../middleware/auth.js";

const router = Router();

// GET /api/rooms
router.get("/", requireLandlord, async (req, res) => {
  try {
    // Auto-sync room status with currently assigned active tenants
    await pool.query(
      `UPDATE rooms r
       SET status = 'Occupied', updated_at = NOW()
       WHERE r.landlord_id = $1 AND r.status != 'Maintenance'
         AND EXISTS (
           SELECT 1 FROM tenants t
           WHERE t.room_id = r.id
             AND t.tenancy_status IN ('Active', 'Upcoming', 'Expiring Soon')
         )`,
      [req.user.landlordId]
    );

    await pool.query(
      `UPDATE rooms r
       SET status = 'Vacant', updated_at = NOW()
       WHERE r.landlord_id = $1 AND r.status = 'Occupied'
         AND NOT EXISTS (
           SELECT 1 FROM tenants t
           WHERE t.room_id = r.id
             AND t.tenancy_status IN ('Active', 'Upcoming', 'Expiring Soon')
         )`,
      [req.user.landlordId]
    );

    const { rows } = await pool.query(
      "SELECT * FROM rooms WHERE landlord_id=$1 AND archived=false ORDER BY sequence_number",
      [req.user.landlordId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// POST /api/rooms
router.post("/", requireLandlord, async (req, res) => {
  const { monthlyRent } = req.body;
  if (!monthlyRent || isNaN(Number(monthlyRent))) {
    return res.status(400).json({ error: "monthlyRent is required" });
  }
  try {
    const seqRes = await pool.query(
      "SELECT COALESCE(MAX(sequence_number),0)+1 AS next FROM rooms WHERE landlord_id=$1",
      [req.user.landlordId]
    );
    const seq = seqRes.rows[0].next;
    const roomCode = "R" + seq;
    const roomNumber = "ROOM " + seq + " (" + roomCode + ")";
    const { rows } = await pool.query(
      `INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status)
       VALUES ($1,$2,$3,$4,$5,'Vacant') RETURNING *`,
      [req.user.landlordId, seq, roomNumber, roomCode, monthlyRent]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// PATCH /api/rooms/:id
router.patch("/:id", requireLandlord, async (req, res) => {
  const { monthlyRent, status, archived } = req.body;
  try {
    const fields = [];
    const values = [];
    let i = 1;
    if (monthlyRent !== undefined) { fields.push("monthly_rent=$" + i++); values.push(monthlyRent); }
    if (status !== undefined) { fields.push("status=$" + i++); values.push(status); }
    if (archived !== undefined) { fields.push("archived=$" + i++); values.push(archived); }
    fields.push("updated_at=NOW()");
    values.push(req.params.id);
    values.push(req.user.landlordId);
    const { rows } = await pool.query(
      "UPDATE rooms SET " + fields.join(",") + " WHERE id=$" + i++ + " AND landlord_id=$" + i + " RETURNING *",
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: "Room not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update room" });
  }
});

export default router;
