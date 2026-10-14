"""Request/response schemas for hotels. RoomType schemas live in room_type.py —
one schema file per model, matching the payments/inventory domains' convention."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HotelCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True


class HotelUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class HotelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool
    image_url: Optional[str] = None