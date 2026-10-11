"""Seed routes — ports server/routes/seed.js to FastAPI (dev/demo only)."""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.auth import TokenData, require_landlord, hash_password

router = APIRouter(prefix="/seed", tags=["seed"])

settings = get_settings()


@router.post("/")
async def seed_demo_data(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    if settings.NODE_ENV == "production":
        raise HTTPException(403, "Seed not available in production")

    lid = user.landlord_id

    # Check if already seeded
    existing = await db.execute(text("SELECT COUNT(*) FROM rooms WHERE landlord_id = :lid"), {"lid": lid})
    if int(existing.scalar()) > 0:
        return {"message": "Already seeded", "skipped": True}

    # Get billing category IDs
    cats = await db.execute(text("SELECT id, name FROM billing_categories WHERE landlord_id = :lid"), {"lid": lid})
    cat_map = {row[1]: str(row[0]) for row in cats.fetchall()}

    pw_hash = hash_password("Tenant@1234")

    # Rooms
    r1 = await db.execute(text("""
        INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
        VALUES (:lid, 1, 'ROOM 1 (R1)', 'R1', 800, 'Occupied', '2025-01-01', '2026-10-01') RETURNING id
    """), {"lid": lid})
    room1_id = str(r1.scalar())

    r2 = await db.execute(text("""
        INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
        VALUES (:lid, 2, 'ROOM 2 (R2)', 'R2', 1200, 'Occupied', '2025-01-01', '2026-10-01') RETURNING id
    """), {"lid": lid})
    room2_id = str(r2.scalar())

    await db.execute(text("""
        INSERT INTO rooms (landlord_id, sequence_number, room_number, room_code, monthly_rent, status, created_at, updated_at)
        VALUES (:lid, 3, 'ROOM 3 (R3)', 'R3', 950, 'Vacant', '2025-02-01', '2026-10-01')
    """), {"lid": lid})

    # Tenants
    t1 = await db.execute(text("""
        INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
            monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
            amount_paid, outstanding_balance, tenancy_status, account_status, password_hash)
        VALUES (:lid, 'TENT-01', 'Kwesi Mensah', '0241234567', 'tenant@dwellbase.com', :rid, 'ROOM 1 (R1)', 'R1',
            800, '2026-01-01', 12, '2026-12-31', 9600, 950, 60, 'Active', 'Active', :pw) RETURNING id
    """), {"lid": lid, "rid": room1_id, "pw": pw_hash})
    tenant1_id = str(t1.scalar())

    t2 = await db.execute(text("""
        INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
            monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
            amount_paid, outstanding_balance, tenancy_status, account_status, password_hash)
        VALUES (:lid, 'TENT-02', 'Ama Osei', '0544004400', 'ama.osei@dwellbase.demo', :rid, 'ROOM 2 (R2)', 'R2',
            1200, '2026-03-01', 12, '2027-02-28', 14400, 0, 1320, 'Active', 'Active', :pw) RETURNING id
    """), {"lid": lid, "rid": room2_id, "pw": pw_hash})
    tenant2_id = str(t2.scalar())

    t0 = await db.execute(text("""
        INSERT INTO tenants (landlord_id, tenant_id, full_name, phone, email, room_id, room_number, room_code,
            monthly_rent, start_date, duration_months, end_date, total_contractual_rent,
            amount_paid, outstanding_balance, tenancy_status, account_status, password_hash)
        VALUES (:lid, 'TENT-00', 'Kofi Boateng', '0209876543', 'kofi.boateng@dwellbase.demo', :rid, 'ROOM 1 (R1)', 'R1',
            750, '2025-01-01', 12, '2025-12-31', 9000, 8700, 300, 'Ended', 'Suspended', :pw) RETURNING id
    """), {"lid": lid, "rid": room1_id, "pw": pw_hash})
    tenant_former_id = str(t0.scalar())

    # Charges
    ch1 = await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Rent',:tid,'Kwesi Mensah',:rid,'ROOM 1 (R1)',800,800,0,'2026-10-01','2026-10-07','October 2026','paid','Property Manager','2026-10-01') RETURNING id
    """), {"lid": lid, "cat": cat_map.get("Rent"), "tid": tenant1_id, "rid": room1_id})
    ch1_id = str(ch1.scalar())

    ch2 = await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Light Bill',:tid,'Kwesi Mensah',:rid,'ROOM 1 (R1)',150,150,0,'2026-10-01','2026-10-15','October 2026','paid','Property Manager','2026-10-01') RETURNING id
    """), {"lid": lid, "cat": cat_map.get("Light Bill"), "tid": tenant1_id, "rid": room1_id})
    ch2_id = str(ch2.scalar())

    ch3 = await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Water Bill',:tid,'Kwesi Mensah',:rid,'ROOM 1 (R1)',60,0,60,'2026-10-01','2026-10-18','October 2026','pending','Property Manager','2026-10-01') RETURNING id
    """), {"lid": lid, "cat": cat_map.get("Water Bill"), "tid": tenant1_id, "rid": room1_id})

    ch4 = await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Rent',:tid,'Ama Osei',:rid,'ROOM 2 (R2)',1200,0,1200,'2026-10-01','2026-10-10','October 2026','pending','Property Manager','2026-10-01') RETURNING id
    """), {"lid": lid, "cat": cat_map.get("Rent"), "tid": tenant2_id, "rid": room2_id})
    ch4_id = str(ch4.scalar())

    await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Light Bill',:tid,'Ama Osei',:rid,'ROOM 2 (R2)',120,0,120,'2026-09-01','2026-09-15','September 2026','overdue','Property Manager','2026-09-01')
    """), {"lid": lid, "cat": cat_map.get("Light Bill"), "tid": tenant2_id, "rid": room2_id})

    chF = await db.execute(text("""
        INSERT INTO charges (landlord_id,category_id,category_name,tenant_id,tenant_name,room_id,room_number,
            amount,amount_paid,remaining_balance,issue_date,due_date,billing_period,status,issued_by,created_at)
        VALUES (:lid,:cat,'Water Bill',:tid,'Kofi Boateng',:rid,'ROOM 1 (R1)',300,0,300,'2025-12-01','2025-12-15','December 2025','overdue','Property Manager','2025-12-01') RETURNING id
    """), {"lid": lid, "cat": cat_map.get("Water Bill"), "tid": tenant_former_id, "rid": room1_id})
    chF_id = str(chF.scalar())

    # Payments
    await db.execute(text("""
        INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
            charge_id,category_id,category_name,billing_period,amount,payment_method,status,recorded_by,payment_date,notes,created_at)
        VALUES (:lid,'CASH-OCT-2026-01','DB-2026-000001',:tid,'Kwesi Mensah',:rid,'ROOM 1 (R1)',:cid,:cat,'Rent','October 2026',
            800,'cash','successful','Property Manager','2026-10-02','Cash payment for October 2026 rent','2026-10-02')
    """), {"lid": lid, "tid": tenant1_id, "rid": room1_id, "cid": ch1_id, "cat": cat_map.get("Rent")})

    await db.execute(text("""
        INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
            charge_id,category_id,category_name,billing_period,amount,payment_method,momo_network,provider_ref,status,recorded_by,payment_date,notes,created_at)
        VALUES (:lid,'MOMO-OCT-2026-02','DB-2026-000002',:tid,'Kwesi Mensah',:rid,'ROOM 1 (R1)',:cid,:cat,'Light Bill','October 2026',
            150,'momo','mtn','HUB-MOMO-98231','successful','tenant','2026-10-05','Mobile Money automated transfer','2026-10-05')
    """), {"lid": lid, "tid": tenant1_id, "rid": room1_id, "cid": ch2_id, "cat": cat_map.get("Light Bill")})

    await db.execute(text("""
        INSERT INTO payments (landlord_id,reference_number,tenant_id,tenant_name,room_id,room_number,
            charge_id,category_id,category_name,billing_period,amount,payment_method,momo_network,provider_ref,status,recorded_by,payment_date,notes,created_at)
        VALUES (:lid,'MOMO-OCT-2026-03',:tid,'Ama Osei',:rid,'ROOM 2 (R2)',:cid,:cat,'Rent','October 2026',
            1200,'momo','mtn','TX-MTN-55441','pending','tenant','2026-10-08','Transferred via MTN. Awaiting confirmation.','2026-10-08')
    """), {"lid": lid, "tid": tenant2_id, "rid": room2_id, "cid": ch4_id, "cat": cat_map.get("Rent")})

    await db.execute(text("""
        INSERT INTO payments (landlord_id,reference_number,receipt_number,tenant_id,tenant_name,room_id,room_number,
            charge_id,category_id,category_name,billing_period,amount,payment_method,status,recorded_by,payment_date,created_at)
        VALUES (:lid,'CASH-HIST-2025-45','DB-2025-000045',:tid,'Kofi Boateng',:rid,'ROOM 1 (R1)',:cid,:cat,'Rent','November 2025',
            750,'cash','successful','Property Manager','2025-11-01','2025-11-01')
    """), {"lid": lid, "tid": tenant_former_id, "rid": room1_id, "cid": chF_id, "cat": cat_map.get("Water Bill")})

    # Regulations
    await db.execute(text("""
        INSERT INTO regulations (landlord_id, text, created_at) VALUES
        (:lid, 'Quiet hours must be observed between 10:00 PM and 6:00 AM daily.', '2026-09-01'),
        (:lid, 'Waste disposal bins in the courtyard must be tightly closed after use.', '2026-09-05')
    """), {"lid": lid})

    # Audit logs
    await db.execute(text("""
        INSERT INTO audit_logs (landlord_id,entity_type,entity_id,field,original_value,corrected_value,actor,reason,created_at)
        VALUES (:lid,'charge',:ch2,'amount','GH₵180.00','GH₵150.00','Property Manager','Verified with ECG meter reading','2026-10-04'),
               (:lid,'tenant',:t0,'tenancyStatus','Active','Ended','Property Manager','End of 1-year tenancy agreement. Debt preserved.','2025-12-31')
    """), {"lid": lid, "ch2": ch2_id, "t0": tenant_former_id})

    # Update landlord profile
    await db.execute(text("""
        UPDATE landlords SET full_name='Property Manager', phone='0500000000', property_name='DwellBase Properties',
         property_address='123 Main Street, Accra', momo_network='mtn', momo_name='Property Manager',
         momo_number='05440044', payment_instructions='Please transfer using the provided Mobile Money details.'
         WHERE id=:lid
    """), {"lid": lid})

    await db.commit()
    return {"message": "Demo data seeded successfully"}
