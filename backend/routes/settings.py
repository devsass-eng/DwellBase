"""Settings routes — ports server/routes/settings.js to FastAPI."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Landlord, BillingCategory
from backend.auth import TokenData, require_landlord, hash_password

router = APIRouter(prefix="/settings", tags=["settings"])


def _landlord_settings(l: Landlord) -> dict:
    fields = [
        "id", "full_name", "email", "phone", "property_name", "property_address",
        "momo_network", "momo_name", "momo_number", "payment_instructions",
        "notif_new_tenant", "notif_manual_momo", "notif_confirmed_payment",
        "notif_upcoming_charges", "notif_overdue_charges",
    ]
    d = {}
    for f in fields:
        v = getattr(l, f)
        if hasattr(v, "hex"):
            d[f] = str(v)
        elif isinstance(v, Decimal):
            d[f] = float(v)
        else:
            d[f] = v
    return d


def _cat_dict(c: BillingCategory) -> dict:
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d


# camelCase → snake_case map for incoming fields
_FIELD_MAP = {
    "fullName": "full_name", "propertyName": "property_name",
    "propertyAddress": "property_address", "momoNetwork": "momo_network",
    "momoName": "momo_name", "momoNumber": "momo_number",
    "paymentInstructions": "payment_instructions",
    "notifNewTenant": "notif_new_tenant", "notifManualMomo": "notif_manual_momo",
    "notifConfirmedPayment": "notif_confirmed_payment",
    "notifUpcomingCharges": "notif_upcoming_charges",
    "notifOverdueCharges": "notif_overdue_charges",
}

_ALLOWED = {
    "full_name", "phone", "property_name", "property_address",
    "momo_network", "momo_name", "momo_number", "payment_instructions",
    "notif_new_tenant", "notif_manual_momo", "notif_confirmed_payment",
    "notif_upcoming_charges", "notif_overdue_charges",
}


# ─── GET /api/settings ───────────────────────────────────────────────────────
@router.get("/")
async def get_settings(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == user.landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")
    return _landlord_settings(landlord)


# ─── PATCH /api/settings ─────────────────────────────────────────────────────
@router.patch("/")
async def update_settings(body: dict, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Landlord).where(Landlord.id == user.landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(404, "Landlord not found")

    for camel, snake in _FIELD_MAP.items():
        if camel in body:
            body[snake] = body.pop(camel)

    for col, val in body.items():
        if col in _ALLOWED:
            setattr(landlord, col, val)

    if "newPassword" in body and body["newPassword"]:
        landlord.password_hash = hash_password(body["newPassword"])

    landlord.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(landlord)
    return _landlord_settings(landlord)


# ─── GET /api/settings/billing-categories ─────────────────────────────────────
@router.get("/billing-categories")
async def list_billing_categories(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BillingCategory)
        .where(BillingCategory.landlord_id == user.landlord_id)
        .order_by(BillingCategory.created_at)
    )
    return [_cat_dict(c) for c in result.scalars().all()]


# ─── POST /api/settings/billing-categories ────────────────────────────────────
class BillingCategoryCreate(BaseModel):
    name: str
    description: str = ""
    billingFrequency: str
    customIntervalMonths: int | None = None
    defaultAmount: float | None = None
    gracePeriodDays: int = 7


@router.post("/billing-categories", status_code=201)
async def create_billing_category(body: BillingCategoryCreate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    cat = BillingCategory(
        landlord_id=user.landlord_id,
        name=body.name,
        description=body.description,
        billing_frequency=body.billingFrequency,
        custom_interval_months=body.customIntervalMonths,
        default_amount=Decimal(str(body.defaultAmount)) if body.defaultAmount else None,
        grace_period_days=body.gracePeriodDays,
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return _cat_dict(cat)


# ─── PATCH /api/settings/billing-categories/:id ───────────────────────────────
class BillingCategoryUpdate(BaseModel):
    status: str


@router.patch("/billing-categories/{cat_id}")
async def update_billing_category(cat_id: str, body: BillingCategoryUpdate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BillingCategory).where(
            BillingCategory.id == cat_id,
            BillingCategory.landlord_id == user.landlord_id,
        )
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(404, "Category not found")
    cat.status = body.status
    await db.commit()
    await db.refresh(cat)
    return _cat_dict(cat)
