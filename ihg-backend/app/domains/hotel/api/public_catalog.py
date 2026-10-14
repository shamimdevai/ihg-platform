"""Public (no-login) hotel browsing for the customer website.

No auth dependency by design: visitors can see hotels, room types and
availability before logging in. Only booking (a later phase) requires a
verified customer. Read-only; mounted behind the hotel module gate.
"""
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db
from app.domains.hotel.schemas.public import (
    AvailabilitySearchRead,
    HotelPublicRead,
    RoomTypePublicRead,
)
from app.domains.hotel.services import public_catalog_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/public", tags=["hotel-public"])


@router.get("/hotels")
async def list_hotels(db: AsyncSession = Depends(get_db)) -> dict:
    hotels = await public_catalog_service.list_public_hotels(db)
    return envelope(data=[HotelPublicRead.model_validate(h) for h in hotels])


@router.get("/hotels/{hotel_id}/room-types")
async def list_room_types(hotel_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    room_types = await public_catalog_service.list_public_room_types(db, hotel_id)
    return envelope(data=[RoomTypePublicRead.model_validate(rt) for rt in room_types])


@router.get("/availability")
async def search_availability(
    hotel_id: UUID,
    check_in: date,
    check_out: date,
    guests: Optional[int] = Query(default=None, ge=1),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await public_catalog_service.search_availability(
        db, hotel_id=hotel_id, check_in=check_in, check_out=check_out, guests=guests
    )
    return envelope(data=AvailabilitySearchRead.model_validate(result))