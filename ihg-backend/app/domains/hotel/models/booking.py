"""Booking — a guest's reservation of a room for a date range.

guest_id is loosely coupled to customers.hotel_guest (no hard FK), matching the
platform's established cross-domain convention (see Payment's reference_type/
reference_id docstring) — the hotel domain must not import customers models or
repositories; guest existence is verified via customers' guest_service.
"""
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class Booking(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    """A reservation. Status machine: reserved -> checked_in -> checked_out, or
    reserved -> cancelled. No other transitions permitted (enforced in
    booking_service / checkin_checkout_service).
    """

    __tablename__ = "bookings"

    hotel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("hotels.id"), nullable=False, index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rooms.id"), nullable=False, index=True
    )
    # Loosely coupled to customers.hotel_guest.id — no FK, cross-domain rule.
    guest_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    actual_check_in_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_check_out_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    num_guests: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rate_per_night: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)  # snapshot from room_type.base_rate
    total_amount: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)  # computed at checkout

    # "reserved" | "checked_in" | "checked_out" | "cancelled"
    status: Mapped[str] = mapped_column(String(20), default="reserved", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancelled_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Loosely coupled to iam.staff_user.id — no FK, matching RefundRequest's
    # requested_by_staff_id/reviewed_by_staff_id precedent (Phase 6.5).
    booked_by_staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)