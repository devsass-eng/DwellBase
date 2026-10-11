"""Reports routes — ports server/routes/reports.js to FastAPI."""

from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import AuditLog
from backend.auth import TokenData, require_landlord
from sqlalchemy import select

router = APIRouter(prefix="/reports", tags=["reports"])


def _audit_dict(a: AuditLog) -> dict:
    d = {col.name: getattr(a, col.name) for col in a.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


# ─── GET /api/reports/summary ─────────────────────────────────────────────────
@router.get("/summary")
async def dashboard_summary(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    lid = user.landlord_id

    rooms_result = await db.execute(
        text("SELECT status, COUNT(*) as count FROM rooms WHERE landlord_id = :lid AND archived = false GROUP BY status"),
        {"lid": lid},
    )
    tenants_result = await db.execute(
        text("SELECT tenancy_status, COUNT(*) as count FROM tenants WHERE landlord_id = :lid GROUP BY tenancy_status"),
        {"lid": lid},
    )
    collected_result = await db.execute(
        text("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE landlord_id = :lid AND status = 'successful'"),
        {"lid": lid},
    )
    outstanding_result = await db.execute(
        text("SELECT COALESCE(SUM(remaining_balance), 0) as total FROM charges WHERE landlord_id = :lid AND status NOT IN ('paid')"),
        {"lid": lid},
    )

    rooms = [{"status": r[0], "count": int(r[1])} for r in rooms_result.fetchall()]
    tenants = [{"tenancy_status": r[0], "count": int(r[1])} for r in tenants_result.fetchall()]
    total_collected = float(collected_result.scalar() or 0)
    total_outstanding = float(outstanding_result.scalar() or 0)

    return {
        "rooms": rooms,
        "tenants": tenants,
        "totalCollected": total_collected,
        "totalOutstanding": total_outstanding,
    }


# ─── GET /api/reports/audit-logs ──────────────────────────────────────────────
@router.get("/audit-logs")
async def audit_logs(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.landlord_id == user.landlord_id)
        .order_by(AuditLog.created_at.desc())
    )
    return [_audit_dict(a) for a in result.scalars().all()]
