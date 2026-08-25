"""Dining table management and status lifecycle."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.restaurant.schemas.dining_table import DiningTableCreate, DiningTableRead, DiningTableStatusUpdate
from app.domains.restaurant.services import restaurant_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/restaurant/tables", tags=["restaurant"])


@router.post("", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def create_table(payload: DiningTableCreate, db: AsyncSession = Depends(get_db)) -> dict:
    table = await restaurant_service.create_table(db, **payload.model_dump())
    return envelope(data=DiningTableRead.model_validate(table), message="Table created.")


@router.get("", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def list_tables(
    restaurant_id: Optional[UUID] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_db)
) -> dict:
    tables = await restaurant_service.list_tables(db, restaurant_id=restaurant_id, status=status)
    return envelope(data=[DiningTableRead.model_validate(t) for t in tables])


@router.get("/{table_id}", dependencies=[Depends(require_permission("restaurant:table:read"))])
async def get_table(table_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    table = await restaurant_service.get_table(db, table_id)
    return envelope(data=DiningTableRead.model_validate(table))


@router.put("/{table_id}/status", dependencies=[Depends(require_permission("restaurant:table:write"))])
async def update_table_status(table_id: UUID, payload: DiningTableStatusUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    table = await restaurant_service.update_table_status(db, table_id, payload.status)
    return envelope(data=DiningTableRead.model_validate(table), message="Table status updated.")