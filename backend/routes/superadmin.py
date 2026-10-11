"""Super Admin routes — ports server/routes/superadmin.js to FastAPI."""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from typing import Optional
import json

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import (
    Landlord, Room, Tenant, LandlordAccessPayment,
    LandlordActivationToken, SuperAdminAuditLog, BillingCategory, PlatformSetting,
)
from backend.auth import TokenData, require_super_admin, hash_password

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


# ─── Helpers ──────────────────────────────────────────────────────────────────
async def log_action(db: AsyncSession, user: TokenData, action: str, landlord_id, landlord_name, details=None, notes="", ip=""):
    log = SuperAdminAuditLog(
        super_admin_id=user.super_admin_id or user.id,
        super_admin_name=user.full_name or "Super Admin",
        action=action,
        landlord_id=landlord_id,
        landlord_name=landlord_name,
        details=details or {},
        notes=notes,
        ip_address=ip,
    )
    db.add(log)


async def generate_activation_token(db: AsyncSession, landlord_id: str) -> dict:
    raw_token = secrets.token_hex(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=72)

    tok = LandlordActivationToken(
        landlord_id=landlord_id,
        token_hash=token_hash,
        raw_token=raw_token,
        expires_at=expires_at,
    )
    db.add(tok)
    return {"rawToken": raw_token, "expiresAt": expires_at}


def _safe_dict(obj, exclude=None) -> dict:
    exclude = exclude or {"password_hash"}
    d = {}
    for col in obj.__table__.columns:
        if col.name in exclude:
            continue
        v = getattr(obj, col.name)
        if hasattr(v, "hex"):
            d[col.name] = str(v)
        elif hasattr(v, "isoformat"):
            d[col.name] = v.isoformat()
        elif isinstance(v, Decimal):
            d[col.name] = float(v)
        else:
            d[col.name] = v
    return d


# ─── Schemas ──────────────────────────────────────────────────────────────────
class CreateLandlord(BaseModel):
    fullName: str
    email: str
    phone: str = ""
    propertyName: str = ""
    propertyAddress: str = ""
    oneTimeFee: float | None = None
    paymentReceived: bool = False
    paymentMethod: str = "cash"
    dateReceived: str | None = None
    externalReference: str = ""
    receiptNumber: str = ""
    notes: str = ""
    autoApprove: bool = False


class EditLandlord(BaseModel):
    fullName: str | None = None
    email: str | None = None
    phone: str | None = None
    propertyName: str | None = None
    propertyAddress: str | None = None
    notes: str = ""


class ActionNotes(BaseModel):
    notes: str = ""
    reason: str = ""
    temporaryPassword: str | None = None


class RecordPayment(BaseModel):
    landlordId: str
    amount: float
    paymentMethod: str = "cash"
    dateReceived: str | None = None
    externalReference: str = ""
    receiptNumber: str = ""
    notes: str = ""
    autoApprove: bool = False


