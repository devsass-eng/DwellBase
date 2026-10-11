"""Payment routes — ports server/routes/payments.js to FastAPI."""

from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Payment, Charge, AuditLog
from backend.auth import TokenData, require_auth, require_landlord, gen_ref

router = APIRouter(prefix="/payments", tags=["payments"])


def _row_dict(p: Payment) -> dict:
    d = {col.name: getattr(p, col.name) for col in p.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d


class CashPayment(BaseModel):
    tenantId: str | None = None
    tenantName: str
    roomId: str | None = None
    roomNumber: str
    chargeId: str | None = None
    categoryId: str | None = None
    categoryName: str
    billingPeriod: str
    amount: float
    paymentDate: str
    notes: str = ""
    recordedBy: str = "admin"


class MomoPayment(BaseModel):
    tenantId: str | None = None
    tenantName: str
    roomId: str | None = None
    roomNumber: str
    chargeId: str | None = None
    categoryId: str | None = None
    categoryName: str
    billingPeriod: str
    amount: float
    momoNetwork: str | None = None


class PaymentStatusUpdate(BaseModel):
    status: str
    providerRef: str | None = None


class ReverseRequest(BaseModel):
    reason: str = ""


# ─── GET /api/payments ────────────────────────────────────────────────────────
@router.get("/")
async def list_payments(user: TokenData = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    if user.role == "landlord":
        result = await db.execute(
            select(Payment).where(Payment.landlord_id == user.landlord_id).order_by(Payment.created_at.desc())
        )
    else:
        result = await db.execute(
            select(Payment).where(Payment.tenant_id == user.tenant_db_id).order_by(Payment.created_at.desc())
        )
    return [_row_dict(p) for p in result.scalars().all()]


# ─── POST /api/payments/cash ─────────────────────────────────────────────────
@router.post("/cash", status_code=201)
async def record_cash(body: CashPayment, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    ref = gen_ref("CSH")
    receipt = f"REC-{hex(int(datetime.now(timezone.utc).timestamp()))[2:].upper()}"

    payment = Payment(
        landlord_id=user.landlord_id,
        reference_number=ref,
        tenant_id=body.tenantId or None,
        tenant_name=body.tenantName,
        room_id=body.roomId or None,
        room_number=body.roomNumber,
        charge_id=body.chargeId or None,
        category_id=body.categoryId or None,
        category_name=body.categoryName,
        billing_period=body.billingPeriod,
        amount=Decimal(str(body.amount)),
        payment_method="cash",
        status="successful",
        recorded_by=body.recordedBy,
        payment_date=body.paymentDate,
        notes=body.notes or "",
        receipt_ref=ref,
        receipt_number=receipt,
    )
    db.add(payment)

    if body.chargeId:
        await db.execute(
            text("""
                UPDATE charges
                SET amount_paid = LEAST(amount, amount_paid + :amt),
                    remaining_balance = GREATEST(0, remaining_balance - :amt),
                    status = CASE
                      WHEN GREATEST(0, remaining_balance - :amt) = 0 THEN 'paid'
                      WHEN amount_paid + :amt > 0 THEN 'partially_paid'
                      ELSE status END
                WHERE id = :cid AND landlord_id = :lid
            """),
            {"amt": body.amount, "cid": body.chargeId, "lid": user.landlord_id},
        )

    await db.commit()
    await db.refresh(payment)
    return _row_dict(payment)


# ─── POST /api/payments/momo ─────────────────────────────────────────────────
@router.post("/momo", status_code=201)
async def initiate_momo(body: MomoPayment, user: TokenData = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    ref = gen_ref("MMO")
    lid = user.landlord_id

    payment = Payment(
        landlord_id=lid,
        reference_number=ref,
        tenant_id=body.tenantId or None,
        tenant_name=body.tenantName,
        room_id=body.roomId or None,
        room_number=body.roomNumber,
        charge_id=body.chargeId or None,
        category_id=body.categoryId or None,
        category_name=body.categoryName,
        billing_period=body.billingPeriod,
        amount=Decimal(str(body.amount)),
        payment_method="momo",
        momo_network=body.momoNetwork,
        status="pending",
        recorded_by="tenant" if user.role == "tenant" else "admin",
        payment_date=date.today(),
    )
    db.add(payment)
    await db.commit()
    await db.refresh(payment)
    return _row_dict(payment)


# ─── PATCH /api/payments/:id/status ───────────────────────────────────────────
@router.patch("/{payment_id}/status")
async def update_payment_status(payment_id: str, body: PaymentStatusUpdate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.landlord_id == user.landlord_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment not found")

    payment.status = body.status
    payment.provider_ref = body.providerRef

    if body.status == "successful" and payment.charge_id:
        await db.execute(
            text("""
                UPDATE charges
                SET amount_paid = LEAST(amount, amount_paid + :amt),
                    remaining_balance = GREATEST(0, remaining_balance - :amt),
                    status = CASE
                      WHEN GREATEST(0, remaining_balance - :amt) = 0 THEN 'paid'
                      WHEN amount_paid + :amt > 0 THEN 'partially_paid'
                      ELSE status END
                WHERE id = :cid AND landlord_id = :lid
            """),
            {"amt": float(payment.amount), "cid": str(payment.charge_id), "lid": user.landlord_id},
        )

    await db.commit()
    await db.refresh(payment)
    return _row_dict(payment)


# ─── POST /api/payments/:id/reverse ───────────────────────────────────────────
@router.post("/{payment_id}/reverse")
async def reverse_payment(payment_id: str, body: ReverseRequest, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Payment).where(Payment.id == payment_id, Payment.landlord_id == user.landlord_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment not found")
    if payment.status != "successful":
        raise HTTPException(400, "Only successful payments can be reversed")

    payment.status = "reversed"

    if payment.charge_id:
        await db.execute(
            text("""
                UPDATE charges
                SET amount_paid = GREATEST(0, amount_paid - :amt),
                    remaining_balance = LEAST(amount, remaining_balance + :amt),
                    status = CASE
                      WHEN LEAST(amount, remaining_balance + :amt) >= amount THEN 'pending'
                      ELSE 'partially_paid' END
                WHERE id = :cid AND landlord_id = :lid
            """),
            {"amt": float(payment.amount), "cid": str(payment.charge_id), "lid": user.landlord_id},
        )

    # Audit log
    audit = AuditLog(
        landlord_id=user.landlord_id,
        entity_type="payment",
        entity_id=payment.id,
        field="status",
        original_value="successful",
        corrected_value="reversed",
        actor="admin",
        reason=body.reason or "",
    )
    db.add(audit)

    await db.commit()
    return {"success": True}
