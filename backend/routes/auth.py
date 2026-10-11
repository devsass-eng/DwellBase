"""Auth routes — ports server/routes/auth.js to FastAPI."""

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import (
    SuperAdmin, Landlord, Tenant, PlatformSetting, LandlordActivationToken,
)
from backend.auth import (
    hash_password, verify_password, create_token, TokenData, require_auth,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Schemas ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str | None = None
    password: str | None = None
    tenantId: str | None = None


class ActivationRequest(BaseModel):
    token: str
    password: str


# ─── GET /api/auth/public-settings ────────────────────────────────────────────
@router.get("/public-settings")
async def public_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformSetting))
    rows = result.scalars().all()
    return {r.key: r.value for r in rows}


# ─── POST /api/auth/superadmin/login ──────────────────────────────────────────
@router.post("/superadmin/login")
async def superadmin_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    if not body.email or not body.password:
        raise HTTPException(400, "Email and password are required")

    result = await db.execute(
        select(SuperAdmin).where(func.lower(SuperAdmin.email) == body.email.strip().lower())
    )
    admin = result.scalar_one_or_none()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(401, "Invalid Super Admin credentials")

    token = create_token({
        "id": str(admin.id),
        "role": "super_admin",
        "superAdminId": str(admin.id),
        "fullName": admin.full_name,
        "email": admin.email,
    })
    return {
        "token": token,
        "superAdmin": {
            "id": str(admin.id),
            "full_name": admin.full_name,
            "email": admin.email,
            "created_at": admin.created_at.isoformat() if admin.created_at else None,
        },
    }


