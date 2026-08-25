"""Request/response schemas for low-stock alerts.

NOTE: this file was not in the original Phase 1 scaffold list for inventory/schemas/
(only __init__, inventory_item, stock, supplier, stock_transaction were scaffolded).
It's added here because the alert endpoints required by this phase's task
(inventory:alert:read / inventory:alert:resolve) need response/request schemas —
same situation as customers/schemas/auth.py needing to exist even though the original
directory sketch didn't spell out every file. Flagged in the session summary.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class StockAlertRead(BaseModel):
    """A single low-stock alert."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    inventory_item_id: UUID
    status: str
    threshold_at_trigger: float
    quantity_at_trigger: float
    resolved_at: Optional[datetime] = None
    resolved_by_staff_id: Optional[UUID] = None
    resolution_note: Optional[str] = None
    created_at: datetime


class StockAlertResolveRequest(BaseModel):
    """Payload for POST /inventory/stock/alerts/{alert_id}/resolve."""

    resolution_note: Optional[str] = None