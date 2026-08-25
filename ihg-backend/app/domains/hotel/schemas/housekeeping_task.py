"""Request/response schemas for housekeeping tasks."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HousekeepingTaskCreate(BaseModel):
    room_id: UUID
    booking_id: Optional[UUID] = None
    task_type: str = "cleaning"
    notes: Optional[str] = None
    assigned_to_staff_id: Optional[UUID] = None


class HousekeepingTaskStatusUpdate(BaseModel):
    status: str  # "pending" | "in_progress" | "completed" | "cancelled"
    notes: Optional[str] = None


class HousekeepingTaskAssignRequest(BaseModel):
    assigned_to_staff_id: UUID


class HousekeepingTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    room_id: UUID
    booking_id: Optional[UUID] = None
    task_type: str
    status: str
    notes: Optional[str] = None
    assigned_to_staff_id: Optional[UUID] = None
    completed_at: Optional[datetime] = None
    created_at: datetime