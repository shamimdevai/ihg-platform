"""Physical room management and status lifecycle."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_db, require_permission
from app.domains.hotel.schemas.room import RoomCreate, RoomRead, RoomStatusUpdate
from app.domains.hotel.services import room_service
from app.shared_kernel.schemas.response_envelope import envelope

router = APIRouter(prefix="/hotel/rooms", tags=["hotel"])


@router.post("", dependencies=[Depends(require_permission("hotel:room:write"))])
async def create_room(payload: RoomCreate, db: AsyncSession = Depends(get_db)) -> dict:
    room = await room_service.create_room(db, **payload.model_dump())
    return envelope(data=RoomRead.model_validate(room), message="Room created.")


@router.get("", dependencies=[Depends(require_permission("hotel:room:read"))])
async def list_rooms(
    hotel_id: Optional[UUID] = None, status: Optional[str] = None, db: AsyncSession = Depends(get_db)
) -> dict:
    rooms = await room_service.list_rooms(db, hotel_id=hotel_id, status=status)
    return envelope(data=[RoomRead.model_validate(r) for r in rooms])


@router.get("/{room_id}", dependencies=[Depends(require_permission("hotel:room:read"))])
async def get_room(room_id: UUID, db: AsyncSession = Depends(get_db)) -> dict:
    room = await room_service.get_room(db, room_id)
    return envelope(data=RoomRead.model_validate(room))


@router.put("/{room_id}/status", dependencies=[Depends(require_permission("hotel:room:write"))])
async def update_room_status(room_id: UUID, payload: RoomStatusUpdate, db: AsyncSession = Depends(get_db)) -> dict:
    room = await room_service.update_room_status(db, room_id, payload.status)
    return envelope(data=RoomRead.model_validate(room), message="Room status updated.")