"""JWT authentication dependencies — replaces server/middleware/auth.js."""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import jwt
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.database import get_db
from backend.models import Landlord

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


# ─── Password Helpers ─────────────────────────────────────────────────────────
def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── Token Helpers ────────────────────────────────────────────────────────────
def create_token(payload: dict, expires_days: int = None) -> str:
    exp_days = expires_days or settings.JWT_EXPIRY_DAYS
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(days=exp_days)}
    return jwt.encode(data, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ─── FastAPI Dependencies (mirrors auth.js middleware chain) ──────────────────
class TokenData:
    """Parsed JWT payload made available to route handlers."""
    def __init__(self, payload: dict):
        self.id = payload.get("id")
        self.role = payload.get("role")
        raw_lid = payload.get("landlordId") or payload.get("landlord_id") or (self.id if self.role == "landlord" else None)
        try:
            self.landlord_id = UUID(str(raw_lid)) if raw_lid else None
        except (ValueError, TypeError, AttributeError):
            self.landlord_id = raw_lid

        raw_sid = payload.get("superAdminId") or payload.get("super_admin_id") or (self.id if self.role == "super_admin" else None)
        try:
            self.super_admin_id = UUID(str(raw_sid)) if raw_sid else None
        except (ValueError, TypeError, AttributeError):
            self.super_admin_id = raw_sid

        self.tenant_db_id = payload.get("tenantDbId")
        self.full_name = payload.get("fullName")
        self.email = payload.get("email")
        self.raw = payload


async def require_auth(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> TokenData:
    """Base auth dependency — equivalent to requireAuth()."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Unauthorized")
    payload = decode_token(credentials.credentials)
    return TokenData(payload)


async def require_super_admin(
    user: TokenData = Depends(require_auth),
) -> TokenData:
    """Requires super_admin role — equivalent to requireSuperAdmin()."""
    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return user


async def require_landlord(
    user: TokenData = Depends(require_auth),
    db: AsyncSession = Depends(get_db),
) -> TokenData:
    """Requires landlord role + active account — equivalent to requireLandlord()."""
    if user.role != "landlord":
        raise HTTPException(status_code=403, detail="Landlord access required")

    if not user.landlord_id:
        raise HTTPException(status_code=401, detail="Landlord ID missing in token")

    try:
        lid = UUID(str(user.landlord_id)) if not isinstance(user.landlord_id, UUID) else user.landlord_id
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid landlord ID in token")

    result = await db.execute(
        select(Landlord.account_status).where(Landlord.id == lid)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=401, detail="Landlord account not found")
    if row == "Suspended":
        raise HTTPException(
            status_code=403,
            detail="Your landlord account has been suspended. Please contact Super Admin support.",
        )
    if row == "Pending Activation":
        raise HTTPException(
            status_code=403,
            detail="Your landlord account is pending activation by the Super Admin.",
        )
    return user


async def require_tenant(
    user: TokenData = Depends(require_auth),
) -> TokenData:
    """Requires tenant role — equivalent to requireTenant()."""
    if user.role != "tenant":
        raise HTTPException(status_code=403, detail="Tenant access required")
    return user


def gen_ref(prefix: str) -> str:
    """Generate a payment reference like CSH-XXXXXXXX-XXXX."""
    import time, random, string
    ts = hex(int(time.time()))[2:].upper()
    rnd = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{prefix}-{ts}-{rnd}"
