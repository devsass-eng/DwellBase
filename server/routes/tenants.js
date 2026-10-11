import { Router } from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";
import { requireLandlord, requireTenant, requireAuth } from "../middleware/auth.js";

const router = Router();

// GET /api/tenants  (landlord sees all their tenants)
router.get("/", requireLandlord, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tenants WHERE landlord_id=$1 ORDER BY created_at",
      [req.user.landlordId]
    );
    const safe = rows.map(({ password_hash, ...t }) => t);
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});

// GET /api/tenants/me  (tenant sees their own record)
router.get("/me", requireTenant, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM tenants WHERE id=$1",
      [req.user.tenantDbId]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Tenant not found" });
    const { password_hash, ...safe } = rows[0];
    res.json(safe);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tenant" });
  }
});

// POST /api/tenants
router.post("/", requireLandlord, async (req, res) => {
  const {
    tenantId, fullName, phone, email, roomId, roomNumber, roomCode,
    monthlyRent, startDate, durationMonths, endDate,
    totalContractualRent, amountPaid, outstandingBalance,
    tenancyStatus, accountStatus, createLogin
  } = req.body;
  if (!fullName || !tenantId) {
    return res.status(400).json({ error: "fullName and tenantId are required" });
  }
  try {
    // Always generate tenant account and temporary password by default
    const shouldCreateLogin = createLogin !== "no" && createLogin !== false;
    let tempPassword = null;
    let passwordHash = null;
    let finalAccountStatus = "Active";

    if (shouldCreateLogin) {
      // Generate a random 8-character temporary password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      tempPassword = "";
      for (let i = 0; i < 8; i++) {
        tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      passwordHash = await bcrypt.hash(tempPassword, 12);
      finalAccountStatus = "Active";
    }

    const { rows } = await pool.query(
      `INSERT INTO tenants (
        landlord_id, tenant_id, full_name, phone, email, password_hash, room_id, room_number, room_code,
        monthly_rent, start_date, duration_months, end_date,
        total_contractual_rent, amount_paid, outstanding_balance,
        tenancy_status, account_status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        req.user.landlordId, tenantId, fullName, phone||"", email||"",
        passwordHash,
        roomId||null, roomNumber||"", roomCode||"",
        monthlyRent||0, startDate||null, durationMonths||0, endDate||null,
        totalContractualRent||0, amountPaid||0, outstandingBalance||0,
        tenancyStatus||"Upcoming", finalAccountStatus
      ]
    );
    // Mark room as Occupied if assigned
    if (roomId) {
      await pool.query(
        "UPDATE rooms SET status = 'Occupied', updated_at = NOW() WHERE id = $1 AND landlord_id = $2",
        [roomId, req.user.landlordId]
      );
    }

    // If login was created, include the temporary password so landlord can share it
    const response = { ...safe };
    if (tempPassword) {
      response.temporaryPassword = tempPassword;
      response.loginCredentials = {
        tenantId: tenantId,
        temporaryPassword: tempPassword,
        message: "Share these credentials with the tenant. They can change their password after first login."
      };
    }

    res.status(201).json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create tenant" });
  }
});

// PATCH /api/tenants/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const allowed = [
      "full_name","phone","email","room_id","room_number","room_code",
      "monthly_rent","start_date","duration_months","end_date",
      "total_contractual_rent","amount_paid","outstanding_balance",
      "tenancy_status","account_status",
      "notif_payment_confirmations","notif_manual_momo","notif_upcoming_bills",
      "notif_overdue_charges","notif_new_regulations"
    ];
    const fields = [];
    const values = [];
    let i = 1;
    // Map camelCase to snake_case for common fields
    const fieldMap = {
      fullName:"full_name", roomId:"room_id", roomNumber:"room_number", roomCode:"room_code",
      monthlyRent:"monthly_rent", startDate:"start_date", durationMonths:"duration_months",
      endDate:"end_date", totalContractualRent:"total_contractual_rent",
      amountPaid:"amount_paid", outstandingBalance:"outstanding_balance",
      tenancyStatus:"tenancy_status", accountStatus:"account_status"
    };
    for (const [key, val] of Object.entries(req.body)) {
      const col = fieldMap[key] || key;
      if (allowed.includes(col)) {
        fields.push(col + "=$" + i++);
        values.push(val);
      }
    }
    if (req.body.password) {
      fields.push("password_hash=$" + i++);
      values.push(await bcrypt.hash(req.body.password, 12));
    }
    fields.push("updated_at=NOW()");
    values.push(req.params.id);
    if (req.user.role === "landlord") {
      values.push(req.user.landlordId);
      const { rows } = await pool.query(
        "UPDATE tenants SET " + fields.join(",") + " WHERE id=$" + i++ + " AND landlord_id=$" + i + " RETURNING *",
        values
      );
      if (rows.length === 0) return res.status(404).json({ error: "Tenant not found" });
      const { password_hash, ...safe } = rows[0];
      return res.json(safe);
    } else {
      // Tenant can only update their own record
      if (req.user.tenantDbId !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const { rows } = await pool.query(
        "UPDATE tenants SET " + fields.join(",") + " WHERE id=$" + i + " RETURNING *",
        values
      );
      if (rows.length === 0) return res.status(404).json({ error: "Tenant not found" });
      const { password_hash, ...safe } = rows[0];
      return res.json(safe);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update tenant" });
  }
});

// POST /api/tenants/:id/reset-password (landlord resets tenant password)
router.post("/:id/reset-password", requireLandlord, async (req, res) => {
  try {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { rows } = await pool.query(
      `UPDATE tenants 
       SET password_hash = $1, account_status = 'Active', updated_at = NOW() 
       WHERE id = $2 AND landlord_id = $3 
       RETURNING *`,
      [passwordHash, req.params.id, req.user.landlordId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const { password_hash: _ph, ...safe } = rows[0];
    res.json({
      ...safe,
      temporaryPassword: tempPassword,
      loginCredentials: {
        tenantId: safe.tenant_id,
        temporaryPassword: tempPassword,
        message: "Password reset successfully. Share this temporary password with the tenant."
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset tenant password" });
  }
});

// DELETE /api/tenants/:id (landlord permanently deletes tenant)
router.delete("/:id", requireLandlord, async (req, res) => {
  try {
    const tenantRes = await pool.query(
      "SELECT * FROM tenants WHERE id=$1 AND landlord_id=$2",
      [req.params.id, req.user.landlordId]
    );
    if (tenantRes.rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    const tenant = tenantRes.rows[0];

    // Detach references in charges & payments to avoid foreign key violation
    await pool.query(
      "UPDATE charges SET tenant_id = NULL WHERE tenant_id = $1",
      [tenant.id]
    );
    await pool.query(
      "UPDATE payments SET tenant_id = NULL WHERE tenant_id = $1",
      [tenant.id]
    );

    // Delete tenant
    await pool.query(
      "DELETE FROM tenants WHERE id = $1 AND landlord_id = $2",
      [tenant.id, req.user.landlordId]
    );

    // If tenant had a room, check if any active tenants remain; if not, mark Vacant
    if (tenant.room_id) {
      const activeInRoom = await pool.query(
        "SELECT 1 FROM tenants WHERE room_id=$1 AND tenancy_status IN ('Active','Upcoming','Expiring Soon') LIMIT 1",
        [tenant.room_id]
      );
      if (activeInRoom.rows.length === 0) {
        await pool.query(
          "UPDATE rooms SET status = 'Vacant', updated_at = NOW() WHERE id=$1",
          [tenant.room_id]
        );
      }
    }

    res.json({ success: true, message: "Tenant deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete tenant" });
  }
});

export default router;