# ─── GET /api/superadmin/stats ───────────────────────────────────────────────
@router.get("/stats")
async def stats(user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(text("SELECT COUNT(*) FROM landlords"))).scalar()
    active = (await db.execute(text("SELECT COUNT(*) FROM landlords WHERE account_status = 'Active'"))).scalar()
    pending_pay = (await db.execute(text("SELECT COUNT(*) FROM landlords WHERE account_status = 'Pending Payment'"))).scalar()
    pending_act = (await db.execute(text("SELECT COUNT(*) FROM landlords WHERE account_status = 'Pending Activation'"))).scalar()
    suspended = (await db.execute(text("SELECT COUNT(*) FROM landlords WHERE account_status = 'Suspended'"))).scalar()
    collections = (await db.execute(text("SELECT COALESCE(SUM(amount), 0) FROM landlord_access_payments WHERE status = 'approved'"))).scalar()
    total_rooms = (await db.execute(text("SELECT COUNT(*) FROM rooms"))).scalar()
    total_tenants = (await db.execute(text("SELECT COUNT(*) FROM tenants"))).scalar()

    recent_ll = await db.execute(text(
        "SELECT id, landlord_code, full_name, email, phone, property_name, is_paid, account_status, created_at FROM landlords ORDER BY created_at DESC LIMIT 5"
    ))
    recent_pay = await db.execute(text(
        "SELECT id, payment_id, landlord_id, landlord_name, amount, payment_method, date_received, status, created_at FROM landlord_access_payments ORDER BY created_at DESC LIMIT 5"
    ))
    recent_audit = await db.execute(text(
        "SELECT * FROM super_admin_audit_logs ORDER BY created_at DESC LIMIT 5"
    ))

    def rows_to_dicts(result):
        cols = result.keys()
        out = []
        for row in result.fetchall():
            d = dict(zip(cols, row))
            for k, v in d.items():
                if hasattr(v, "hex"):
                    d[k] = str(v)
                elif hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                elif isinstance(v, Decimal):
                    d[k] = float(v)
            out.append(d)
        return out

    return {
        "totalLandlords": int(total),
        "activeLandlords": int(active),
        "pendingPayment": int(pending_pay),
        "pendingActivation": int(pending_act),
        "suspendedAccounts": int(suspended),
        "totalApprovedCollections": float(collections),
        "totalRooms": int(total_rooms),
        "totalTenants": int(total_tenants),
        "recentLandlords": rows_to_dicts(recent_ll),
        "recentPayments": rows_to_dicts(recent_pay),
        "recentAudit": rows_to_dicts(recent_audit),
    }


