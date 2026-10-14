"""Request/response schemas for room types."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class RoomTypeCreate(BaseModel):
    hotel_id: UUID
    name: str
    description: Optional[str] = None
    base_rate: float = Field(gt=0)
    capacity: int = Field(default=1, ge=1)
    amenities: Optional[str] = None


class RoomTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hotel_id: UUID
    name: str
    description: Optional[str] = None
    base_rate: float
    capacity: int
    amenities: Optional[str] = None
    image_url: Optional[str] = None


class RoomTypeUpdate(BaseModel):
    """Payload for PUT /hotel/hotels/{hotel_id}/room-types/{room_type_id}."""

    name: Optional[str] = None
    description: Optional[str] = None
    base_rate: Optional[float] = Field(default=None, gt=0)
    capacity: Optional[int] = Field(default=None, ge=1)
    amenities: Optional[str] = None