"""Response schema for stock transaction history."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StockTransactionRead(BaseModel):
    """A single audited stock movement."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_item_id: UUID
    quantity_delta: float
    balance_after: float
    transaction_type: str
    reason: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    performed_by_staff_id: Optional[UUID] = None
    created_at: datetime