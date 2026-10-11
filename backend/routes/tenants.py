"""Tenant routes — ports server/routes/tenants.js to FastAPI."""

import secrets
import string
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Tenant, Room, Charge, Payment
from backend.auth import (
    TokenData, require_landlord, require_tenant, require_auth, hash_password,
)

router = APIRouter(prefix="/tenants", tags=["tenants"])


def _safe_tenant(tenant: Tenant) -> dict:
    d = {c.name: getattr(tenant, c.name) for c in tenant.__table__.columns if c.name != "password_hash"}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d


def _gen_temp_password(length: int = 8) -> str:
    chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(chars) for _ in range(length))


# ─── Schemas ──────────────────────────────────────────────────────────────────
class TenantCreate(BaseModel):
    tenantId: str
    fullName: str
    phone: str = ""
    email: str = ""
    roomId: str | None = None
    roomNumber: str = ""
    roomCode: str = ""
    monthlyRent: float = 0
    startDate: str | None = None
    durationMonths: int = 0
    endDate: str | None = None
    totalContractualRent: float = 0
    amountPaid: float = 0
    outstandingBalance: float = 0
    tenancyStatus: str = "Upcoming"
    accountStatus: str | None = None
    createLogin: str | bool | None = None


class TenantUpdate(BaseModel):
    fullName: str | None = None
    full_name: str | None = None
    phone: str | None = None
    email: str | None = None
    roomId: str | None = None
    room_id: str | None = None
    roomNumber: str | None = None
    room_number: str | None = None
    roomCode: str | None = None
    room_code: str | None = None
    monthlyRent: float | None = None
    monthly_rent: float | None = None
    startDate: str | None = None
    start_date: str | None = None
    durationMonths: int | None = None
    duration_months: int | None = None
    endDate: str | None = None
    end_date: str | None = None
    totalContractualRent: float | None = None
    total_contractual_rent: float | None = None
    amountPaid: float | None = None
    amount_paid: float | None = None
    outstandingBalance: float | None = None
    outstanding_balance: float | None = None
    tenancyStatus: str | None = None
    tenancy_status: str | None = None
    accountStatus: str | None = None
    account_status: str | None = None
    password: str | None = None
    notif_payment_confirmations: bool | None = None
    notif_manual_momo: bool | None = None
    notif_upcoming_bills: bool | None = None
    notif_overdue_charges: bool | None = None
    notif_new_regulations: bool | None = None


# camelCase → snake_case map
_FIELD_MAP = {
    "fullName": "full_name", "roomId": "room_id", "roomNumber": "room_number",
    "roomCode": "room_code", "monthlyRent": "monthly_rent", "startDate": "start_date",
    "durationMonths": "duration_months", "endDate": "end_date",
    "totalContractualRent": "total_contractual_rent", "amountPaid": "amount_paid",
    "outstandingBalance": "outstanding_balance", "tenancyStatus": "tenancy_status",
    "accountStatus": "account_status",
}

_ALLOWED_COLS = {
    "full_name", "phone", "email", "room_id", "room_number", "room_code",
    "monthly_rent", "start_date", "duration_months", "end_date",
    "total_contractual_rent", "amount_paid", "outstanding_balance",
    "tenancy_status", "account_status",
    "notif_payment_confirmations", "notif_manual_momo", "notif_upcoming_bills",
    "notif_overdue_charges", "notif_new_regulations",
}


# ─── GET /api/tenants ─────────────────────────────────────────────────────────
@router.get("/")
async def list_tenants(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.landlord_id == user.landlord_id).order_by(Tenant.created_at)
    )
    return [_safe_tenant(t) for t in result.scalars().all()]


