"""Invoice — a bill generated for a completed booking. payment_id is loosely
coupled to payments.payments.id (no hard FK — payments is a peer domain, per the
platform's reference_type/reference_id convention).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Invoice(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A booking invoice. Status: draft -> issued -> paid, or -> refunded/cancelled.
    Kept loosely in sync with the payments domain's Payment.status via payment_id —
    hotel never reads payments.models/repositories directly, only
    payments.services.payment_service.
    """

    __tablename__ = "invoices"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(40), nullable=False, unique=True, index=True)
    # "draft" | "issued" | "paid" | "refunded" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), default="draft", nullable=False)

    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    # Loosely coupled to payments.payments.id — no FK, cross-domain rule.
    payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    issued_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # unused for now — see notes below
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)