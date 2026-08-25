"""TableReservation — a booked dining slot for a table. customer_id is loosely
coupled to customers.customer (no hard FK) — a reservation may also be a
walk-in taken by staff with no customer account at all (customer_name/phone
captured instead), matching hotel.models.booking.Booking's guest_id precedent.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class TableReservation(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A reservation for a dining table. Status machine: reserved -> seated ->
    completed, or reserved -> cancelled / no_show. No other transitions
    permitted (enforced in table_reservation_service).
    """

    __tablename__ = "table_reservations"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("restaurants.id"), nullable=False, index=True
    )
    table_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dining_tables.id"), nullable=False, index=True
    )
    # Loosely coupled to customers.customer.id — no FK, cross-domain rule. Nullable:
    # a walk-in reservation taken over the phone/at the host stand has no account.
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(200), nullable=False)
    customer_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    reservation_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    party_size: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    # "reserved" | "seated" | "completed" | "cancelled" | "no_show"
    status: Mapped[str] = mapped_column(String(20), default="reserved", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Loosely coupled to iam.staff_user.id — no FK, matching Booking.booked_by_staff_id.
    booked_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)