# ─── GET /api/superadmin/landlords ───────────────────────────────────────────
@router.get("/landlords")
async def list_landlords(user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT
            l.id, l.landlord_code, l.full_name, l.email, l.phone,
            l.property_name, l.property_address, l.one_time_fee, l.is_paid,
            l.payment_approved_at, l.account_activated_at, l.account_status,
            l.suspension_reason, l.created_at, l.updated_at,
            COUNT(DISTINCT r.id) as room_count,
            COUNT(DISTINCT t.id) as tenant_count,
            (
                SELECT json_build_object(
                    'id', p.id, 'payment_id', p.payment_id, 'amount', p.amount,
                    'payment_method', p.payment_method, 'date_received', p.date_received,
                    'status', p.status, 'approval_date', p.approval_date,
                    'external_reference', p.external_reference
                )
                FROM landlord_access_payments p
                WHERE p.landlord_id = l.id
                ORDER BY p.created_at DESC LIMIT 1
            ) as latest_payment
        FROM landlords l
        LEFT JOIN rooms r ON r.landlord_id = l.id
        LEFT JOIN tenants t ON t.landlord_id = l.id
        GROUP BY l.id
        ORDER BY l.created_at DESC
    """))

    cols = result.keys()
    landlords = []
    for row in result.fetchall():
        d = dict(zip(cols, row))
        for k, v in d.items():
            if hasattr(v, "hex"):
                d[k] = str(v)
            elif hasattr(v, "isoformat"):
                d[k] = v.isoformat()
            elif isinstance(v, Decimal):
                d[k] = float(v)
        d["room_count"] = int(d.get("room_count") or 0)
        d["tenant_count"] = int(d.get("tenant_count") or 0)
        d["one_time_fee"] = float(d.get("one_time_fee") or 500.00)
        landlords.append(d)

    return landlords


# ─── GET /api/superadmin/landlords/:id ───────────────────────────────────────
@router.get("/landlords/{landlord_id}")
async def get_landlord_detail(landlord_id: str, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    ll = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = ll.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    rooms = await db.execute(
        text("SELECT id, sequence_number, room_number, room_code, monthly_rent, status FROM rooms WHERE landlord_id = :lid ORDER BY sequence_number ASC"),
        {"lid": landlord_id},
    )
    tenants = await db.execute(
        text("SELECT id, tenant_id, full_name, phone, email, room_number, monthly_rent, start_date, end_date, outstanding_balance, tenancy_status, account_status FROM tenants WHERE landlord_id = :lid ORDER BY created_at DESC"),
        {"lid": landlord_id},
    )
    payments = await db.execute(
        text("SELECT * FROM landlord_access_payments WHERE landlord_id = :lid ORDER BY created_at DESC"),
        {"lid": landlord_id},
    )
    history = await db.execute(
        text("SELECT * FROM super_admin_audit_logs WHERE landlord_id = :lid ORDER BY created_at DESC"),
        {"lid": landlord_id},
    )
    tokens = await db.execute(
        text("SELECT id, raw_token, expires_at, used_at, created_at FROM landlord_activation_tokens WHERE landlord_id = :lid ORDER BY created_at DESC LIMIT 5"),
        {"lid": landlord_id},
    )

    def to_dicts(result):
        cols = result.keys()
        out = []
        for row in result.fetchall():
            d = dict(zip(cols, row))
            for k, v in d.items():
                if hasattr(v, "hex"):
                    d[k] = str(v)
                elif hasattr(v, "isoformat"):
                    d[k] = v.isoformat()
                elif isinstance(v, Decimal):
                    d[k] = float(v)
            out.append(d)
        return out

    return {
        "landlord": _safe_dict(landlord),
        "rooms": to_dicts(rooms),
        "tenants": to_dicts(tenants),
        "payments": to_dicts(payments),
        "history": to_dicts(history),
        "activationTokens": to_dicts(tokens),
    }


# ─── POST /api/superadmin/landlords ──────────────────────────────────────────
@router.post("/landlords", status_code=201)
async def create_landlord(body: CreateLandlord, request: Request, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    if not body.fullName or not body.email:
        raise HTTPException(400, "Full name and email are required")

    existing = await db.execute(select(Landlord).where(func.lower(Landlord.email) == body.email.strip().lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "A landlord account with this email already exists")

    count = (await db.execute(text("SELECT COUNT(*) FROM landlords"))).scalar()
    landlord_code = f"LL-{str(int(count) + 1).zfill(3)}"

    fee = body.oneTimeFee or 500.00
    is_paid = bool(body.paymentReceived and body.autoApprove)
    status = "Active" if is_paid else ("Pending Activation" if body.paymentReceived else "Pending Payment")

    landlord = Landlord(
        landlord_code=landlord_code,
        full_name=body.fullName.strip(),
        email=body.email.strip().lower(),
        phone=body.phone or "",
        property_name=body.propertyName or "DwellBase Property",
        property_address=body.propertyAddress or "",
        one_time_fee=Decimal(str(fee)),
        is_paid=is_paid,
        payment_approved_at=datetime.now(timezone.utc) if is_paid else None,
        account_activated_at=datetime.now(timezone.utc) if is_paid else None,
        account_status=status,
    )
    db.add(landlord)
    await db.flush()

    # Record payment if received
    payment_record = None
    if body.paymentReceived:
        payment_date = body.dateReceived or date.today().isoformat()
        payment_id = f"OTP-{str(int(datetime.now(timezone.utc).timestamp()))[-6:]}-{secrets.randbelow(900) + 100}"
        admin_name = user.full_name or "Super Admin"
        p_status = "approved" if body.autoApprove else "pending_verification"

        payment = LandlordAccessPayment(
            payment_id=payment_id,
            landlord_id=landlord.id,
            landlord_name=landlord.full_name,
            landlord_email=landlord.email,
            amount=Decimal(str(fee)),
            payment_method=body.paymentMethod,
            date_received=payment_date,
            external_reference=body.externalReference,
            receipt_number=body.receiptNumber,
            status=p_status,
            recorded_by=admin_name,
            approved_by=admin_name if body.autoApprove else None,
            approval_date=datetime.now(timezone.utc) if body.autoApprove else None,
            notes=body.notes or (
                "Payment received and approved during manual creation" if body.autoApprove else "Payment recorded awaiting verification"
            ),
        )
        db.add(payment)
        await db.flush()
        payment_record = _safe_dict(payment, exclude=set())

    # Seed default billing categories
    for cat in [
        ("Rent", "Monthly/Yearly room rent", "yearly", 7),
        ("Light Bill", "Electricity charges", "monthly", 7),
        ("Water Bill", "Water supply charges", "monthly", 7),
    ]:
        db.add(BillingCategory(
            landlord_id=landlord.id, name=cat[0], description=cat[1],
            billing_frequency=cat[2], is_default=True, grace_period_days=cat[3],
        ))

    # Generate activation token if status is Active
    activation_data = None
    if status == "Active":
        tok_data = await generate_activation_token(db, str(landlord.id))
        origin = str(request.base_url).rstrip("/")
        activation_data = {
            "token": tok_data["rawToken"],
            "activationLink": f"{origin}/activate?token={tok_data['rawToken']}",
            "expiresAt": tok_data["expiresAt"].isoformat(),
        }

    await log_action(db, user, "CREATE_LANDLORD", landlord.id, landlord.full_name, {
        "landlordCode": landlord_code, "email": landlord.email, "fee": fee, "status": status, "paymentRecorded": body.paymentReceived,
    }, body.notes or f"Landlord created by Super Admin (Status: {status})")

    await db.commit()

    return {
        "landlord": _safe_dict(landlord),
        "payment": payment_record,
        "activation": activation_data,
        "message": f"Landlord account {landlord_code} created successfully.",
    }


# ─── PATCH /api/superadmin/landlords/:id ─────────────────────────────────────
@router.patch("/landlords/{landlord_id}")
async def edit_landlord(landlord_id: str, body: EditLandlord, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    before = {"fullName": landlord.full_name, "email": landlord.email, "phone": landlord.phone}
    updated_any = False

    if body.fullName is not None:
        landlord.full_name = body.fullName.strip()
        updated_any = True
    if body.email is not None:
        landlord.email = body.email.strip().lower()
        updated_any = True
    if body.phone is not None:
        landlord.phone = body.phone.strip()
        updated_any = True
    if body.propertyName is not None:
        landlord.property_name = body.propertyName.strip()
        updated_any = True
    if body.propertyAddress is not None:
        landlord.property_address = body.propertyAddress.strip()
        updated_any = True

    if not updated_any:
        raise HTTPException(400, "No profile fields provided to update")

    landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "EDIT_LANDLORD", landlord.id, landlord.full_name, {
        "before": before,
        "after": {"fullName": landlord.full_name, "email": landlord.email, "phone": landlord.phone},
    }, body.notes or "Updated landlord profile information")

    await db.commit()
    return {"landlord": _safe_dict(landlord), "message": "Landlord profile updated successfully."}


# ─── POST /api/superadmin/landlords/:id/activate ─────────────────────────────
@router.post("/landlords/{landlord_id}/activate")
async def activate_landlord(landlord_id: str, body: ActionNotes, request: Request, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    prev_status = landlord.account_status

    # Approve pending payment if exists
    pending = await db.execute(
        text("SELECT id FROM landlord_access_payments WHERE landlord_id = :lid AND status = 'pending_verification' ORDER BY created_at DESC LIMIT 1"),
        {"lid": landlord_id},
    )
    pending_row = pending.first()
    if pending_row:
        admin_name = user.full_name or "Super Admin"
        await db.execute(
            text("UPDATE landlord_access_payments SET status = 'approved', approved_by = :admin, approval_date = NOW(), updated_at = NOW() WHERE id = :pid"),
            {"admin": admin_name, "pid": str(pending_row[0])},
        )

    landlord.is_paid = True
    if not landlord.payment_approved_at:
        landlord.payment_approved_at = datetime.now(timezone.utc)
    if not landlord.account_activated_at:
        landlord.account_activated_at = datetime.now(timezone.utc)
    landlord.account_status = "Active"
    landlord.suspension_reason = ""
    landlord.updated_at = datetime.now(timezone.utc)

    # Generate activation token if no password set
    activation_data = None
    if not landlord.password_hash:
        tok_data = await generate_activation_token(db, landlord_id)
        origin = str(request.base_url).rstrip("/")
        activation_data = {
            "token": tok_data["rawToken"],
            "activationLink": f"{origin}/activate?token={tok_data['rawToken']}",
            "expiresAt": tok_data["expiresAt"].isoformat(),
        }

    await log_action(db, user, "ACTIVATE_ACCOUNT", landlord.id, landlord.full_name, {
        "previousStatus": prev_status, "newStatus": "Active", "isPaid": True,
    }, body.notes or "Account activated after one-time payment verification")

    await db.commit()
    return {
        "landlord": _safe_dict(landlord),
        "activation": activation_data,
        "message": f"Account for {landlord.full_name} has been activated with permanent access.",
    }


# ─── POST /api/superadmin/landlords/:id/suspend ──────────────────────────────
@router.post("/landlords/{landlord_id}/suspend")
async def suspend_landlord(landlord_id: str, body: ActionNotes, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    if not body.reason.strip():
        raise HTTPException(400, "A suspension reason is required for safety and audit purposes")

    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    prev = landlord.account_status
    landlord.account_status = "Suspended"
    landlord.suspension_reason = body.reason.strip()
    landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "SUSPEND_ACCOUNT", landlord.id, landlord.full_name, {
        "previousStatus": prev, "newStatus": "Suspended", "reason": body.reason.strip(),
    }, body.notes if body.notes else body.reason.strip())

    await db.commit()
    return {
        "landlord": _safe_dict(landlord),
        "message": f"Account for {landlord.full_name} has been suspended. All records remain safely preserved.",
    }


# ─── POST /api/superadmin/landlords/:id/reactivate ───────────────────────────
@router.post("/landlords/{landlord_id}/reactivate")
async def reactivate_landlord(landlord_id: str, body: ActionNotes, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")
    if landlord.account_status != "Suspended":
        raise HTTPException(400, "Account is not currently suspended")

    landlord.account_status = "Active"
    landlord.suspension_reason = ""
    landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "REACTIVATE_ACCOUNT", landlord.id, landlord.full_name, {
        "previousStatus": "Suspended", "newStatus": "Active",
    }, body.notes or "Account reactivated by Super Admin without additional fee")

    await db.commit()
    return {
        "landlord": _safe_dict(landlord),
        "message": f"Account for {landlord.full_name} has been reactivated. Access restored.",
    }


# ─── POST /api/superadmin/landlords/:id/reset-access ─────────────────────────
@router.post("/landlords/{landlord_id}/reset-access")
async def reset_access(landlord_id: str, body: ActionNotes, request: Request, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    tok_data = await generate_activation_token(db, landlord_id)
    origin = str(request.base_url).rstrip("/")
    activation_link = f"{origin}/activate?token={tok_data['rawToken']}"

    temp_pw = body.temporaryPassword
    if temp_pw and temp_pw.strip():
        landlord.password_hash = hash_password(temp_pw.strip())
        landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "RESET_ACCESS", landlord.id, landlord.full_name, {
        "tokenGenerated": True, "expiresAt": tok_data["expiresAt"].isoformat(),
    }, body.notes or "Generated single-use activation / password reset link")

    await db.commit()

    return {
        "message": "Access link generated successfully.",
        "activationLink": activation_link,
        "token": tok_data["rawToken"],
        "temporaryPassword": temp_pw or None,
        "expiresAt": tok_data["expiresAt"].isoformat(),
    }


# ─── GET /api/superadmin/payments ────────────────────────────────────────────
@router.get("/payments")
async def list_access_payments(user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT p.*, l.landlord_code, l.phone as landlord_phone, l.account_status as landlord_account_status
        FROM landlord_access_payments p
        JOIN landlords l ON l.id = p.landlord_id
        ORDER BY p.created_at DESC
    """))
    cols = result.keys()
    out = []
    for row in result.fetchall():
        d = dict(zip(cols, row))
        for k, v in d.items():
            if hasattr(v, "hex"):
                d[k] = str(v)
            elif hasattr(v, "isoformat"):
                d[k] = v.isoformat()
            elif isinstance(v, Decimal):
                d[k] = float(v)
        out.append(d)
    return out


