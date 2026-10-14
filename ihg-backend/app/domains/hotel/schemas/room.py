"""Request/response schemas for rooms."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoomCreate(BaseModel):
    hotel_id: UUID
    room_type_id: UUID
    room_number: str
    floor: Optional[str] = None
    is_active: bool = True


class RoomStatusUpdate(BaseModel):
    status: str = Field(description='"available" | "occupied" | "cleaning" | "maintenance"')


class RoomUpdate(BaseModel):
    """Payload for PUT /hotel/rooms/{room_id} — general edit, distinct from
    RoomStatusUpdate (status stays its own narrower endpoint). Covers
    everything settable at creation except hotel_id — a room never moves
    to a different hotel.
    """

    room_type_id: Optional[UUID] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    is_active: Optional[bool] = None


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hotel_id: UUID
    room_type_id: UUID
    room_number: str
    floor: Optional[str] = None
    status: str
    is_active: bool