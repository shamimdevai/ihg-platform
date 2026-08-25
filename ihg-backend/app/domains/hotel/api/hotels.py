"""Hotel property and room-type management."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.hotel import HotelCreate, HotelRead, HotelUpdate
from app.domains.hotel.schemas.room_type import RoomTypeCreate, RoomTypeRead
from app.domains.hotel.services import room_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/hotels", tags=["hotel"])


@router.post("", dependencies=[Depends(require_permission("hotel:room:write"))])
async def create_hotel(payload: HotelCreate, db: AsyncSession = Depends(get_db)) -> dict:
    hotel = await room_service.create_hotel(db, **payload.model_dump())
    return envelope(data=HotelRead.model_validate(hotel), message="Hotel created.")


@router.get("", dependencies=[Depends(require_permission("hotel:room:read"))])
async def list_hotels(db: AsyncSession = Depends(get_db)) -> dict:
    hotels = await room_service.list_hotels(db)
    return envelope(data=[HotelRead.model_validate(h) for h in hotels])


@router.get("/{hotel_id}", dependencies=[Depends(require_permission("hotel:room:read"))])
async def get_hotel(hotel_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    hotel = await room_service.get_hotel(db, hotel_id)
    return envelope(data=HotelRead.model_validate(hotel))


@router.put("/{hotel_id}", dependencies=[Depends(require_permission("hotel:room:write"))])
async def update_hotel(hotel_id: UUID, payload: HotelUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    hotel = await room_service.update_hotel(db, hotel_id, **payload.model_dump())
    return envelope(data=HotelRead.model_validate(hotel), message="Hotel updated.")


# --- Room types (nested under a hotel) -----------------------------------------------


@router.post("/{hotel_id}/room-types", dependencies=[Depends(require_permission("hotel:room:write"))])
async def create_room_type(hotel_id: UUID, payload: RoomTypeCreate, db: AsyncSession = Depends(get_db)) -> dict:
    data = payload.model_dump(exclude={"hotel_id"})
    room_type = await room_service.create_room_type(db, hotel_id=hotel_id, **data)
    return envelope(data=RoomTypeRead.model_validate(room_type), message="Room type created.")


@router.get("/{hotel_id}/room-types", dependencies=[Depends(require_permission("hotel:room:read"))])
async def list_room_types(hotel_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    room_types = await room_service.list_room_types(db, hotel_id)
    return envelope(data=[RoomTypeRead.model_validate(rt) for rt in room_types])