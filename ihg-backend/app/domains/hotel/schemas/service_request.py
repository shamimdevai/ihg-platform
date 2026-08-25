"""Request/response schemas for in-room service requests."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ServiceRequestCreate(BaseModel):
    booking_id: UUID
    room_id: UUID
    request_type: str
    description: Optional[str] = None


class ServiceRequestStatusUpdate(BaseModel):
    status: str  # "pending" | "in_progress" | "completed" | "cancelled"


class ServiceRequestAssignRequest(BaseModel):
    assigned_to_staff_id: UUID


class ServiceRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    booking_id: UUID
    room_id: UUID
    request_type: str
    description: Optional[str] = None
    status: str
    assigned_to_staff_id: Optional[UUID] = None
    completed_at: Optional[datetime] = None
    created_at: datetime