# ─── GET /api/auth/verify-activation-token ────────────────────────────────────
@router.get("/verify-activation-token")
async def verify_activation_token(token: str, db: AsyncSession = Depends(get_db)):
    if not token:
        raise HTTPException(400, "Activation token is required")

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    result = await db.execute(
        select(LandlordActivationToken, Landlord)
        .join(Landlord, Landlord.id == LandlordActivationToken.landlord_id)
        .where(LandlordActivationToken.token_hash == token_hash)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Invalid or non-existent activation link.")

    tok, landlord = row
    if tok.used_at:
        raise HTTPException(400, "This activation link has already been used. Please log in with your credentials.")
    if tok.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(410, "This activation link has expired. Please contact the platform owner to issue a fresh access link.")

    return {
        "valid": True,
        "landlord": {
            "id": str(landlord.id),
            "fullName": landlord.full_name,
            "email": landlord.email,
            "propertyName": landlord.property_name,
        },
        "expiresAt": tok.expires_at.isoformat(),
    }


# ─── POST /api/auth/complete-activation ───────────────────────────────────────
@router.post("/complete-activation")
async def complete_activation(body: ActivationRequest, db: AsyncSession = Depends(get_db)):
    if not body.token or not body.password:
        raise HTTPException(400, "Token and password are required")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters long")

    token_hash = hashlib.sha256(body.token.encode()).hexdigest()

    result = await db.execute(
        select(LandlordActivationToken, Landlord)
        .join(Landlord, Landlord.id == LandlordActivationToken.landlord_id)
        .where(LandlordActivationToken.token_hash == token_hash)
    )
    row = result.first()
    if not row:
        raise HTTPException(404, "Invalid activation link")

    tok, landlord = row
    if tok.used_at:
        raise HTTPException(400, "This activation link has already been used")
    if tok.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(410, "This activation link has expired")

    # Hash password and activate
    landlord.password_hash = hash_password(body.password)
    landlord.is_paid = True
    landlord.account_status = "Active"
    if not landlord.account_activated_at:
        landlord.account_activated_at = datetime.now(timezone.utc)
    landlord.updated_at = datetime.now(timezone.utc)

    tok.used_at = datetime.now(timezone.utc)

    await db.commit()

    jwt_token = create_token({
        "id": str(landlord.id),
        "role": "landlord",
        "landlordId": str(landlord.id),
    })
    return {
        "success": True,
        "token": jwt_token,
        "landlord": {
            "id": str(landlord.id),
            "full_name": landlord.full_name,
            "email": landlord.email,
            "property_name": landlord.property_name,
        },
        "message": "Your password has been set and your account is active with permanent access!",
    }


# ─── POST /api/auth/landlord/login ───────────────────────────────────────────
@router.post("/landlord/login")
async def landlord_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    if not body.email or not body.password:
        raise HTTPException(400, "Email and password are required")

    email = body.email.strip().lower()

    # Try landlord first
    result = await db.execute(select(Landlord).where(func.lower(Landlord.email) == email))
    landlord = result.scalar_one_or_none()

    if not landlord:
        # Check if super admin logging in through unified Admin Login
        sa_result = await db.execute(select(SuperAdmin).where(func.lower(SuperAdmin.email) == email))
        admin = sa_result.scalar_one_or_none()
        if admin and verify_password(body.password, admin.password_hash):
            token = create_token({
                "id": str(admin.id),
                "role": "super_admin",
                "email": admin.email,
                "fullName": admin.full_name,
            })
            return {
                "token": token,
                "role": "super_admin",
                "superAdmin": {"id": str(admin.id), "full_name": admin.full_name, "email": admin.email},
                "redirectTo": "/superadmin/dashboard",
            }
        raise HTTPException(401, "Invalid email or password")

    if not landlord.password_hash:
        raise HTTPException(401, "Your account has not been activated yet. Please check your activation link or contact the platform owner.")

    if not verify_password(body.password, landlord.password_hash):
        raise HTTPException(401, "Invalid email or password")

    if landlord.account_status == "Suspended":
        reason = f": {landlord.suspension_reason}" if landlord.suspension_reason else ""
        raise HTTPException(403, f"Your landlord account has been suspended{reason}. All records remain preserved. Please contact the platform administrator.")

    if landlord.account_status == "Pending Payment":
        raise HTTPException(403, "Your account is pending one-time access fee payment. Please contact the platform owner to arrange payment.")

    if landlord.account_status == "Pending Activation":
        raise HTTPException(403, "Your one-time access payment has been recorded and is awaiting Super Admin verification and activation.")

    token = create_token({
        "id": str(landlord.id),
        "role": "landlord",
        "landlordId": str(landlord.id),
    })

    # Build safe response (exclude password_hash)
    safe = {
        c.name: getattr(landlord, c.name)
        for c in landlord.__table__.columns
        if c.name != "password_hash"
    }
    # Convert UUIDs and datetimes to strings
    for k, v in safe.items():
        if hasattr(v, "hex"):  # UUID
            safe[k] = str(v)
        elif hasattr(v, "isoformat"):  # datetime/date
            safe[k] = v.isoformat()
        elif isinstance(v, __import__("decimal").Decimal):
            safe[k] = float(v)

    return {"token": token, "landlord": safe}


# ─── POST /api/auth/tenant/login ─────────────────────────────────────────────
@router.post("/tenant/login")
async def tenant_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    if not body.tenantId or not body.password:
        raise HTTPException(400, "Tenant ID, phone, or email and password are required")

    raw_id = body.tenantId.strip()

    result = await db.execute(
        select(Tenant).where(
            or_(
                func.upper(Tenant.tenant_id) == raw_id.upper(),
                Tenant.phone == raw_id,
                (Tenant.email != None) & (Tenant.email != "") & (func.lower(Tenant.email) == raw_id.lower()),
                func.lower(Tenant.full_name) == raw_id.lower(),
            )
        )
    )
    candidates = result.scalars().all()

    if not candidates:
        raise HTTPException(401, "Invalid Tenant ID or password")

    matched = None
    for tenant in candidates:
        if tenant.password_hash:
            if verify_password(body.password.strip(), tenant.password_hash) or verify_password(body.password, tenant.password_hash):
                matched = tenant
                break

    if not matched:
        unactivated = next((t for t in candidates if not t.password_hash), None)
        if unactivated:
            raise HTTPException(401, "Tenant login credentials have not been generated yet. Please contact your landlord.")
        raise HTTPException(401, "Invalid Tenant ID or password")

    if matched.account_status == "Suspended":
        raise HTTPException(403, "Your tenant login access has been suspended by your landlord.")

    token = create_token({
        "id": str(matched.id),
        "role": "tenant",
        "landlordId": str(matched.landlord_id),
        "tenantDbId": str(matched.id),
    })

    safe = {
        c.name: getattr(matched, c.name)
        for c in matched.__table__.columns
        if c.name != "password_hash"
    }
    for k, v in safe.items():
        if hasattr(v, "hex"):
            safe[k] = str(v)
        elif hasattr(v, "isoformat"):
            safe[k] = v.isoformat()
        elif isinstance(v, __import__("decimal").Decimal):
            safe[k] = float(v)

    return {"token": token, "tenant": safe}
