"""Request/response schemas for stock level viewing and manual adjustment."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StockRead(BaseModel):
    """Current on-hand quantity for one inventory item."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_item_id: UUID
    quantity_on_hand: float


class StockAdjustRequest(BaseModel):
    """Payload for POST /inventory/stock/{item_id}/adjust — a manual, audited
    stock movement. Positive quantity_delta increments, negative decrements.
    """

    quantity_delta: float
    transaction_type: str = "manual_adjustment"
    reason: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None