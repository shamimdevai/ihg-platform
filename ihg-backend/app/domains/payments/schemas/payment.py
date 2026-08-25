"""Request/response schemas for payment intents, confirmation, and refunds."""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentCreateRequest(BaseModel):
    """Payload for POST /payments/intents — creates a pending payment against an
    arbitrary reference_type/reference_id.
    """

    reference_type: str
    reference_id: UUID
    amount: float = Field(gt=0)
    currency: Optional[str] = None  # defaults to config/company.yaml's currency if omitted
    method_id: Optional[UUID] = None


class PaymentConfirmRequest(BaseModel):
    """Payload for POST /payments/{id}/confirm — simulates the gateway outcome.

    This is a MOCK gateway (Phase 6 scope, demo/test mode) — `simulate_outcome`
    lets the caller (or a test) choose whether the simulated confirmation succeeds
    or fails, since there is no real payment processor behind this endpoint.
    """

    method_id: Optional[UUID] = None
    simulate_outcome: Literal["paid", "failed"] = "paid"
    failure_reason: Optional[str] = None


class PaymentRefundRequest(BaseModel):
    """Payload for POST /payments/{id}/refund."""

    reason: Optional[str] = None


class PaymentRead(BaseModel):
    """Full payment representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    reference_type: str
    reference_id: UUID
    amount: float
    currency: str
    status: str
    method_id: Optional[UUID] = None
    failure_reason: Optional[str] = None
    refund_reason: Optional[str] = None
    paid_at: Optional[datetime] = None
    refunded_at: Optional[datetime] = None
    created_at: datetime