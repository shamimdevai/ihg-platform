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