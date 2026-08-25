"""RefundRequest — the approval workflow for staff who lack direct refund rights.

Phase 6.5 dual-refund architecture:
  A. Direct refund (payments:refund:direct) — payment_service.refund_payment() is
     called immediately, no approval step. See app/domains/payments/api/payments.py.
  B. Request & approval flow (this model) — a staff member without direct-refund
     rights creates a RefundRequest ("pending"); a staff member with
     payments:refund:review approves (which internally calls the SAME
     payment_service.refund_payment() entry point) or rejects it.

Both paths converge on payment_service.refund_payment() as the only function that
actually mutates Payment.status — this model never changes Payment directly.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class RefundRequest(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A staff-submitted request to refund a payment, pending admin review."""

    __tablename__ = "refund_requests"

    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payments.id"), nullable=False, index=True
    )
    # "pending" | "approved" | "rejected" — free-form string, not an enum, matching
    # the same convention used by Payment.status and StockAlert.status.
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # requester's stated reason
    # No hard FK to iam.staff_users — same no-cross-domain-FK convention already used
    # for Payment/StockTransaction's *_staff_id columns.
    requested_by_staff_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reviewed_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Approver's optional note, OR the rejecter's required reason — see
    # refund_request_service.reject_refund_request(), which enforces "required"
    # at the service layer since it only applies to one of the two outcomes.
    review_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)