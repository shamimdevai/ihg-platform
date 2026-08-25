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


class RoomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hotel_id: UUID
    room_type_id: UUID
    room_number: str
    floor: Optional[str] = None
    status: str
    is_active: bool