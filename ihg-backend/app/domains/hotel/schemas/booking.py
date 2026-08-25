"""Request/response schemas for bookings."""
from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class BookingCreate(BaseModel):
    hotel_id: UUID
    room_id: UUID
    guest_id: UUID
    check_in_date: date
    check_out_date: date
    num_guests: Optional[int] = Field(default=None, ge=1)
    notes: Optional[str] = None


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = None


class BookingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    hotel_id: UUID
    room_id: UUID
    guest_id: UUID
    check_in_date: date
    check_out_date: date
    actual_check_in_at: Optional[datetime] = None
    actual_check_out_at: Optional[datetime] = None
    num_guests: Optional[int] = None
    rate_per_night: float
    total_amount: Optional[float] = None
    status: str
    notes: Optional[str] = None
    cancelled_reason: Optional[str] = None
    created_at: datetime