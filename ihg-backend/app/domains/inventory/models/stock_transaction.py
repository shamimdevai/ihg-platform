"""StockTransaction — an immutable audit record of a single stock movement. Every
change to Stock.quantity_on_hand must produce exactly one of these rows.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class StockTransaction(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A single audited stock movement (positive or negative delta)."""

    __tablename__ = "stock_transactions"

    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    quantity_delta: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    balance_after: Mapped[float] = mapped_column(Numeric(12, 3), nullable=False)
    # e.g. "manual_adjustment", "receipt", "consumption", "return" — free-form string,
    # not an enum, so future domains (hotel/restaurant/delivery) can introduce their
    # own transaction_type values without a migration here.
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Loosely coupled to the record that caused this movement (e.g. a future
    # restaurant dine_in_order), mirroring payments.reference_type/reference_id
    # (PROJECT_STATE.md §3 rule 9) — no hard FK, since inventory must not import
    # another domain's models.
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # No hard FK to iam.staff_users — same no-cross-domain-FK convention already used
    # for deleted_by_staff_id (core/base_model.py) and hotel_guest.created_by_staff_id.
    performed_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)