# ─── GET /api/tenants/me ──────────────────────────────────────────────────────
@router.get("/me")
async def my_tenant_profile(user: TokenData = Depends(require_tenant), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_db_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return _safe_tenant(tenant)


# ─── POST /api/tenants ────────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_tenant(body: TenantCreate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    if not body.fullName or not body.tenantId:
        raise HTTPException(400, "fullName and tenantId are required")

    should_create = body.createLogin not in ("no", False)
    temp_password = None
    pw_hash = None
    final_status = "Active"

    if should_create:
        temp_password = _gen_temp_password()
        pw_hash = hash_password(temp_password)

    tenant = Tenant(
        landlord_id=user.landlord_id,
        tenant_id=body.tenantId,
        full_name=body.fullName,
        phone=body.phone or "",
        email=body.email or "",
        password_hash=pw_hash,
        room_id=body.roomId or None,
        room_number=body.roomNumber or "",
        room_code=body.roomCode or "",
        monthly_rent=Decimal(str(body.monthlyRent)) if body.monthlyRent else Decimal("0"),
        start_date=body.startDate or None,
        duration_months=body.durationMonths or 0,
        end_date=body.endDate or None,
        total_contractual_rent=Decimal(str(body.totalContractualRent)),
        amount_paid=Decimal(str(body.amountPaid)),
        outstanding_balance=Decimal(str(body.outstandingBalance)),
        tenancy_status=body.tenancyStatus or "Upcoming",
        account_status=final_status,
    )
    db.add(tenant)
    await db.flush()

    # Mark room as Occupied
    if body.roomId:
        await db.execute(
            text("UPDATE rooms SET status = 'Occupied', updated_at = NOW() WHERE id = :rid AND landlord_id = :lid"),
            {"rid": body.roomId, "lid": user.landlord_id},
        )

    await db.commit()
    await db.refresh(tenant)

    response = _safe_tenant(tenant)
    if temp_password:
        response["temporaryPassword"] = temp_password
        response["loginCredentials"] = {
            "tenantId": body.tenantId,
            "temporaryPassword": temp_password,
            "message": "Share these credentials with the tenant. They can change their password after first login.",
        }
    return response


# ─── PATCH /api/tenants/:id ───────────────────────────────────────────────────
@router.patch("/{tenant_id}")
async def update_tenant(tenant_id: str, body: TenantUpdate, user: TokenData = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if user.role == "landlord":
        result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id, Tenant.landlord_id == user.landlord_id)
        )
    else:
        if user.tenant_db_id != tenant_id:
            raise HTTPException(403, "Forbidden")
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))

    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    updates = body.model_dump(exclude_none=True)
    for camel, snake in _FIELD_MAP.items():
        if camel in updates:
            updates[snake] = updates.pop(camel)

    if "password" in updates:
        tenant.password_hash = hash_password(updates.pop("password"))

    for col, val in updates.items():
        if col in _ALLOWED_COLS:
            if isinstance(val, float):
                val = Decimal(str(val))
            setattr(tenant, col, val)

    tenant.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tenant)
    return _safe_tenant(tenant)


# ─── POST /api/tenants/:id/reset-password ─────────────────────────────────────
@router.post("/{tenant_id}/reset-password")
async def reset_tenant_password(tenant_id: str, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.landlord_id == user.landlord_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    temp_password = _gen_temp_password()
    tenant.password_hash = hash_password(temp_password)
    tenant.account_status = "Active"
    tenant.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(tenant)

    safe = _safe_tenant(tenant)
    safe["temporaryPassword"] = temp_password
    safe["loginCredentials"] = {
        "tenantId": tenant.tenant_id,
        "temporaryPassword": temp_password,
        "message": "Password reset successfully. Share this temporary password with the tenant.",
    }
    return safe


# ─── DELETE /api/tenants/:id ──────────────────────────────────────────────────
@router.delete("/{tenant_id}")
async def delete_tenant(tenant_id: str, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id, Tenant.landlord_id == user.landlord_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    room_id = tenant.room_id

    # Detach references
    await db.execute(text("UPDATE charges SET tenant_id = NULL WHERE tenant_id = :tid"), {"tid": str(tenant.id)})
    await db.execute(text("UPDATE payments SET tenant_id = NULL WHERE tenant_id = :tid"), {"tid": str(tenant.id)})

    await db.delete(tenant)

    # Check if room should be marked Vacant
    if room_id:
        active_check = await db.execute(
            text("SELECT 1 FROM tenants WHERE room_id = :rid AND tenancy_status IN ('Active','Upcoming','Expiring Soon') LIMIT 1"),
            {"rid": str(room_id)},
        )
        if not active_check.first():
            await db.execute(
                text("UPDATE rooms SET status = 'Vacant', updated_at = NOW() WHERE id = :rid"),
                {"rid": str(room_id)},
            )

    await db.commit()
    return {"success": True, "message": "Tenant deleted successfully"}
