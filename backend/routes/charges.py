"""Charges routes — ports server/routes/charges.js to FastAPI."""

from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Charge
from backend.auth import TokenData, require_auth, require_landlord

router = APIRouter(prefix="/charges", tags=["charges"])


def _row_dict(c: Charge) -> dict:
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d


class ChargeCreate(BaseModel):
    categoryId: str | None = None
    categoryName: str
    tenantId: str | None = None
    tenantName: str
    roomId: str | None = None
    roomNumber: str
    amount: float
    issueDate: str
    dueDate: str
    billingPeriod: str
    issuedBy: str


class ChargeStatusUpdate(BaseModel):
    status: str
    amountPaid: float
    remainingBalance: float


# ─── GET /api/charges ─────────────────────────────────────────────────────────
@router.get("/")
async def list_charges(user: TokenData = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if user.role == "landlord":
        result = await db.execute(
            select(Charge).where(Charge.landlord_id == user.landlord_id).order_by(Charge.created_at.desc())
        )
    else:
        result = await db.execute(
            select(Charge).where(Charge.tenant_id == user.tenant_db_id).order_by(Charge.created_at.desc())
        )
    return [_row_dict(c) for c in result.scalars().all()]


# ─── POST /api/charges ───────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_charge(body: ChargeCreate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    charge = Charge(
        landlord_id=user.landlord_id,
        category_id=body.categoryId or None,
        category_name=body.categoryName,
        tenant_id=body.tenantId or None,
        tenant_name=body.tenantName,
        room_id=body.roomId or None,
        room_number=body.roomNumber,
        amount=Decimal(str(body.amount)),
        amount_paid=Decimal("0"),
        remaining_balance=Decimal(str(body.amount)),
        issue_date=body.issueDate,
        due_date=body.dueDate,
        billing_period=body.billingPeriod,
        status="upcoming",
        issued_by=body.issuedBy,
    )
    db.add(charge)
    await db.commit()
    await db.refresh(charge)
    return _row_dict(charge)


# ─── PATCH /api/charges/:id/status ────────────────────────────────────────────
@router.patch("/{charge_id}/status")
async def update_charge_status(charge_id: str, body: ChargeStatusUpdate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Charge).where(Charge.id == charge_id, Charge.landlord_id == user.landlord_id)
    )
    charge = result.scalar_one_or_none()
    if not charge:
        raise HTTPException(404, "Charge not found")

    charge.status = body.status
    charge.amount_paid = Decimal(str(body.amountPaid))
    charge.remaining_balance = Decimal(str(body.remainingBalance))

    await db.commit()
    await db.refresh(charge)
    return _row_dict(charge)
