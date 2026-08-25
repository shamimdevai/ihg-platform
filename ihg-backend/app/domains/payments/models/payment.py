"""Payment — a single payment record for an arbitrary reference (hotel booking,
restaurant order, delivery order, etc.), loosely coupled via reference_type/
reference_id per PROJECT_STATE.md §3 rule 9 — never a hard FK from payments into
hotel/restaurant/delivery.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Payment(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single payment record, moving through pending -> paid/failed -> refunded."""

    __tablename__ = "payments"

    # Loosely coupled to the record being paid for (e.g. a future hotel booking or
    # restaurant order) — no hard FK, since payments must not import another
    # domain's models.
    reference_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    reference_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)  # ISO 4217, e.g. "USD"
    # "pending" | "paid" | "failed" | "refunded" — free-form string, not an enum, so
    # future gateway integrations can introduce new statuses without a migration.
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    method_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_methods.id"), nullable=True
    )
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refund_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    refunded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)