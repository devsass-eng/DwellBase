"""Regulation routes — ports server/routes/regulations.js to FastAPI."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.models import Regulation
from backend.auth import TokenData, require_auth, require_landlord

router = APIRouter(prefix="/regulations", tags=["regulations"])


def _row_dict(r: Regulation) -> dict:
    return {
        "id": str(r.id),
        "landlord_id": str(r.landlord_id),
        "text": r.text,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


class RegulationCreate(BaseModel):
    text: str


@router.get("/")
async def list_regulations(user: TokenData = Depends(require_auth), db: AsyncSession = Depends(get_db)):
    lid = user.landlord_id
    result = await db.execute(
        select(Regulation).where(Regulation.landlord_id == lid).order_by(Regulation.created_at.asc())
    )
    return [_row_dict(r) for r in result.scalars().all()]


@router.post("/", status_code=201)
async def add_regulation(body: RegulationCreate, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    if not body.text or not body.text.strip():
        raise HTTPException(400, "text is required")
    reg = Regulation(landlord_id=user.landlord_id, text=body.text.strip())
    db.add(reg)
    await db.commit()
    await db.refresh(reg)
    return _row_dict(reg)


@router.delete("/{reg_id}")
async def delete_regulation(reg_id: str, user: TokenData = Depends(require_landlord), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Regulation).where(Regulation.id == reg_id, Regulation.landlord_id == user.landlord_id)
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise HTTPException(404, "Regulation not found")
    await db.delete(reg)
    await db.commit()
    return {"success": True}