# ─── POST /api/superadmin/payments ───────────────────────────────────────────
@router.post("/payments", status_code=201)
async def record_access_payment(body: RecordPayment, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    if not body.landlordId or not body.amount:
        raise HTTPException(400, "Landlord ID and payment amount are required")

    result = await db.execute(select(Landlord).where(Landlord.id == body.landlordId))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    if body.autoApprove:
        approved_check = await db.execute(
            text("SELECT id FROM landlord_access_payments WHERE landlord_id = :lid AND status = 'approved'"),
            {"lid": body.landlordId},
        )
        if approved_check.first():
            raise HTTPException(400, "This landlord already has an approved one-time account access payment.")

    payment_date = body.dateReceived or date.today().isoformat()
    payment_id = f"OTP-{str(int(datetime.now(timezone.utc).timestamp()))[-6:]}-{secrets.randbelow(900) + 100}"
    admin_name = user.full_name or "Super Admin"
    p_status = "approved" if body.autoApprove else "pending_verification"

    payment = LandlordAccessPayment(
        payment_id=payment_id,
        landlord_id=landlord.id,
        landlord_name=landlord.full_name,
        landlord_email=landlord.email,
        amount=Decimal(str(body.amount)),
        payment_method=body.paymentMethod,
        date_received=payment_date,
        external_reference=body.externalReference,
        receipt_number=body.receiptNumber,
        status=p_status,
        recorded_by=admin_name,
        approved_by=admin_name if body.autoApprove else None,
        approval_date=datetime.now(timezone.utc) if body.autoApprove else None,
        notes=body.notes,
    )
    db.add(payment)

    if body.autoApprove:
        landlord.is_paid = True
        landlord.payment_approved_at = datetime.now(timezone.utc)
        landlord.account_status = "Active"
        if not landlord.account_activated_at:
            landlord.account_activated_at = datetime.now(timezone.utc)
        landlord.updated_at = datetime.now(timezone.utc)
    elif landlord.account_status != "Active":
        landlord.account_status = "Pending Activation"
        landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "APPROVE_PAYMENT" if body.autoApprove else "RECORD_PAYMENT",
                     landlord.id, landlord.full_name, {
                         "paymentId": payment_id, "amount": body.amount, "paymentMethod": body.paymentMethod, "status": p_status,
                     }, body.notes or ("Recorded and approved one-time access payment" if body.autoApprove else "Recorded one-time payment for verification"))

    await db.commit()
    return {
        "payment": _safe_dict(payment, exclude=set()),
        "message": "Payment approved and landlord account activated." if body.autoApprove else "Payment recorded as Pending Verification.",
    }


