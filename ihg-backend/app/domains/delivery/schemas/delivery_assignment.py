"""Request/response schemas for delivery (rider) assignments."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class DeliveryAssignmentCreate(BaseModel):
    order_id: UUID
    rider_id: UUID


class DeliveryAssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    rider_id: UUID
    status: str
    assigned_at: datetime
    picked_up_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    is_active: bool
    assigned_by_staff_id: Optional[UUID] = None