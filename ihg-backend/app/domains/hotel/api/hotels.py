"""Hotel property and room-type management."""
from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_staff_user, get_db, require_permission
from app.domains.hotel.schemas.hotel import HotelCreate, HotelRead, HotelUpdate
from app.domains.hotel.schemas.room_type import RoomTypeCreate, RoomTypeRead, RoomTypeUpdate
from app.domains.hotel.services import room_service
from app.domains.iam.models.staff_user import StaffUser
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


@router.put(
    "/{hotel_id}/room-types/{room_type_id}",
    dependencies=[Depends(require_permission("hotel:room:write"))],
)
async def update_room_type(
    hotel_id: UUID, room_type_id: UUID, payload: RoomTypeUpdate, db: AsyncSession = Depends(get_db)
) -> dict:
    room_type = await room_service.update_room_type(db, room_type_id, **payload.model_dump())
    return envelope(data=RoomTypeRead.model_validate(room_type), message="Room type updated.")


@router.delete(
    "/{hotel_id}/room-types/{room_type_id}",
    dependencies=[Depends(require_permission("hotel:room:write"))],
)
async def delete_room_type(
    hotel_id: UUID,
    room_type_id: UUID,
    current_staff: StaffUser = Depends(get_current_staff_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await room_service.delete_room_type(db, room_type_id, deleted_by_staff_id=current_staff.id)
    return envelope(message="Room type deleted.")


@router.post(
    "/{hotel_id}/room-types/{room_type_id}/image",
    dependencies=[Depends(require_permission("hotel:room:write"))],
)
async def upload_room_type_image(
    hotel_id: UUID,
    room_type_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    room_type = await room_service.upload_room_type_image(db, room_type_id, file)
    return envelope(data=RoomTypeRead.model_validate(room_type), message="Room type image uploaded.")


@router.post(
    "/{hotel_id}/image",
    dependencies=[Depends(require_permission("hotel:room:write"))],
)
async def upload_hotel_image(
    hotel_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    hotel = await room_service.upload_hotel_image(db, hotel_id, file)
    return envelope(data=HotelRead.model_validate(hotel), message="Hotel image uploaded.")