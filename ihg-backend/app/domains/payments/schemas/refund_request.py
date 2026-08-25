"""Request/response schemas for the refund request & approval workflow."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class RefundRequestCreate(BaseModel):
    """Payload for POST /payments/{payment_id}/refund-requests. payment_id itself
    comes from the URL path, not the body.
    """

    reason: Optional[str] = None


class RefundRequestApprove(BaseModel):
    """Payload for POST /admin/refund-requests/{request_id}/approve."""

    review_reason: Optional[str] = None


class RefundRequestReject(BaseModel):
    """Payload for POST /admin/refund-requests/{request_id}/reject. A reason is
    required when rejecting — this is the one place review_reason is mandatory.
    """

    reason: str


class RefundRequestRead(BaseModel):
    """Full refund request representation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    payment_id: UUID
    status: str
    reason: Optional[str] = None
    requested_by_staff_id: UUID
    reviewed_by_staff_id: Optional[UUID] = None
    review_reason: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime