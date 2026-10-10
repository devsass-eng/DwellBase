import { Router } from "express";
import pool from "../db.js";
import { requireLandlord, requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/regulations
router.get("/", requireAuth, async (req, res) => {
  try {
    const landlordId = req.user.role === "landlord" ? req.user.landlordId : req.user.landlordId;
    const { rows } = await pool.query(
      "SELECT * FROM regulations WHERE landlord_id=$1 ORDER BY created_at ASC",
      [landlordId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch regulations" });
  }
});

// POST /api/regulations
router.post("/", requireLandlord, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }
  try {
    const { rows } = await pool.query(
      "INSERT INTO regulations (landlord_id, text) VALUES ($1,$2) RETURNING *",
      [req.user.landlordId, text.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add regulation" });
  }
});

// DELETE /api/regulations/:id
router.delete("/:id", requireLandlord, async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM regulations WHERE id=$1 AND landlord_id=$2",
      [req.params.id, req.user.landlordId]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Regulation not found" });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete regulation" });
  }
});

export default router;
