"""Room routes — ports server/routes/rooms.js to FastAPI."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Room, Tenant
from backend.auth import TokenData, require_landlord

router = APIRouter(prefix="/rooms", tags=["rooms"])


class RoomCreate(BaseModel):
    monthlyRent: float


class RoomUpdate(BaseModel):
    monthlyRent: float | None = None
    status: str | None = None
    archived: bool | None = None


def _row_to_dict(room: Room) -> dict:
    d = {c.name: getattr(room, c.name) for c in room.__table__.columns}
    for k, v in d.items():
        if hasattr(v, "hex"):
            d[k] = str(v)
        elif hasattr(v, "isoformat"):
            d[k] = v.isoformat()
        elif isinstance(v, Decimal):
            d[k] = float(v)
    return d


# ─── GET /api/rooms ───────────────────────────────────────────────────────────
@router.get("/")
async def list_rooms(user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    lid = user.landlord_id

    # Auto-sync: mark rooms Occupied if they have active tenants
    await db.execute(
        text("""
            UPDATE rooms r SET status = 'Occupied', updated_at = NOW()
            WHERE r.landlord_id = :lid AND r.status != 'Maintenance'
              AND EXISTS (
                SELECT 1 FROM tenants t
                WHERE t.room_id = r.id
                  AND t.tenancy_status IN ('Active', 'Upcoming', 'Expiring Soon')
              )
        """),
        {"lid": lid},
    )
    # Auto-sync: mark rooms Vacant if no active tenants
    await db.execute(
        text("""
            UPDATE rooms r SET status = 'Vacant', updated_at = NOW()
            WHERE r.landlord_id = :lid AND r.status = 'Occupied'
              AND NOT EXISTS (
                SELECT 1 FROM tenants t
                WHERE t.room_id = r.id
                  AND t.tenancy_status IN ('Active', 'Upcoming', 'Expiring Soon')
              )
        """),
        {"lid": lid},
    )
    await db.commit()

    result = await db.execute(
        select(Room)
        .where(Room.landlord_id == lid, Room.archived == False)
        .order_by(Room.sequence_number)
    )
    rows = result.scalars().all()
    return [_row_to_dict(r) for r in rows]


# ─── POST /api/rooms ─────────────────────────────────────────────────────────
@router.post("/", status_code=201)
async def create_room(body: RoomCreate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    if not body.monthlyRent or body.monthlyRent <= 0:
        raise HTTPException(400, "monthlyRent is required")

    lid = user.landlord_id
    seq_result = await db.execute(
        text("SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next FROM rooms WHERE landlord_id = :lid"),
        {"lid": lid},
    )
    seq = seq_result.scalar()
    room_code = f"R{seq}"
    room_number = f"ROOM {seq} ({room_code})"

    room = Room(
        landlord_id=lid,
        sequence_number=seq,
        room_number=room_number,
        room_code=room_code,
        monthly_rent=Decimal(str(body.monthlyRent)),
        status="Vacant",
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return _row_to_dict(room)


# ─── PATCH /api/rooms/:id ────────────────────────────────────────────────────
@router.patch("/{room_id}")
async def update_room(room_id: str, body: RoomUpdate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    try:
        rid = UUID(room_id)
    except (ValueError, TypeError):
        raise HTTPException(404, "Invalid room ID")

    result = await db.execute(
        select(Room).where(Room.id == rid, Room.landlord_id == user.landlord_id)
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    if body.monthlyRent is not None:
        room.monthly_rent = Decimal(str(body.monthlyRent))
    if body.status is not None:
        room.status = body.status
    if body.archived is not None:
        room.archived = body.archived
    room.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(room)
    return _row_to_dict(room)
