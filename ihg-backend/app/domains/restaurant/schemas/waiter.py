"""Request/response schemas for waiter-to-table assignments."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class WaiterAssignmentCreate(BaseModel):
    table_id: UUID
    staff_id: UUID


class WaiterAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    table_id: UUID
    staff_id: UUID
    assigned_at: datetime
    unassigned_at: Optional[datetime] = None
    is_active: bool