# ─── POST /api/superadmin/payments/:id/approve ───────────────────────────────
@router.post("/payments/{payment_id}/approve")
async def approve_payment(payment_id: str, body: ActionNotes, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LandlordAccessPayment).where(LandlordAccessPayment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment record not found")
    if payment.status == "approved":
        raise HTTPException(400, "This payment is already approved")

    admin_name = user.full_name or "Super Admin"
    payment.status = "approved"
    payment.approved_by = admin_name
    payment.approval_date = datetime.now(timezone.utc)
    if body.notes:
        payment.notes = f"{payment.notes} | {body.notes}" if payment.notes else body.notes
    payment.updated_at = datetime.now(timezone.utc)

    # Activate landlord
    ll_result = await db.execute(select(Landlord).where(Landlord.id == payment.landlord_id))
    landlord = ll_result.scalar_one_or_none()
    if landlord:
        landlord.is_paid = True
        landlord.payment_approved_at = datetime.now(timezone.utc)
        landlord.account_status = "Active"
        if not landlord.account_activated_at:
            landlord.account_activated_at = datetime.now(timezone.utc)
        landlord.suspension_reason = ""
        landlord.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "APPROVE_PAYMENT", landlord.id if landlord else None, landlord.full_name if landlord else "", {
        "paymentId": payment.payment_id, "amount": float(payment.amount), "paymentMethod": payment.payment_method,
    }, body.notes or "Super Admin approved one-time account access payment")

    await db.commit()
    return {
        "payment": _safe_dict(payment, exclude=set()),
        "landlord": _safe_dict(landlord) if landlord else None,
        "message": f"Payment {payment.payment_id} approved. Account for {landlord.full_name if landlord else 'unknown'} is now permanently Active.",
    }


