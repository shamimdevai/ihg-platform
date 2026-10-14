"""Public (no-login) read schemas for the customer-facing website.

Deliberately narrow: only fields a visitor should see. No room numbers,
no is_active, no staff/management fields.
"""
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HotelPublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    image_url: Optional[str] = None


class RoomTypePublicRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hotel_id: UUID
    name: str
    description: Optional[str] = None
    base_rate: float
    capacity: int
    amenities: Optional[str] = None
    image_url: Optional[str] = None


class RoomTypeAvailabilityRead(RoomTypePublicRead):
    """A room type plus how many rooms of it are free for the searched dates."""

    available_rooms: int
    nights: int
    estimated_total: float


class AvailabilitySearchRead(BaseModel):
    hotel_id: UUID
    check_in: str
    check_out: str
    nights: int
    room_types: List[RoomTypeAvailabilityRead]