"""Request/response schemas for kitchen tickets."""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domains.restaurant.schemas.dine_in_order import DineInOrderItemRead


class KitchenTicketStatusUpdate(BaseModel):
    status: str = Field(description='"pending" | "preparing" | "ready" | "served" | "cancelled"')
    notes: Optional[str] = None


class KitchenTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    order_id: UUID
    status: str
    notes: Optional[str] = None
    started_at: Optional[datetime] = None
    ready_at: Optional[datetime] = None
    served_at: Optional[datetime] = None
    created_at: datetime


class KitchenTicketDetailRead(KitchenTicketRead):
    """Embeds order item summaries (and the table id) directly so the Kitchen
    role never needs restaurant:order:read to see what's on a ticket
    (RBAC_MATRIX.md's named-exception governance rule — Kitchen is scoped to
    restaurant:kitchen:* only).
    """

    table_id: Optional[UUID] = None
    items: List[DineInOrderItemRead] = []