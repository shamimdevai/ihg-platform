"""Request/response schemas for payment methods."""
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class PaymentMethodCreate(BaseModel):
    """Payload for POST /payments/methods."""

    type: str
    label: Optional[str] = None
    is_active: bool = True


class PaymentMethodRead(BaseModel):
    """Full payment method representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: str
    label: Optional[str] = None
    is_active: bool