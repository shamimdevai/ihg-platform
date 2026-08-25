"""Request/response schemas for table reservations."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TableReservationCreate(BaseModel):
    restaurant_id: UUID
    table_id: UUID
    customer_id: Optional[UUID] = None
    customer_name: str
    customer_phone: Optional[str] = None
    reservation_time: datetime
    party_size: int = Field(default=2, ge=1)
    notes: Optional[str] = None


class TableReservationCancelRequest(BaseModel):
    reason: Optional[str] = None


class TableReservationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    restaurant_id: UUID
    table_id: UUID
    customer_id: Optional[UUID] = None
    customer_name: str
    customer_phone: Optional[str] = None
    reservation_time: datetime
    party_size: int
    status: str
    notes: Optional[str] = None
    created_at: datetime