# ─── POST /api/superadmin/payments/:id/reject ────────────────────────────────
@router.post("/payments/{payment_id}/reject")
async def reject_payment(payment_id: str, body: ActionNotes, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    if not body.reason.strip():
        raise HTTPException(400, "A rejection reason is required")

    result = await db.execute(select(LandlordAccessPayment).where(LandlordAccessPayment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment record not found")

    payment.status = "rejected"
    payment.rejection_reason = body.reason.strip()
    payment.updated_at = datetime.now(timezone.utc)

    # Check if other approved payments exist
    other = await db.execute(
        text("SELECT id FROM landlord_access_payments WHERE landlord_id = :lid AND status = 'approved' AND id != :pid"),
        {"lid": str(payment.landlord_id), "pid": payment_id},
    )
    if not other.first():
        await db.execute(
            text("UPDATE landlords SET is_paid = false, account_status = 'Pending Payment', updated_at = NOW() WHERE id = :lid AND account_status != 'Suspended'"),
            {"lid": str(payment.landlord_id)},
        )

    await log_action(db, user, "REJECT_PAYMENT", payment.landlord_id, payment.landlord_name, {
        "paymentId": payment.payment_id, "amount": float(payment.amount), "reason": body.reason.strip(),
    }, f"{body.reason.strip()} — {body.notes}" if body.notes else body.reason.strip())

    await db.commit()
    return {
        "payment": _safe_dict(payment, exclude=set()),
        "message": f"Payment {payment.payment_id} rejected. Reason: {body.reason}",
    }


# ─── POST /api/superadmin/payments/:id/reverse ───────────────────────────────
@router.post("/payments/{payment_id}/reverse")
async def reverse_access_payment(payment_id: str, body: ActionNotes, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    if not body.reason.strip():
        raise HTTPException(400, "A reversal reason is required")

    result = await db.execute(select(LandlordAccessPayment).where(LandlordAccessPayment.id == payment_id))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment record not found")

    payment.status = "reversed"
    payment.reversal_reason = body.reason.strip()
    payment.updated_at = datetime.now(timezone.utc)

    await log_action(db, user, "REVERSE_PAYMENT", payment.landlord_id, payment.landlord_name, {
        "paymentId": payment.payment_id, "amount": float(payment.amount), "reason": body.reason.strip(),
    }, f"{body.reason.strip()} — {body.notes}" if body.notes else body.reason.strip())

    await db.commit()
    return {
        "payment": _safe_dict(payment, exclude=set()),
        "message": f"Payment {payment.payment_id} has been marked as reversed for audit review.",
    }


# ─── GET /api/superadmin/audit-logs ──────────────────────────────────────────
@router.get("/audit-logs")
async def list_audit_logs(user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM super_admin_audit_logs ORDER BY created_at DESC LIMIT 300"))
    cols = result.keys()
    out = []
    for row in result.fetchall():
        d = dict(zip(cols, row))
        for k, v in d.items():
            if hasattr(v, "hex"):
                d[k] = str(v)
            elif hasattr(v, "isoformat"):
                d[k] = v.isoformat()
            elif isinstance(v, Decimal):
                d[k] = float(v)
        out.append(d)
    return out


# ─── GET & PATCH /api/superadmin/settings ─────────────────────────────────────
@router.get("/settings")
async def get_platform_settings(user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformSetting))
    return {r.key: r.value for r in result.scalars().all()}


@router.patch("/settings")
async def update_platform_settings(body: dict, user: TokenData = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    for key, value in body.items():
        await db.execute(
            text("""
                INSERT INTO platform_settings (key, value, updated_at)
                VALUES (:key, :val, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            """),
            {"key": key, "val": str(value)},
        )

    await log_action(db, user, "UPDATE_SETTINGS", None, "Platform Settings", body, "Super Admin updated platform configuration")

    await db.commit()

    result = await db.execute(select(PlatformSetting))
    settings_map = {r.key: r.value for r in result.scalars().all()}
    return {"settings": settings_map, "message": "Platform settings updated successfully."}
