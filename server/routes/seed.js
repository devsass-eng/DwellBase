// POST /api/seed  — Seeds demo data for a landlord account (dev/demo only)
import { Router } from "express";
import pool from "../db.js";
import { requireLandlord } from "../middleware/auth.js";

const router = Router();

router.post("/", requireLandlord, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Seed not available in production" });
  }
  const lid = req.user.landlordId;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get category IDs
    const cats = await client.query(
      "SELECT id, name FROM billing_categories WHERE landlord_id=$1", [lid]
    );
    const catMap = {};
    cats.rows.forEach(c => { catMap[c.name] = c.id; });

    // Check if already seeded
    const existing = await client.query("SELECT COUNT(*) FROM rooms WHERE landlord_id=$1", [lid]);
    if (parseInt(existing.rows[0].count) > 0) {
      await client.query("ROLLBACK");
      return res.json({ message: "Already seeded", skipped: true });
    }

    // Rooms
    const r1 = await client.query(
      `INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
       VALUES ($1,1,'ROOM 1 (R1)','R1',800,'Occupied','2025-01-01','2026-10-01') RETURNING id`,
      [lid]
    );
    const r2 = await client.query(
      `INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
       VALUES ($1,2,'ROOM 2 (R2)','R2',1200,'Occupied','2025-01-01','2026-10-01') RETURNING id`,
      [lid]
    );
    const r3 = await client.query(
      `INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
       VALUES ($1,3,'ROOM 3 (R3)','R3',950,'Vacant','2025-02-01','2026-10-01') RETURNING id`,
      [lid]
    );
    const room1Id = r1.rows[0].id;
    const room2Id = r2.rows[0].id;

    // Tenants
    const t1 = await client.query(
      `INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
        monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
        amount_paid, outstanding_balance, tenancy_status, account_status)
       VALUES ($1,'TENT-01','Kwesi Mensah','0241234567','tenant@dwellbase.com',$2,'ROOM 1 (R1)','R1',
         800,'2026-01-01',12,'2026-12-31',9600,950,60,'Active','Active') RETURNING id`,
      [lid, room1Id]
    );
    const t2 = await client.query(
      `INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
        monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
        amount_paid, outstanding_balance, tenancy_status, account_status)
       VALUES ($1,'TENT-02','Ama Osei','0544004400','ama.osei@dwellbase.demo',$2,'ROOM 2 (R2)','R2',
         1200,'2026-03-01',12,'2027-02-28',14400,0,1320,'Active','Invitation Pending') RETURNING id`,
      [lid, room2Id]
    );
    const t0 = await client.query(
      `INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
        monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
        amount_paid, outstanding_balance, tenancy_status, account_status)
       VALUES ($1,'TENT-00','Kofi Boateng','0209876543','kofi.boateng@dwellbase.demo',$2,'ROOM 1 (R1)','R1',
         750,'2025-01-01',12,'2025-12-31',9000,8700,300,'Ended','Suspended') RETURNING id`,
      [lid, room1Id]
    );
    const tenant1Id = t1.rows[0].id;
    const tenant2Id = t2.rows[0].id;
    const tenantFormerId = t0.rows[0].id;

    // Charges
    const ch1 = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Rent',$3,'Kwesi Mensah',$4,'ROOM 1 (R1)',800,800,0,'2026-10-01','2026-10-07','October 2026','paid','Property Manager','2026-10-01') RETURNING id`,
      [lid, catMap["Rent"], tenant1Id, room1Id]
    );
    const ch2 = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Light Bill',$3,'Kwesi Mensah',$4,'ROOM 1 (R1)',150,150,0,'2026-10-01','2026-10-15','October 2026','paid','Property Manager','2026-10-01') RETURNING id`,
      [lid, catMap["Light Bill"], tenant1Id, room1Id]
    );
    const ch3 = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Water Bill',$3,'Kwesi Mensah',$4,'ROOM 1 (R1)',60,0,60,'2026-10-01','2026-10-18','October 2026','pending','Property Manager','2026-10-01') RETURNING id`,
      [lid, catMap["Water Bill"], tenant1Id, room1Id]
    );
    const ch4 = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Rent',$3,'Ama Osei',$4,'ROOM 2 (R2)',1200,0,1200,'2026-10-01','2026-10-10','October 2026','pending','Property Manager','2026-10-01') RETURNING id`,
      [lid, catMap["Rent"], tenant2Id, room2Id]
    );
    const ch5 = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Light Bill',$3,'Ama Osei',$4,'ROOM 2 (R2)',120,0,120,'2026-09-01','2026-09-15','September 2026','overdue','Property Manager','2026-09-01') RETURNING id`,
      [lid, catMap["Light Bill"], tenant2Id, room2Id]
    );
    const chF = await client.query(
      `INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
        amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
       VALUES ($1,$2,'Water Bill',$3,'Kofi Boateng',$4,'ROOM 1 (R1)',300,0,300,'2025-12-01','2025-12-15','December 2025','overdue','Property Manager','2025-12-01') RETURNING id`,
      [lid, catMap["Water Bill"], tenantFormerId, room1Id]
    );

    // Payments
    await client.query(
      `INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
        charge_id,category_id,category_name,billing_period,amount,payment_method,status,recorded_by,payment_date,notes,created_at)
       VALUES ($1,'CASH-OCT-2026-01','DB-2026-000001',$2,'Kwesi Mensah',$3,'ROOM 1 (R1)',$4,$5,'Rent','October 2026',
         800,'cash','successful','Property Manager','2026-10-02','Cash payment for October 2026 rent','2026-10-02')`,
      [lid, tenant1Id, room1Id, ch1.rows[0].id, catMap["Rent"]]
    );
    await client.query(
      `INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
        charge_id,category_id,category_name,billing_period,amount,payment_method,momo_network,provider_ref,status,recorded_by,payment_date,notes,created_at)
       VALUES ($1,'MOMO-OCT-2026-02','DB-2026-000002',$2,'Kwesi Mensah',$3,'ROOM 1 (R1)',$4,$5,'Light Bill','October 2026',
         150,'momo','mtn','HUB-MOMO-98231','successful','tenant','2026-10-05','Mobile Money automated transfer','2026-10-05')`,
      [lid, tenant1Id, room1Id, ch2.rows[0].id, catMap["Light Bill"]]
    );
    await client.query(
      `INSERT INTO payments (landlord_id,reference_number,tenant_id,tenant_name,room_id,room_number,
        charge_id,category_id,category_name,billing_period,amount,payment_method,momo_network,provider_ref,status,recorded_by,payment_date,notes,created_at)
       VALUES ($1,'MOMO-OCT-2026-03',$2,'Ama Osei',$3,'ROOM 2 (R2)',$4,$5,'Rent','October 2026',
         1200,'momo','mtn','TX-MTN-55441','pending','tenant','2026-10-08','Transferred via MTN. Awaiting confirmation.','2026-10-08')`,
      [lid, tenant2Id, room2Id, ch4.rows[0].id, catMap["Rent"]]
    );
    await client.query(
      `INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
        charge_id,category_id,category_name,billing_period,amount,payment_method,status,recorded_by,payment_date,created_at)
       VALUES ($1,'CASH-HIST-2025-45','DB-2025-000045',$2,'Kofi Boateng',$3,'ROOM 1 (R1)',$4,$5,'Rent','November 2025',
         750,'cash','successful','Property Manager','2025-11-01','2025-11-01')`,
      [lid, tenantFormerId, room1Id, chF.rows[0].id, catMap["Water Bill"]]
    );

    // Regulations
    await client.query(
      `INSERT INTO regulations (landlord_id, text, created_at) VALUES
       ($1, 'Quiet hours must be observed between 10:00 PM and 6:00 AM daily.', '2026-09-01'),
       ($1, 'Waste disposal bins in the courtyard must be tightly closed after use.', '2026-09-05')`,
      [lid]
    );

    // Audit logs
    await client.query(
      `INSERT INTO audit_logs (landlord_id,entity_type,entity_id,field,original_value,corrected_value,actor,reason,created_at)
       VALUES ($1,'charge',$2,'amount','GH₵180.00','GH₵150.00','Property Manager','Verified with ECG meter reading','2026-10-04'),
              ($1,'tenant',$3,'tenancyStatus','Active','Ended','Property Manager','End of 1-year tenancy agreement. Debt preserved.','2025-12-31')`,
      [lid, ch2.rows[0].id, tenantFormerId]
    );

    // Update landlord profile
    await client.query(
      `UPDATE landlords SET full_name='Property Manager', phone='0500000000', property_name='DwellBase Properties',
       property_address='123 Main Street, Accra', momo_network='mtn', momo_name='Property Manager',
       momo_number='05440044', payment_instructions='Please transfer using the provided Mobile Money details.'
       WHERE id=$1`,
      [lid]
    );

    await client.query("COMMIT");
    res.json({ message: "Demo data seeded successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Seed failed: " + err.message });
  } finally {
    client.release();
  }
});

export default router;
