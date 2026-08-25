"""Request/response schemas for staff-facing hotel guest management."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HotelGuestCreate(BaseModel):
    """Payload for POST /customers/guests — created by staff, no login required."""

    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    identification_number: Optional[str] = None
    nationality: Optional[str] = None
    is_vip: bool = False


class HotelGuestUpdate(BaseModel):
    """Payload for PUT /customers/guests/{id}. All fields optional."""

    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    identification_number: Optional[str] = None
    nationality: Optional[str] = None
    is_vip: Optional[bool] = None


class HotelGuestRead(BaseModel):
    """Full hotel guest representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    identification_number: Optional[str] = None
    nationality: Optional[str] = None
    is_vip: bool
    customer_id: Optional[UUID] = None