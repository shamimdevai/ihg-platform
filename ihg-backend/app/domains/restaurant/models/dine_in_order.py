"""DineInOrder — a single dine-in order tied to a table (and, optionally, the
reservation that seated it). customer_id is loosely coupled (walk-ins have
none), matching table_reservation's precedent.
"""
import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class DineInOrder(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A dine-in order. Status machine: placed -> preparing -> ready -> served
    -> billed, or placed -> cancelled. No other transitions permitted (enforced
    in dine_in_order_service / kitchen_service).
    """

    __tablename__ = "dine_in_orders"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dining_tables.id"), nullable=False, index=True
    )
    reservation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("table_reservations.id"), nullable=True, index=True
    )
    # Loosely coupled to customers.customer.id — no FK, cross-domain rule.
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # "placed" | "preparing" | "ready" | "served" | "billed" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), default="placed", nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Loosely coupled to iam.staff_user.id — no FK, matching Booking.booked_by_staff_id.
    placed_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)